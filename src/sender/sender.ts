import { Context } from '@azure/functions';
import {
  Sender, QueueClient, DefaultDataTransformer, ServiceBusMessage,
} from '@azure/service-bus';
import { Container } from 'typedi';

import config from '../config';
import { NotifyController } from '../external';
import { QueueRecord, SenderServiceBusMessage } from '../interfaces/queue';
import { NotifySendError } from '../lib/errors';
import { getIdentifiers } from '../utils/log';
import QueueRecordValidator from '../utils/queue-record-validator';
import { ValidationResponse } from '../interfaces/validate-response';
import { BusinessTelemetryEvent, Logger } from '../utils/logger';

class NotifySender {
  private notify: NotifyController;

  private statusQueue: Sender;

  private requestQueue: Sender;

  private dataTransformer: DefaultDataTransformer;

  private logger: Logger;

  private queueRecordValidator: QueueRecordValidator;

  constructor(private context: Context) {
    this.notify = Container.get('notify:controller');
    this.statusQueue = Container.get<QueueClient>('status:queue:client').createSender();
    this.requestQueue = Container.get<QueueClient>('request:queue:client').createSender();
    this.dataTransformer = Container.get('datatransformer');
    this.logger = Container.get<Logger>('logger');
    this.queueRecordValidator = Container.get<QueueRecordValidator>('validator:queuerecord');
  }

  async processMessage(message: QueueRecord): Promise<void> {
    this.logger.info('Sender:processMessage:: Processing message', { ...getIdentifiers(message), context: this.context });

    const validationResponse: ValidationResponse = this.queueRecordValidator.validateMessage(message);

    if (validationResponse.isValid) {
      try {
        const notificationId: string = await this.notify.sendNotification(message);
        await this.sendMessageToStatusQueue(message, notificationId);
      } catch (error) {
        this.logger.error(error, 'Sender: GovNotify error', { ...getIdentifiers(message), context: this.context });
        if (error instanceof NotifySendError) {
          this.logger.logEvent(this.context, BusinessTelemetryEvent.NOTIF_SENDER_FAIL_SEND, 'Notification Sender failed to communicate with Gov Notify');
          await this.handleSendFailureRetry(message);
          return;
        }
        throw error; // Other unknown error, rethrow
      }
    } else {
      const errorMessage = `Sender:processMessage:: Invalid request, ${validationResponse.errorMessage}`;
      const error = new Error(errorMessage);
      this.logger.error(error, errorMessage, { ...getIdentifiers(message), context: this.context });
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
      await this.statusQueue.send({
        body: statusQueueRecord,
        correlationId: message.trace_id,
        userProperties: {
          operationId: message.trace_id,
          parentId: message.parent_id,
          sendStartDate,
        },
      });
      success = true;
      this.logger.info(`Sender: Added notification to status queue, id: ${notificationId}`, { ...getIdentifiers(message), context: this.context });
    } catch (error) {
      this.logger.logEvent(this.context, BusinessTelemetryEvent.NOTIF_SENDER_FAIL_WRITE_QUEUE, 'Notification Sender failed to add message to Notification Status Queue');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      this.logger.error(error, `Sender: Failed adding to status queue ${String(error.message)}`, { ...getIdentifiers(message), context: this.context });
      throw error;
    } finally {
      const now = Date.now();
      this.logger.request(this.context, 'Ntf Status Queue', {
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
      this.logger.info('Sender: reached max retry count', { ...getIdentifiers(message), context: this.context });
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      body: this.dataTransformer.encode(message),
      correlationId: message.trace_id,
      userProperties: {
        operationId: message.trace_id,
        parentId: message.parent_id,
        sendStartDate,
      },
    };
    this.logger.request(this.context, 'Ntf Status Queue', {
      url: this.context.req?.url,
      duration: 200,
      resultCode: 200,
      success: true,
      id: message.parent_id,
    });
    const retryTime = new Date(Date.now() + delay);
    await this.requestQueue.scheduleMessage(retryTime, serviceBusMessage as ServiceBusMessage);
    this.logger.info(`Sender: scheduled message for retry at ${String(retryTime)}`, { ...getIdentifiers(message), context: this.context });
  }
}

export default NotifySender;
