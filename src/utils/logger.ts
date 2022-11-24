import { Context } from '@azure/functions';
import { getOperationId as getOpId, Logger as AzureLogger } from '@dvsa/azure-logger';
import config from '../config/index';

export class Logger extends AzureLogger {
  constructor() {
    super('FTTS', config.websiteSiteName);
  }

  // any type of values can be passed in properties
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logDependency(context: Context, name: string, message?: string, properties?: { [key: string]: any }): void {
    super.dependency(name, message, {
      context,
      target: name,
      duration: 200,
      resultCode: 200,
      success: true,
      id: context.traceContext.traceparent,
      ...properties,
    });
  }

  getOperationId(context: Context): string {
    return getOpId(context);
  }
}

export enum BusinessTelemetryEvent {
  // API
  NOTIF_API_FAIL_CONNECT_QUEUE = 'NOTIF_API_FAIL_CONNECT_QUEUE',
  NOTIF_API_FAIL_WRITE_QUEUE = 'NOTIF_API_FAIL_WRITE_QUEUE',

  // Sender
  NOTIF_SENDER_FAIL_READ_QUEUE = 'NOTIF_SENDER_FAIL_READ_QUEUE',
  NOTIF_SENDER_FAIL_SEND = 'NOTIF_SENDER_FAIL_SEND',
  NOTIF_SENDER_FAIL_CONNECT_STATUS_QUEUE = 'NOTIF_SENDER_FAIL_CONNECT_STATUS_QUEUE',
  NOTIF_SENDER_FAIL_WRITE_QUEUE = 'NOTIF_SENDER_FAIL_WRITE_QUEUE',
  NOTIF_SENDER_OK_SEND_RECEIVE = 'NOTIF_SENDER_OK_SEND_RECEIVE',

  // Status
  NOTIF_STATUS_FAIL_CONNECT_QUEUE = 'NOTIF_STATUS_FAIL_CONNECT_QUEUE', // duplicate of sender_fail_connect_status
  NOTIF_STATUS_FAIL_READ_QUEUE = 'NOTIF_STATUS_FAIL_READ_QUEUE',
  NOTIF_STATUS_FAIL_CHECK = 'NOTIF_STATUS_FAIL_CHECK',
  NOTIF_STATUS_FAIL_CDS = 'NOTIF_STATUS_FAIL_CDS',

  // DLQ Collector
  NOTIF_COLLECTOR_FOUND_MSG = 'NOTIF_COLLECTOR_FOUND_MSG',
  NOTIF_COLLECTOR_FAIL_CDS = 'NOTIF_COLLECTOR_FAIL_CDS',
  NOTIF_COLLECTOR_FAIL_CONNECT_QUEUE = 'NOTIF_COLLECTOR_FAIL_CONNECT_QUEUE',

  NOTIF_NOT_WHITELISTED_URL_CALL = 'NOT_WHITELISTED_URL_CALL',
}

export const logger = new Logger();
