import { Context } from '@azure/functions';
import { Container } from 'typedi';
import {
  ApiResponse,
  EmailHttpRequest,
  LetterHttpRequest,
  SendNotificationHttpRequest,
} from '../interfaces/api';
import { QueueRecordItem } from '../interfaces/queue';
import requestQueueClient from '../queues/request-queue-client';
import { BusinessTelemetryEvent, logger, Logger } from '../utils/logger';
import NotificationRequest from './requests/base-notification-request';
import EmailRequest from './requests/email-request';
import LetterRequest from './requests/letter-request';
import SendNotificationRequest from './requests/notification-request';

export const buildJsonResponse = (statusCode: number, description: string): ApiResponse => ({
  headers: { 'Content-Type': 'application/json' },
  status: statusCode,
  body: { description },
});

class SendNotificationController {
  private logger: Logger;

  constructor() {
    this.logger = Container.get('logger');
  }

  async sendEmail(context: Context): Promise<void> {
    const emailRequest = new EmailRequest(context.req as EmailHttpRequest);
    this.logger.info(
      'SendNotificationController::sendEmail: Processing new email request',
      {
        ...emailRequest.getIdentifiers(),
        context,
      },
    );
    await this.handleRequest(context, emailRequest);
  }

  async sendLetter(context: Context): Promise<void> {
    const letterRequest = new LetterRequest(context.req as LetterHttpRequest);
    this.logger.info(
      'SendNotificationController::sendLetter: Processing new letter request',
      {
        ...letterRequest.getIdentifiers(),
        context,
      },
    );
    await this.handleRequest(context, letterRequest);
  }

  async sendNotification(context: Context): Promise<void> {
    const notificationRequest = new SendNotificationRequest(context.req as SendNotificationHttpRequest);
    this.logger.info(
      'SendNotificationController::sendNotification: Processing new notification request',
      {
        ...notificationRequest.getIdentifiers(),
        context,
      },
    );
    await this.handleRequest(context, notificationRequest);
  }

  private async handleRequest(context: Context, request: NotificationRequest | SendNotificationRequest): Promise<void> {
    logger.debug(
      'SendNotificationController::handleRequest request',
      {
        ...request,
      },
    );
    request.validate();

    const queueRecord: QueueRecordItem = request.mapToQueueRecord();
    const operationId = this.logger.getOperationId(context);
    const parentId = context.traceContext.traceparent;
    const sendStartDate = Date.now();
    queueRecord.trace_id = operationId;
    queueRecord.parent_id = parentId || undefined;

    this.logger.info(
      'SendNotificationController::handleRequest: Putting notification on request queue',
      {
        ...request.getIdentifiers(),
        context,
      },
    );
    let success = false;
    try {
      await requestQueueClient.sendMessage({
        body: queueRecord,
        correlationId: operationId,
        userProperties: {
          operationId,
          parentId,
          sendStartDate,
        },
      });
      success = true;
    } catch (error) {
      this.logger.event(
        BusinessTelemetryEvent.NOTIF_API_FAIL_WRITE_QUEUE,
        'SendNotificationController::handleRequest: Notification API failed to add message to Notification Request Queue',
        {
          ...queueRecord,
        },
      );
      this.logger.error(
        error as Error,
        'SendNotificationController::handleRequest: Failed adding to request queue',
        {
          ...request.getIdentifiers(),
          ...queueRecord,
          context,
        },
      );
      throw error;
    } finally {
      const now = Date.now();
      this.logger.request(
        'Ntf Request Queue',
        {
          url: context.req?.url,
          duration: (now - sendStartDate),
          resultCode: success ? 200 : 500,
          context,
          success,
          id: parentId,
        },
      );
    }

    this.logger.info(
      'SendNotificationController::handleRequest: Sending success response',
      {
        ...request.getIdentifiers(),
        context,
      },
    );
  }
}

export default SendNotificationController;
