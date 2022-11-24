import { AzureFunction, Context } from '@azure/functions';
import { nonHttpTriggerContextWrapper } from '@dvsa/azure-logger';
import { withEgressFiltering } from '@dvsa/egress-filtering';
import { CorrelatedBindingData } from '../interfaces/azure';
import { QueueRecord, QueueRecordItem } from '../interfaces/queue';
import loaders from '../loaders';
import { internalAccessDeniedError, whitelistedUrls } from '../services/egress-filter';
import { handleError } from '../utils/handleError';
import { getIdentifiers, logIdentifiers } from '../utils/log';
import { BusinessTelemetryEvent, logger } from '../utils/logger';
import NotifySender from './sender';

export const serviceBusQueueTrigger: AzureFunction = async (context: Context, message: QueueRecordItem): Promise<void> => {
  loaders(context);
  /**
   * Guard necessary to catch this bug https://github.com/Azure/azure-sdk-for-js/issues/6816 where
   * a scheduled message is triggered but the body is null. To remove when @azure/service-bus npm package
   * is upgraded from versions 1.1.3 to ^2.0.0
   */
  if (message) {
    const { userProperties } = context.bindingData as CorrelatedBindingData;
    const sendStartTime = userProperties?.sendStartDate;
    const now = Date.now();
    logger.logDependency(context, 'Ntf Request Queue', 'Getting message from Request Queue', {
      dependencyTypeName: 'AMQP',
      duration: (now - Number(sendStartTime)),
      id: context.traceContext.traceparent,
    });
    try {
      logger.info('Sender:serviceBusQueueTrigger: New message', { ...(getIdentifiers(message)), context });
      const sender = new NotifySender(context);
      await sender.processMessage(message);
      logger.info(`Sender:serviceBusQueueTrigger: Finished processing message: ${logIdentifiers(message)}`, { ...(getIdentifiers(message)), context });
    } catch (error) {
      handleError(error, context, 'Sender:serviceBusQueueTrigger');
    }
  } else {
    logger.event(BusinessTelemetryEvent.NOTIF_SENDER_FAIL_READ_QUEUE, 'Notification Sender failed to pick up message from queue');
    logger.info('Sender:serviceBusQueueTrigger::logger: Queue message does not exist', { context });
  }
};

export const index = async (context: Context, message: QueueRecord): Promise<void> => nonHttpTriggerContextWrapper(
  withEgressFiltering(serviceBusQueueTrigger, whitelistedUrls, internalAccessDeniedError, logger),
  context,
  message,
);
