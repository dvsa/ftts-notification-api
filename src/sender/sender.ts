/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Context } from '@azure/functions';
import { DefaultDataTransformer, ServiceBusMessage } from '@azure/service-bus';
import { Container } from 'typedi';
import config from '../config';
import { NotifyController } from '../external';
import { QueueRecord, QueueRecordItem, SenderServiceBusMessage } from '../interfaces/queue';
import { ValidationResponse } from '../interfaces/validate-response';
import { NotifySendError } from '../lib/errors';
import requestQueueClient from '../queues/request-queue-client';
import statusQueueClient from '../queues/status-queue-client';
import { getIdentifiers } from '../utils/log';
import { BusinessTelemetryEvent, logger, Logger } from '../utils/logger';
import QueueRecordValidator from '../utils/queue-record-validator';
import { MessageType } from '../lib/enums';

class NotifySender {
  private notify: NotifyController;

  private dataTransformer: DefaultDataTransformer;

  private logger: Logger;

  private queueRecordValidator: QueueRecordValidator;

  constructor(private context: Context) {
    this.notify = Container.get('notify:controller');
    this.dataTransformer = Container.get('datatransformer');
    this.logger = Container.get<Logger>('logger');
    this.queueRecordValidator = Container.get<QueueRecordValidator>('validator:queuerecord');
  }

  async processMessage(message: QueueRecordItem): Promise<void> {
    this.logger.info('NotifySender::processMessage: Processing message', { ...getIdentifiers(message), context: this.context });

    if (message && message.message_type === MessageType.NOTIFICATION) {
      logger.warn('NotifySender::processMessage: Warning the message was not processed due to it being from send-notification.', { ...getIdentifiers(message), context: this.context, traceId: message.trace_id });
      return;
    }
    //Remove once messages of type MessageType.Notification are processed
    const queueMessage = message as QueueRecord;

    const validationResponse: ValidationResponse = this.queueRecordValidator.validateMessage(queueMessage);

    if (validationResponse.isValid) {
      try {
        const notificationId: string = await this.notify.sendNotification(queueMessage);
        await this.sendMessageToStatusQueue(queueMessage, notificationId);
      } catch (error) {
        this.logger.error(error as Error, 'NotifySender::processMessage: GovNotify error', { ...getIdentifiers(queueMessage), context: this.context });
        if (error instanceof NotifySendError) {
          this.logger.event(BusinessTelemetryEvent.NOTIF_SENDER_FAIL_SEND, 'Notification Sender failed to communicate with Gov Notify');
          await this.handleSendFailureRetry(queueMessage);
          return;
        }
        throw error; // Other unknown error, rethrow
      }
    } else {
      const errorMessage = `NotifySender::processMessage: Invalid request, ${validationResponse.errorMessage}`;
      const error = new Error(errorMessage);
      this.logger.error(error, errorMessage, { ...getIdentifiers(queueMessage), context: this.context });
    }
  }

  private async sendMessageToStatusQueue(message: QueueRecord, notificationId: string): Promise<void> {
    message.no_of_request_retries = 0; // Reset request retry count
    const sendStartDate = Date.now();
    let success = false;
    const statusQueueRecord: QueueRecord = {
      ...message,
      id: notificationId,
    };
    try {
      await statusQueueClient.sendMessage({
        body: statusQueueRecord,
        correlationId: message.trace_id,
        userProperties: {
          operationId: message.trace_id,
          parentId: message.parent_id,
          sendStartDate,
        },
      });
      success = true;
      this.logger.info('NotifySender::sendMessageToStatusQueue: Added notification to status queue', { notificationId, ...getIdentifiers(message), context: this.context });
    } catch (error) {
      this.logger.event(BusinessTelemetryEvent.NOTIF_SENDER_FAIL_WRITE_QUEUE, 'Notification Sender failed to add message to Notification Status Queue');
      this.logger.error(error as Error, 'NotifySender::sendMessageToStatusQueue: Failed adding to status queue', { errorMessage: (error as Error)?.message, ...getIdentifiers(message), context: this.context });
      throw error;
    } finally {
      const now = Date.now();
      this.logger.request('Ntf Status Queue', {
        context: this.context,
        url: this.context.req?.url,
        duration: (now - sendStartDate),
        resultCode: success ? 200 : 500,
        success,
        id: message.parent_id,
      });
    }
  }

  private async handleSendFailureRetry(message: QueueRecord): Promise<void> {
    if (message.no_of_request_retries >= config.error.request.retryCount) {
      this.logger.info('NotifySender::handleSendFailureRetry: reached max retry count', { ...getIdentifiers(message), context: this.context });
      throw new Error(); // Throw error to abandon message
    } else {
      await this.scheduleMessageForRetry(message);
    }
  }

  private async scheduleMessageForRetry(message: QueueRecord): Promise<void> {
    message.no_of_request_retries++;
    const sendStartDate = Date.now();
    const delay = config.error.request.retryDelay * message.no_of_request_retries;
    const serviceBusMessage: Partial<SenderServiceBusMessage> = {
      // TODO - remove encoding after upgrading service bus package to 2.0.0
      // It will be covered with https://jira.dvsacloud.uk/browse/FTT-11541
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      body: this.dataTransformer.encode(message),
      correlationId: message.trace_id,
      userProperties: {
        operationId: message.trace_id,
        parentId: message.parent_id,
        sendStartDate,
      },
    };
    this.logger.request('Ntf Status Queue', {
      context: this.context,
      url: this.context.req?.url,
      duration: 200,
      resultCode: 200,
      success: true,
      id: message.parent_id,
    });
    const retryTime = new Date(Date.now() + delay);
    await requestQueueClient.scheduleMessage(retryTime, serviceBusMessage as ServiceBusMessage);
    this.logger.warn(`NotifySender::scheduleMessageForRetry: scheduled message for retry at ${String(retryTime)}`, { ...getIdentifiers(message), context: this.context });
  }
}

export default NotifySender;
