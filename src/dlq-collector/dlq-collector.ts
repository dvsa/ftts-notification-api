import { Context } from '@azure/functions';
import { Container } from 'typedi';

import { CRM } from '../external';
import { QueueRecord } from '../interfaces/queue';
import { getIdentifiers } from '../utils/log';
import QueueRecordValidator from '../utils/queue-record-validator';
import { ValidationResponse } from '../interfaces/validate-response';
import { CRMStatus } from '../lib/enums';
import { BusinessTelemetryEvent, Logger } from '../utils/logger';

class DeadLetterQueueCollector {
  /**
   * Manages dead letter queue messages
   * @param {ServiceBusClient} serviceBusClient
   */
  constructor(
    private crm: CRM = Container.get<CRM>('crm'),
    private logger: Logger = Container.get<Logger>('logger'),
    private queueRecordValidator = Container.get<QueueRecordValidator>('validator:queuerecord'),
  ) { }

  async processMessage(context: Context, message: QueueRecord): Promise<void> {
    this.logger.event(BusinessTelemetryEvent.NOTIF_COLLECTOR_FOUND_MSG, 'DeadLetterQueueCollector:::processMessage');
    this.logger.debug('DeadLetterQueueCollector:::processMessage', { message });
    const validationResponse: ValidationResponse = this.queueRecordValidator.validateMessage(message);

    if (validationResponse.isValid) {
      this.logger.info('DeadLetterQueueCollector::processMessage: Processing message', { ...getIdentifiers(message), context });
      try {
        await this.crm.sendNotificationStatus(context, message, CRMStatus.NOTIFY_FAILURE); // Assume error on sending to/querying Notify
      } catch (error) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        this.logger.event(BusinessTelemetryEvent.NOTIF_COLLECTOR_FAIL_CDS, 'Dead Letter Queue Collector failed to add message to CDS Ingestion Queue', { error });
        this.logger.error(error as Error, 'DeadLetterQueueCollector::processMessage: Could not process DLQ message, Error sending to CRM queue', { ...getIdentifiers(message), context });
      }
    } else {
      const error = new Error('DLQCollector::processMessage: Invalid request');
      this.logger.error(error, `DLQCollector::processMessage: Invalid request, ${validationResponse.errorMessage}`, { ...getIdentifiers(message), context });
    }
  }
}

export default DeadLetterQueueCollector;
