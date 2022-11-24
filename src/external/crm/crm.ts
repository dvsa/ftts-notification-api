import { Context } from '@azure/functions';
import { Container } from 'typedi';
import { QueueRecord } from '../../interfaces/queue';
import { CRMStatus } from '../../lib/enums';
import { BusinessTelemetryEvent, Logger } from '../../utils/logger';
import crmQueueClient from '../../queues/crm-queue-client';
import config  from '../../config';

export default class CRM {
  private logger: Logger;

  constructor() {
    this.logger = Container.get('logger');
  }

  async sendNotificationStatus(context: Context, message: QueueRecord, crmStatus: CRMStatus): Promise<void> {
    if (!config.featureToggles.sendToCrmQueue) { return; }

    this.logger.debug('CRM::sendNotificationStatus: Sending notification to CRM', { context, ...this.buildLog(message, crmStatus) });

    const sendStartDate = Date.now();
    const traceId = message.trace_id;
    const crmMessage = {
      ...message,
      status: crmStatus,
    };
    delete crmMessage.trace_id;

    let success = false;
    try {
      await crmQueueClient.sendMessage({
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
      this.logger.event(BusinessTelemetryEvent.NOTIF_STATUS_FAIL_CDS, 'CRM::sendNotificationStatus: Notification Status failed to add message to CDS Ingestion Queue');
      throw error;
    } finally {
      this.logger.request('CRM::sendNotificationStatus: Ntf Crm Queue', {
        context,
        url: context.req?.url,
        duration: (Date.now() - sendStartDate),
        resultCode: success ? 200 : 500,
        success,
        id: message.parent_id,
      });
    }
  }

  private buildLog(message: QueueRecord, crmStatus: CRMStatus): Record<string, unknown> {
    return {
      id: message.id,
      reference: message.reference,
      context_id: message.context_id,
      trace_id: message.trace_id,
      target: message.target,
      message_type: message.message_type,
      status: message.status,
      crmStatus,
    };
  }
}
