import { Context } from '@azure/functions';
import { Logger as AzureLogger, getOperationId as getOpId } from '@dvsa/azure-logger';

export class Logger extends AzureLogger {
  constructor() {
    super('FTTS', 'notification-api');
  }

  logEvent(
    context: Context,
    telemetryEvent: BusinessTelemetryEvent,
    message?: string,
    properties?: { [key: string]: string },
  ): void {
    super.event(
      telemetryEvent,
      message,
      {
        ...properties,
        context,
      },
    );
  }

  // any type of values can be passed in properties
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logDependency(context: Context, name: string, message?: string, properties?: { [key: string]: any }): void {
    super.dependency(context, name, message, {
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

  // Status
  NOTIF_STATUS_FAIL_CONNECT_QUEUE = 'NOTIF_STATUS_FAIL_CONNECT_QUEUE', // duplicate of sender_fail_connect_status
  NOTIF_STATUS_FAIL_READ_QUEUE = 'NOTIF_STATUS_FAIL_READ_QUEUE',
  NOTIF_STATUS_FAIL_CHECK = 'NOTIF_STATUS_FAIL_CHECK',
  NOTIF_STATUS_FAIL_CDS = 'NOTIF_STATUS_FAIL_CDS',

  // DLQ Collector
  NOTIF_COLLECTOR_FOUND_MSG = 'NOTIF_COLLECTOR_FOUND_MSG',
  NOTIF_COLLECTOR_FAIL_CDS = 'NOTIF_COLLECTOR_FAIL_CDS',
  NOTIF_COLLECTOR_FAIL_CONNECT_QUEUE = 'NOTIF_COLLECTOR_FAIL_CONNECT_QUEUE',
}

export const logger = new Logger();
