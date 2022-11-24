/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Context } from '@azure/functions';
import { MessagingError } from '@azure/service-bus';
import { addressParser, InternalAccessDeniedError } from '@dvsa/egress-filtering';
import config from '../config';
import { internalAccessDeniedError } from '../services/egress-filter';
import { logger } from './logger';
import { SchemaValidationError } from './schemaValidationError';
import { buildJsonResponse } from '../api/send-notification-controller';

export const handleError = (error: any, context: Context, functionName: string): void => {
  logger.error(error as Error, `notification-api::${functionName}: ${error.message}`);
  if (error instanceof MessagingError && error.message === 'Unrecognised address') {
    const address = addressParser.parseSbConnectionString(config.serviceBus.apiConnectionString);
    internalAccessDeniedError(new InternalAccessDeniedError(address.host, address.port?.toString() as string, error.message, error));
  }
  if (error instanceof SchemaValidationError) {
    context.res = buildJsonResponse(400, error.message);
    return;
  }
  throw error;
};
