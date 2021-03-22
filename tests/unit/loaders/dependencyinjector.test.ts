import { mocked } from 'ts-jest/utils';
import dotenv from 'dotenv';
import { Container } from 'typedi';
import { NotifyClient } from 'notifications-node-client';
import dependencyInjectorLoader from '../../../src/loaders/dependencyinjector';
import QueueRecordValidator from '../../../src/utils/queue-record-validator';
import { NotifyController } from '../../../src/external';
import { logger } from '../../../src/utils/logger';
import { mockedContext } from '../../mocks/context.mock';

jest.mock('notifications-node-client');
jest.mock('typedi');
jest.mock('dotenv');
jest.mock('@azure/service-bus', () => ({
  ServiceBusClient: {
    createFromConnectionString: () => ({
      createQueueClient: () => ({
        createSender: jest.fn(),
      }),
    }),
  },
  DefaultDataTransformer: jest.fn(),
}));
jest.mock('../../../src/config', () => ({
  notify: {
    gb: {
      templateKey: 'gbkey',
      apiKey: 'gbapi',
    },
    ni: {
      templateKey: 'nikey',
      apiKey: 'niapi',
    },
  },
  serviceBus: {
    apiConnectionString: 'apiConnectionString',
    crmConnectionString: 'crmConnectionString',
  },
  queues: {
    notificationStatus: { name: 'queues-notificationStatus' },
    notificationRequest: { name: 'queues-notificationRequest' },
    crmResult: { name: 'queues-crmResult' },
    stubCrmResult: { name: 'queues-stubCrmResult' },
  },
}));
jest.mock('../../../src/external/crm/crm');

const mockedDotEnv = mocked(dotenv, true);
const mockedContainer = mocked(Container, true);

describe('Dependency Injector Loader', () => {
  const originalEnv = process.env;

  afterEach(() => {
    jest.clearAllMocks();
    process.env = originalEnv;
  });

  test('Ensure utilities are loaded', () => {
    dependencyInjectorLoader(mockedContext);

    expect(Container.set).toBeCalledWith('logger', logger);
    expect(Container.set).toBeCalledWith('validator:queuerecord', new QueueRecordValidator());
    expect(Container.set).toBeCalledWith('notify:controller', new NotifyController(mockedContext));
    expect(Container.set).toBeCalledWith('crm', expect.objectContaining({}));
  });

  test('Notify Clients are initialised and set in containers', () => {
    dependencyInjectorLoader(mockedContext);

    expect(NotifyClient).toHaveBeenCalledWith('gbapi');
    expect(NotifyClient).toHaveBeenCalledWith('niapi');

    expect(Container.set).toHaveBeenCalledWith('notify:client:gb', expect.objectContaining({}));
    expect(Container.set).toHaveBeenCalledWith('notify:client:ni', expect.objectContaining({}));
  });

  test('Stub Notify Clients are initialised and set in containers', () => {
    mockedDotEnv.config.mockImplementationOnce(() => ({}));
    process.env.USE_NOTIFY_STUB = 'true';
    process.env.NOTIFY_STUB_URL = 'stub_url';

    dependencyInjectorLoader(mockedContext);

    expect(NotifyClient).toHaveBeenCalledWith('stub_url', 'gbapi');
    expect(NotifyClient).toHaveBeenCalledWith('stub_url', 'niapi');

    expect(Container.set).toHaveBeenCalledWith('notify:client:gb', expect.objectContaining({}));
    expect(Container.set).toHaveBeenCalledWith('notify:client:ni', expect.objectContaining({}));
  });

  test('Dependency Injection errors are logged and thrown', () => {
    const error = new Error('test error');
    mockedContainer.set.mockImplementationOnce(() => {
      throw error;
    });

    expect(() => dependencyInjectorLoader(mockedContext))
      .toThrowError(error);

    expect(logger.error).toHaveBeenCalledWith(error, 'Error on dependency injector loader', expect.objectContaining({}));
  });
});
