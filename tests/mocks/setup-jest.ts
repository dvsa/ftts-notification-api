// This file will be run by jest whenever a new test file is loaded.

// Setup env vars
process.env.NODE_ENV = 'test';
process.env.APPINSIGHTS_INSTRUMENTATIONKEY = 'test';

// Setup Global Mocks
jest.mock('@dvsa/azure-logger');
jest.mock('@azure/service-bus', () => ({
  ServiceBusClient: {
    createFromConnectionString: () => ({
      createQueueClient: () => ({
        createSender: jest.fn(),
        createReceiver: jest.fn(),
      }),
    }),
  },
  MessagingError: Error,
  ReceiveMode: {
    peekLock: 1,
  },
}));
