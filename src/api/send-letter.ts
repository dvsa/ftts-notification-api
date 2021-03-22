import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import { httpTriggerContextWrapper } from '@dvsa/azure-logger';
import loaders from '../loaders';
import SendNotificationController from './send-notification-controller';

export const httpTrigger: AzureFunction = async (context: Context): Promise<void> => {
  loaders(context);
  const sendNotificationController = new SendNotificationController();
  await sendNotificationController.sendLetter(context);
};

export const index = async (context: Context, httpRequest: HttpRequest): Promise<void> => httpTriggerContextWrapper(httpTrigger, context, httpRequest);
