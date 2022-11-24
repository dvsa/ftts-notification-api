import { Context } from '@azure/functions';
import {
  DataTransformer,
} from '@azure/service-bus';
import { StatusResponseBody } from 'notifications-node-client';
import { Container } from 'typedi';
import config from '../config';
import { CRM, NotifyController } from '../external';
import { QueueRecord, StatusServiceBusMessage } from '../interfaces/queue';
import { ValidationResponse } from '../interfaces/validate-response';
import { CRMStatus, Status } from '../lib/enums';
import requestQueueClient from '../queues/request-queue-client';
import statusQueueClient from '../queues/status-queue-client';
import { getIdentifiers, logIdentifiers } from '../utils/log';
import { BusinessTelemetryEvent, Logger } from '../utils/logger';
import QueueRecordValidator from '../utils/queue-record-validator';

class StatusQueueProcessor {
  constructor(
    private context: Context,
    private logger: Logger = Container.get<Logger>('logger'),
    private crm: CRM = Container.get<CRM>('crm'),
    private queueRecordValidator = Container.get<QueueRecordValidator>('validator:queuerecord'),
    private dataTransformer: DataTransformer = Container.get('datatransformer'),
  ) { }

  async processQueue(): Promise<void> {
    try {
      const sbMessages = await this.retrieveMessages();

      // Loop through all the messages and process them in parallel
      await Promise.all(sbMessages.map(async (sbMessage) => {
        try {
          await this.checkMessage(sbMessage);
        } catch (e) {
          // Possible notify query error - log and just let message retry after lock expires
          const message: string = e instanceof Error ? e.message : 'Unknown error';
          this.logger.error(e as Error, `StatusQueueProcessor::processQueue: ${message}`, { ...this.buildLog(sbMessage.body), context: this.context });
        }
      }));
    } catch (err) {
      const message: string = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(err as Error, `StatusQueueProcessor::processQueue: Processing queue failed ${message}`, { context: this.context });
    }
  }

  async retrieveMessages(): Promise<StatusServiceBusMessage[]> {
    try {
      return await statusQueueClient.receiveMessages();
    } catch (error) {
      this.logger.event(BusinessTelemetryEvent.NOTIF_STATUS_FAIL_READ_QUEUE);
      throw error;
    }
  }

  async checkMessage(sbMessage: StatusServiceBusMessage): Promise<void> {
    this.logger.info('StatusQueueProcessor::checkMessage', { ...(getIdentifiers(sbMessage.body)), context: this.context });

    const validationResponse: ValidationResponse = this.queueRecordValidator.validateMessage(sbMessage.body);

    if (validationResponse.isValid) {
      const response: StatusResponseBody = await this.getStatusResponse(sbMessage.body.target, sbMessage.body?.id);
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const { status, sent_at } = response;
      sbMessage.body.status = status as Status;

      this.logger.info(`StatusQueueProcessor:checkMessage: Message with notify status: ${status}`, { ...this.buildLog(sbMessage.body), context: this.context });

      switch (status) {
        case Status.DELIVERED:
        case Status.RECEIVED: {
          await sbMessage.complete();
          await this.crm.sendNotificationStatus(this.context, sbMessage.body, CRMStatus.DELIVERED);
          
          this.logger.event(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            BusinessTelemetryEvent.NOTIF_SENDER_OK_SEND_RECEIVE,
            'StatusQueueProcessor:checkMessage: Message sent or received',
            { ...getIdentifiers(sbMessage.body), sent_at },
          );
          break;
        }
        case Status.ACCEPTED:
        case Status.CREATED:
        case Status.SENDING: {
          await sbMessage.complete();
          await this.scheduleMessageOnStatusQueue(sbMessage);
          await this.crm.sendNotificationStatus(this.context, sbMessage.body, CRMStatus.ACCEPTED);
          break;
        }
        case Status.FAILED:
        case Status.TECHNICAL_FAILURE:
        case Status.TEMPORARY_FAILURE: {
          if (sbMessage?.body?.no_of_retries < config.error.status.retryCount) {
            sbMessage.body.no_of_retries++;
            await sbMessage.complete();
            await this.scheduleMessageOnRequestQueue(sbMessage);
          } else {
            await sbMessage.complete();
            await this.crm.sendNotificationStatus(this.context, sbMessage.body, CRMStatus.DELIVERY_FAILURE);
          }
          break;
        }
        case Status.PERMANENT_FAILURE:
          await sbMessage.complete();
          await this.crm.sendNotificationStatus(this.context, sbMessage.body, CRMStatus.PERMANENT_FAILURE);
          break;
        default:
          break;
      }
    } else {
      const errorMessage = `StatusQueueProcessor:checkMessage: Invalid request, ${validationResponse?.errorMessage} ${logIdentifiers(sbMessage.body)}`;
      const error = new Error(errorMessage);
      this.logger.error(error, errorMessage, { context: this.context });
      await sbMessage.complete();
    }
  }

  private async getStatusResponse(target: string, id: string): Promise<StatusResponseBody> {
    try {
      return await NotifyController.getStatusResponse(target, id);
    } catch (error) {
      this.logger.event(
        BusinessTelemetryEvent.NOTIF_STATUS_FAIL_CHECK,
        'StatusQueueProcessor::getStatusResponse: Notification Status failed to communicate with Gov Notify',
        {
          target,
          id,
        },
      );
      throw error;
    }
  }

  private async scheduleMessageOnRequestQueue(sbMessage: StatusServiceBusMessage): Promise<void> {
    const messageBody = { ...sbMessage.body };
    delete messageBody.status; // Clear status before returning to request queue
    /*
      TODO: Remove the message body encoding when upgrading the @azure/service-bus package since it's a temporary workaround for the bug
      https://github.com/Azure/azure-sdk-for-js/issues/6816#issuecomment-574461068
      Version 2.0.0-preview.1 fixes this
      It will be covered with https://jira.dvsacloud.uk/browse/FTT-11541
    */
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const encodedMessageBody = this.dataTransformer.encode(messageBody);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    await requestQueueClient.scheduleMessage(new Date(Date.now() + config.error.status.retryDelay), { body: encodedMessageBody });
    this.logger.info('StatusQueueProcessor::scheduleMessageOnRequestQueue: Message sent back to request queue', { ...this.buildLog(messageBody), context: this.context });
  }

  private async scheduleMessageOnStatusQueue(sbMessage: StatusServiceBusMessage): Promise<void> {
    const messageBody = { ...sbMessage.body };
    /*
    TODO: Remove the message body encoding when upgrading the @azure/service-bus package since it's a temporary workaround for the bug
    https://github.com/Azure/azure-sdk-for-js/issues/6816#issuecomment-574461068
    Version 2.0.0-preview.1 fixes this
    It will be covered with https://jira.dvsacloud.uk/browse/FTT-11541
    */
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const encodedMessageBody = this.dataTransformer.encode(messageBody);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    await statusQueueClient.scheduleMessage(new Date(Date.now() + config.error.status.retryDelay), { body: encodedMessageBody });
    this.logger.info('StatusQueueProcessor::scheduleMessageOnStatusQueue: Message sent back to status queue', { ...this.buildLog(messageBody), context: this.context });
  }

  private buildLog(message: QueueRecord): Record<string, unknown> {
    return {
      id: message.id,
      reference: message.reference,
      context_id: message.context_id,
      target: message.target,
      message_type: message.message_type,
      status: message.status,
      no_of_retries: message.no_of_retries,
    };
  }
}

export default StatusQueueProcessor;
