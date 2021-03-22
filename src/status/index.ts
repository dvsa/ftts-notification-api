import { AzureFunction, Context } from '@azure/functions';
import { nonHttpTriggerContextWrapper } from '@dvsa/azure-logger';

import loaders from '../loaders';
import { logger } from '../utils/logger';
import StatusQueueProcessor from './status-queue-processor';

export const statusTimerTrigger: AzureFunction = async (context: Context): Promise<void> => {
  logger.event('Launch', 'Notifications Status Checker', { context });
  loaders(context);
  const statusQueueProcessor = new StatusQueueProcessor(context);
  await statusQueueProcessor.processQueue();
  logger.log('Status checker finished', { context });
};

export const index = async (context: Context): Promise<void> => nonHttpTriggerContextWrapper(statusTimerTrigger, context);
