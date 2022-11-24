import { AzureFunction, Context } from '@azure/functions';
import { nonHttpTriggerContextWrapper } from '@dvsa/azure-logger';
import { withEgressFiltering } from '@dvsa/egress-filtering';
import loaders from '../loaders';
import { internalAccessDeniedError, whitelistedUrls } from '../services/egress-filter';
import { handleError } from '../utils/handleError';
import { logger } from '../utils/logger';
import StatusQueueProcessor from './status-queue-processor';

export const statusTimerTrigger: AzureFunction = async (context: Context): Promise<void> => {
  loaders(context);
  try {
    const statusQueueProcessor = new StatusQueueProcessor(context);
    await statusQueueProcessor.processQueue();
    logger.info('Status::statusTimerTrigger: Status checker finished', { context });
  } catch (error) {
    handleError(error, context, 'statusTimerTrigger');
  }
};

export const index = async (context: Context): Promise<void> => nonHttpTriggerContextWrapper(
  withEgressFiltering(statusTimerTrigger, whitelistedUrls, internalAccessDeniedError, logger),
  context,
);
