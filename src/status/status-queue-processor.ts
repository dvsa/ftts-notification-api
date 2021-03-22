import { Context } from '@azure/functions';
import {
  DataTransformer, QueueClient, ReceiveMode,
} from '@azure/service-bus';
import { Container } from 'typedi';
import config from '../config';
import { CRM, NotifyController } from '../external';
import { QueueRecord, StatusServiceBusMessage } from '../interfaces/queue';
import { ValidationResponse } from '../interfaces/validate-response';
import { CRMStatus, Status } from '../lib/enums';
import { logIdentifiers } from '../utils/log';
import { BusinessTelemetryEvent, Logger } from '../utils/logger';
import QueueRecordValidator from '../utils/queue-record-validator';

class StatusQueueProcessor {
  constructor(
    private context: Context,
    private requestQueueClient: QueueClient = Container.get('request:queue:client'),
    private statusQueueClient: QueueClient = Container.get('status:queue:client'),
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
          this.logger.error(e, message, { context: this.context });
        }
      }));
    } catch (err) {
      const message: string = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(err, `Status::Processing queue failed ${message}`, { context: this.context });
    }
  }

  async retrieveMessages(): Promise<StatusServiceBusMessage[]> {
    try {
      const receiver = this.statusQueueClient.createReceiver(ReceiveMode.peekLock);
      const sbMessages: StatusServiceBusMessage[] = await receiver.receiveMessages(config.error.status.messageLimit, config.error.status.maxWaitTimeInSeconds);

      return sbMessages;
    } catch (error) {
      this.logger.logEvent(this.context, BusinessTelemetryEvent.NOTIF_STATUS_FAIL_READ_QUEUE);
      throw error;
    }
  }

  async checkMessage(sbMessage: StatusServiceBusMessage): Promise<void> {
    this.logger.log(`Status:checkMessage:: ${logIdentifiers(sbMessage.body)}`, { context: this.context });

    const validationResponse: ValidationResponse = this.queueRecordValidator.validateMessage(sbMessage.body);

    if (validationResponse.isValid) {
      const status: Status = await this.getStatus(sbMessage.body.target, sbMessage.body?.id);
      sbMessage.body.status = status;

      this.logger.log(`Status:checkMessage:: Message with notify status: ${status} ${this.buildLog(sbMessage.body)}`, { context: this.context });

      switch (status) {
        case Status.DELIVERED:
        case Status.RECEIVED: {
          await sbMessage.complete();
          await this.crm.sendNotificationStatus(this.context, sbMessage.body, CRMStatus.DELIVERED);
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
      const errorMessage = `Status:checkMessage:: Invalid request, ${validationResponse?.errorMessage} ${logIdentifiers(sbMessage.body)}`;
      const error = new Error(errorMessage);
      this.logger.error(error, errorMessage, { context: this.context });
      await sbMessage.complete();
    }
  }

  private async getStatus(target: string, id: string): Promise<Status> {
    try {
      return await NotifyController.getStatus(target, id);
    } catch (error) {
      this.logger.logEvent(this.context, BusinessTelemetryEvent.NOTIF_STATUS_FAIL_CHECK, 'Notification Status failed to communicate with Gov Notify');
      throw error;
    }
  }

  private async scheduleMessageOnRequestQueue(sbMessage: StatusServiceBusMessage): Promise<void> {
    const requestQueueSender = this.requestQueueClient.createSender();
    const messageBody = { ...sbMessage.body };
    delete messageBody.status; // Clear status before returning to request queue
    /*
      TODO: Remove the message body encoding when upgrading the @azure/service-bus package since it's a temporary workaround for the bug
      https://github.com/Azure/azure-sdk-for-js/issues/6816#issuecomment-574461068
      Version 2.0.0-preview.1 fixes this
    */
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const encodedMessageBody = this.dataTransformer.encode(messageBody);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    await requestQueueSender.scheduleMessage(new Date(Date.now() + config.error.status.retryDelay), { body: encodedMessageBody });
    this.logger.log(`Status::scheduleMessageOnRequestQueue Message sent back to request queue: ${this.buildLog(messageBody)}`, { context: this.context });
  }

  private async scheduleMessageOnStatusQueue(sbMessage: StatusServiceBusMessage): Promise<void> {
    const statusQueueSender = this.statusQueueClient.createSender();
    const messageBody = { ...sbMessage.body };
    /*
      TODO: Remove the message body encoding when upgrading the @azure/service-bus package since it's a temporary workaround for the bug
      https://github.com/Azure/azure-sdk-for-js/issues/6816#issuecomment-574461068
      Version 2.0.0-preview.1 fixes this
    */
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const encodedMessageBody = this.dataTransformer.encode(messageBody);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    await statusQueueSender.scheduleMessage(new Date(Date.now() + config.error.status.retryDelay), { body: encodedMessageBody });
    this.logger.log(`Status::scheduleMessageOnStatusQueue Message sent back to status queue: ${this.buildLog(messageBody)}`, { context: this.context });
  }

  private buildLog(message: QueueRecord): string {
    return JSON.stringify({
      id: message.id,
      reference: message.reference,
      context_id: message.context_id,
      target: message.target,
      message_type: message.message_type,
      status: message.status,
      no_of_retries: message.no_of_retries,
    });
  }
}

export default StatusQueueProcessor;
