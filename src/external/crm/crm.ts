import { Context } from '@azure/functions';
import { QueueClient, Sender } from '@azure/service-bus';
import { Container } from 'typedi';

import { QueueRecord } from '../../interfaces/queue';
import { CRMStatus } from '../../lib/enums';
import { BusinessTelemetryEvent, Logger } from '../../utils/logger';

export default class CRM {
  private crmQueue: Sender;

  private logger: Logger;

  constructor() {
    const crmQueueClient: QueueClient = Container.get('crm:queue:client');
    this.crmQueue = crmQueueClient.createSender();
    this.logger = Container.get('logger');
  }

  async sendNotificationStatus(context: Context, message: QueueRecord, crmStatus: CRMStatus): Promise<void> {
    this.logger.log(`Sending notification to CRM: ${this.buildLog(message, crmStatus)}`, { context });

    const sendStartDate = Date.now();
    const traceId = message.trace_id;
    const crmMessage = {
      ...message,
      status: crmStatus,
    };
    delete crmMessage.trace_id;

    let success = false;
    try {
      await this.crmQueue.send({
        body: crmMessage,
        correlationId: traceId,
        userProperties: {
          operationId: traceId,
          parentId: traceId,
          sendStartDate,
        },
      });
      success = true;
    } catch (error) {
      this.logger.logEvent(context, BusinessTelemetryEvent.NOTIF_STATUS_FAIL_CDS, 'Notification Status failed to add message to CDS Ingestion Queue');
      throw error;
    } finally {
      this.logger.request(context, 'Ntf Crm Queue', {
        url: context.req?.url,
        duration: (Date.now() - sendStartDate),
        resultCode: success ? 200 : 500,
        success,
        id: message.parent_id,
      });
    }
  }

  private buildLog(message: QueueRecord, crmStatus: CRMStatus): string {
    return JSON.stringify({
      id: message.id,
      reference: message.reference,
      context_id: message.context_id,
      trace_id: message.trace_id,
      target: message.target,
      message_type: message.message_type,
      status: message.status,
      crmStatus,
    });
  }
}
