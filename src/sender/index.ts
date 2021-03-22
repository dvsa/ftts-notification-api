import { AzureFunction, Context } from '@azure/functions';
import { nonHttpTriggerContextWrapper } from '@dvsa/azure-logger';

import loaders from '../loaders';
import NotifySender from './sender';
import { QueueRecord } from '../interfaces/queue';
import { logIdentifiers } from '../utils/log';
import { BusinessTelemetryEvent, logger } from '../utils/logger';
import { CorrelatedBindingData } from '../interfaces/azure';

export const serviceBusQueueTrigger: AzureFunction = async (context: Context, message: QueueRecord): Promise<void> => {
  logger.event('Launch', 'Notifications Sender', { context });
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
    logger.log(`Sender:serviceBusQueueTrigger:: New message: ${logIdentifiers(message)}`, { context });
    const sender = new NotifySender(context);
    await sender.processMessage(message);
    logger.log(`Sender:serviceBusQueueTrigger:: Finished processing message: ${logIdentifiers(message)}`, { context });
  } else {
    logger.logEvent(context, BusinessTelemetryEvent.NOTIF_SENDER_FAIL_READ_QUEUE, 'Notification Sender failed to pick up message from queue');
    logger.info('Sender:serviceBusQueueTrigger::logger:: Queue message does not exist', { context });
  }
};

export const index = async (context: Context, message: QueueRecord): Promise<void> => nonHttpTriggerContextWrapper(serviceBusQueueTrigger, context, message);
