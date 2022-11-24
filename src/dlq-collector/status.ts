import { AzureFunction, Context } from '@azure/functions';
import { nonHttpTriggerContextWrapper } from '@dvsa/azure-logger';
import { QueueRecord } from '../interfaces/queue';
import loaders from '../loaders';
import { handleError } from '../utils/handleError';
import { logger } from '../utils/logger';
import DeadLetterQueueCollector from './dlq-collector';

export const serviceBusQueueTrigger: AzureFunction = async (context: Context, message: QueueRecord): Promise<void> => {
  try {
    logger.debug('Notifications Status DLQ Collector::serviceBusQueueTrigger', { ...message, context });
    loaders(context);
    logger.logDependency(context, 'Notifications Status DLQ Collector::serviceBusQueueTrigger', 'Collecting message from Status DLQ', {
      dependencyTypeName: 'AMQP',
      id: context.traceContext.traceparent,
      ...message,
    });
    logger.info('Notifications Status DLQ Collector::serviceBusQueueTrigger: message', { ...message, context });
    if (message) {
      const collector = new DeadLetterQueueCollector();
      await collector.processMessage(context, message);
    } else {
      logger.info('Notifications Status DLQ Collector::serviceBusQueueTrigger: service bus message does not exist', { context });
    }
  } catch (error) {
    handleError(error, context, 'Notifications Status DLQ Collector::serviceBusQueueTrigger');
  }
};

export const index = async (context: Context, message: QueueRecord): Promise<void> => nonHttpTriggerContextWrapper(serviceBusQueueTrigger, context, message);
