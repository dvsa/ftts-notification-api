import { AzureFunction, Context } from '@azure/functions';
import { nonHttpTriggerContextWrapper } from '@dvsa/azure-logger';

import loaders from '../loaders';
import { QueueRecord } from '../interfaces/queue';
import DeadLetterQueueCollector from './dlq-collector';
import { logger } from '../utils/logger';
import { getIdentifiers } from '../utils/log';

export const serviceBusQueueTrigger: AzureFunction = async (context: Context, message: QueueRecord): Promise<void> => {
  logger.event('Launch', 'Notifications Request DLQ Collector', { context });
  loaders(context);
  logger.dependency(context, 'Ntf Request DLQ', 'Collecting message from Request DLQ', {
    dependencyTypeName: 'AMQP',
    id: context.traceContext.traceparent,
  });
  logger.info('Collecting Request DLQ message', { ...getIdentifiers(message), context });
  if (message) {
    const collector = new DeadLetterQueueCollector();
    await collector.processMessage(context, message);
  } else {
    logger.info('Request DLQ collector - service bus message does not exist', { ...getIdentifiers(message), context });
  }
};

export const index = async (context: Context, message: QueueRecord): Promise<void> => nonHttpTriggerContextWrapper(serviceBusQueueTrigger, context, message);
