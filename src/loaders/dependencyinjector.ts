import { Context } from '@azure/functions';
import { DefaultDataTransformer } from '@azure/service-bus';
import { NotifyClient } from 'notifications-node-client';
import { Container } from 'typedi';
import config from '../config';
import { CRM, NotifyController } from '../external';
import { logger } from '../utils/logger';
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

    Container.set('datatransformer', new DefaultDataTransformer());

    Container.set('crm', new CRM());
  } catch (error) {
    logger.error(error as Error, 'Error on dependency injector loader', { context });
    throw error;
  }
};
