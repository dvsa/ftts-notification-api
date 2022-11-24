import { addressParser, InternalAccessDeniedError, Address } from '@dvsa/egress-filtering';

import config from '../config';
import { logger, BusinessTelemetryEvent } from '../utils/logger';

export const whitelistedUrls: Address[] = [
  addressParser.parseUri(config.notify.url),
  addressParser.parseSbConnectionString(config.serviceBus.apiConnectionString),
  addressParser.parseSbConnectionString(config.serviceBus.crmConnectionString),
];

export const internalAccessDeniedError = (error: InternalAccessDeniedError): void => {
  logger.security(BusinessTelemetryEvent.NOTIF_NOT_WHITELISTED_URL_CALL, {
    host: error.host,
    port: error.port,
    reason: JSON.stringify(error),
  });
  logger.event(BusinessTelemetryEvent.NOTIF_NOT_WHITELISTED_URL_CALL, error.message, {
    host: error.host,
    port: error.port,
    reason: JSON.stringify(error),
  });
};
