import { Context } from '@azure/functions';
import { ServiceBusClient, DefaultDataTransformer } from '@azure/service-bus';
import { NotifyClient } from 'notifications-node-client';
import { Container } from 'typedi';

import config from '../config';
import { CRM, NotifyController } from '../external';
import { BusinessTelemetryEvent, logger } from '../utils/logger';
import QueueRecordValidator from '../utils/queue-record-validator';

export default (context: Context): void => {
  try {
    let notifyGB;
    let notifyNI;

    if (process.env.USE_NOTIFY_STUB === 'true') {
      const notifyURL = process.env.NOTIFY_STUB_URL || '';
      notifyGB = new NotifyClient(notifyURL, config.notify.gb.apiKey);
      notifyNI = new NotifyClient(notifyURL, config.notify.ni.apiKey);
    } else {
      notifyGB = new NotifyClient(config.notify.gb.apiKey);
      notifyNI = new NotifyClient(config.notify.ni.apiKey);
    }

    // Add more containers
    Container.set('logger', logger);
    Container.set('validator:queuerecord', new QueueRecordValidator());
    Container.set('notify:client:gb', notifyGB);
    Container.set('notify:client:ni', notifyNI);
    Container.set('notify:controller', new NotifyController(context));

    // Request and Status Queues
    const serviceBusClient = ServiceBusClient.createFromConnectionString(config.serviceBus.apiConnectionString);
    try {
      Container.set('request:queue:client', serviceBusClient.createQueueClient(config.queues.notificationRequest.name));
    } catch (error) {
      logger.logEvent(context, BusinessTelemetryEvent.NOTIF_API_FAIL_CONNECT_QUEUE, 'Notification API failed to connect to Notification Request Queue');
      throw error;
    }
    try {
      Container.set('status:queue:client', serviceBusClient.createQueueClient(config.queues.notificationStatus.name));
    } catch (error) {
      logger.logEvent(context, BusinessTelemetryEvent.NOTIF_SENDER_FAIL_CONNECT_STATUS_QUEUE, 'Notification Sender failed to connect to Notification Status Queue');
      throw error;
    }
    Container.set('datatransformer', new DefaultDataTransformer());

    // CRM Queue
    const crmServiceBusClient = ServiceBusClient.createFromConnectionString(config.serviceBus.crmConnectionString);
    const crmQueueName = process.env.USE_CRM_STUB === 'true' ? config.queues.stubCrmResult.name : config.queues.crmResult.name;
    try {
      Container.set('crm:queue:client', crmServiceBusClient.createQueueClient(crmQueueName));
    } catch (error) {
      logger.logEvent(context, BusinessTelemetryEvent.NOTIF_COLLECTOR_FAIL_CONNECT_QUEUE, 'Dead Letter Queue Collector failed to connect to CDS Ingestion Queue');
      throw error;
    }
    Container.set('crm', new CRM());
  } catch (error) {
    logger.error(error, 'Error on dependency injector loader', { context });
    throw error;
  }
};
