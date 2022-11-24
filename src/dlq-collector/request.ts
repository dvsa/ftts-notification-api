import { AzureFunction, Context } from '@azure/functions';
import { nonHttpTriggerContextWrapper } from '@dvsa/azure-logger';
import { QueueRecord } from '../interfaces/queue';
import loaders from '../loaders';
import { handleError } from '../utils/handleError';
import { logger } from '../utils/logger';
import DeadLetterQueueCollector from './dlq-collector';

export const serviceBusQueueTrigger: AzureFunction = async (context: Context, message: QueueRecord): Promise<void> => {
  try {
    logger.debug('Notifications Request DLQ Collector::serviceBusQueueTrigger', { ...message });
    loaders(context);
    logger.dependency('Notifications Request DLQ Collector::serviceBusQueueTrigger', 'Collecting message from Request DLQ', {
      dependencyTypeName: 'AMQP',
      context,
      id: context.traceContext.traceparent,
      ...message,
    });
    logger.info('Notifications Request DLQ Collector::serviceBusQueueTrigger: Collecting Request DLQ message', { ...message, context });
    if (message) {
      const collector = new DeadLetterQueueCollector();
      await collector.processMessage(context, message);
    } else {
      logger.info('Notifications Request DLQ Collector::serviceBusQueueTrigger: service bus message does not exist', { context });
    }
  } catch (error) {
    handleError(error, context, 'Notifications Request DLQ Collector::serviceBusQueueTrigger');
  }
};

export const index = async (context: Context, message: QueueRecord): Promise<void> => nonHttpTriggerContextWrapper(serviceBusQueueTrigger, context, message);
