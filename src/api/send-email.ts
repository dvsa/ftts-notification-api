import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import { httpTriggerContextWrapper } from '@dvsa/azure-logger';
import { withEgressFiltering } from '@dvsa/egress-filtering';
import loaders from '../loaders';
import { internalAccessDeniedError, whitelistedUrls } from '../services/egress-filter';
import { handleError } from '../utils/handleError';
import { logger } from '../utils/logger';
import SendNotificationController, { buildJsonResponse } from './send-notification-controller';

export const httpTrigger: AzureFunction = async (context: Context): Promise<void> => {
  loaders(context);
  try {
    const sendNotificationController = new SendNotificationController();
    await sendNotificationController.sendEmail(context);
    context.res = buildJsonResponse(201, 'Notification sent');
  } catch (error) {
    handleError(error, context, 'send-email');
  }
};

export const index = async (context: Context, httpRequest: HttpRequest): Promise<void> => httpTriggerContextWrapper(
  withEgressFiltering(httpTrigger, whitelistedUrls, internalAccessDeniedError, logger),
  context,
  httpRequest,
);
