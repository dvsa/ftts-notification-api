import { Context } from '@azure/functions';
import { Sender, QueueClient } from '@azure/service-bus';
import { Container } from 'typedi';
import { ApiResponse, EmailHttpRequest, LetterHttpRequest } from '../interfaces/api';
import { QueueRecord } from '../interfaces/queue';
import { BusinessTelemetryEvent, Logger } from '../utils/logger';
import NotificationRequest from './requests/base-notification-request';
import EmailRequest from './requests/email-request';
import LetterRequest from './requests/letter-request';

const buildJsonResponse = (statusCode: number, description: string): ApiResponse => ({
  headers: { 'Content-Type': 'application/json' },
  status: statusCode,
  body: { description },
});

class SendNotificationController {
  private requestQueue: Sender;

  private logger: Logger;

  constructor() {
    const queueClient: QueueClient = Container.get('request:queue:client');
    this.requestQueue = queueClient.createSender();
    this.logger = Container.get('logger');
  }

  async sendEmail(context: Context): Promise<void> {
    const emailRequest = new EmailRequest(context.req as EmailHttpRequest);
    this.logger.info('SendNotificationController:sendEmail:: Processing new email request', { ...emailRequest.getIdentifiers(), context });
    await this.handleRequest(context, emailRequest);
  }

  async sendLetter(context: Context): Promise<void> {
    const letterRequest = new LetterRequest(context.req as LetterHttpRequest);
    this.logger.info('SendNotificationController:sendLetter:: Processing new letter request', { ...letterRequest.getIdentifiers(), context });
    await this.handleRequest(context, letterRequest);
  }

  private async handleRequest(context: Context, request: NotificationRequest): Promise<void> {
    if (!request.isValid()) {
      this.logger.info('SendNotificationController:handleRequest:: Invalid request, sending error response', { ...request.getIdentifiers(), context });
      context.res = buildJsonResponse(400, 'Bad Request');
      return;
    }

    const queueRecord: QueueRecord = request.mapToQueueRecord();
    const operationId = this.logger.getOperationId(context);
    const parentId = context.traceContext.traceparent;
    const sendStartDate = Date.now();
    queueRecord.trace_id = operationId;
    queueRecord.parent_id = parentId || undefined;

    this.logger.info('SendNotificationController:handleRequest:: Putting notification on request queue', { ...request.getIdentifiers(), context });
    let success = false;
    try {
      await this.requestQueue.send({
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
      this.logger.logEvent(context, BusinessTelemetryEvent.NOTIF_API_FAIL_WRITE_QUEUE, 'Notification API failed to add message to Notification Request Queue');
      this.logger.error(error, 'SendNotificationController:handleRequest:: Failed adding to request queue', { ...request.getIdentifiers(), context });
      throw error;
    } finally {
      const now = Date.now();
      this.logger.request(context, 'Ntf Request Queue', {
        url: context.req?.url,
        duration: (now - sendStartDate),
        resultCode: success ? 200 : 500,
        success,
        id: parentId,
      });
    }

    this.logger.info('SendNotificationController:handleRequest:: Sending success response', { ...request.getIdentifiers(), context });
    context.res = buildJsonResponse(201, 'Notification sent');
  }
}

export default SendNotificationController;
