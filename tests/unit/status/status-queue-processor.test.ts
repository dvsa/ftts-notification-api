import { Container } from 'typedi';

import config from '../../../src/config';
import { NotifyController } from '../../../src/external';
import { Status, MessageType, CRMStatus } from '../../../src/lib/enums';
import { statusQueueRecords, buildEmailQueueRecord } from '../../mocks/queue-records';
import StatusQueueProcessor from '../../../src/status/status-queue-processor';
import { QueueRecord, StatusServiceBusMessage } from '../../../src/interfaces/queue';
import { mockedContext } from '../../mocks/context.mock';
import { mockedLogger } from '../../mocks/logger.mock';
import { BusinessTelemetryEvent } from '../../../src/utils/logger';
import { globalDate } from '../../mocks/date.mock';

jest.mock('typedi');
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/external/crm/crm');
jest.mock('../../../src/utils/queue-record-validator');
jest.mock('../../../src/config', () => ({
  error: {
    status: {
      retryCount: 5,
      retryDelay: 2000,
      messageLimit: 5,
    },
  },
}));

const queueRecords = [...statusQueueRecords.map((queueRecord, index) => ({
  ...queueRecord,
  id: String(index),
}))];

describe('StatusQueueProcessor', () => {
  const mockGetStatus = jest.spyOn(NotifyController, 'getStatus');
  mockGetStatus.mockImplementation(() => Promise.resolve(Status.RECEIVED));

  const mockCRM = {
    sendNotificationStatus: jest.fn(() => Promise.resolve({ successful: true })),
  };

  const mockDefaultDataTransformer = { decode: jest.fn((x: QueueRecord) => x), encode: jest.fn((x: QueueRecord) => x) };
  const mockRequestSender = {
    send: jest.fn(),
    scheduleMessage: jest.fn(),
  };

  const mockRequestClient = {
    createSender: jest.fn(() => mockRequestSender),
  };

  const mockStatusClientSender = {
    send: jest.fn(),
    scheduleMessage: jest.fn(),
  };

  const mockStatusClientReceiver = {
    receiveMessages: jest.fn(() => serviceBusMessages),
  };

  const mockStatusClient = {
    createSender: jest.fn(() => mockStatusClientSender),
    createReceiver: jest.fn(() => mockStatusClientReceiver),
  };

  const mockQueueRecordValidator = {
    validateMessage: jest.fn(() => ({ isValid: true, errorMessage: null })),
  };

  const mockCompleteDelivered = jest.fn();
  const mockCompleteNonDelivered = jest.fn();
  const serviceBusMessages: Partial<StatusServiceBusMessage>[] = [...queueRecords.slice(0, config.error.status.messageLimit).map((queueRecord) => {
    const cache = {
      0: mockCompleteDelivered,
      1: mockCompleteNonDelivered,
    };
    return {
      body: queueRecord,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      complete: cache[queueRecord.id],
      deadLetter: jest.fn(),
    };
  })];

  Container.get = jest.fn((library: string) => {
    const stored = {
      datatransformer: mockDefaultDataTransformer,
      'request:queue:client': mockRequestClient,
      'status:queue:client': mockStatusClient,
      'validator:queuerecord': mockQueueRecordValidator,
      logger: mockedLogger,
      crm: mockCRM,
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    return stored[library];
  }) as jest.Mock;

  const statusQueueProcessor = new StatusQueueProcessor(mockedContext);

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processQueue', () => {
    test('retrieves messages from status queue', async () => {
      const messages = await statusQueueProcessor.retrieveMessages();

      expect(mockStatusClientReceiver.receiveMessages).toHaveBeenCalledWith(config.error.status.messageLimit, config.error.status.maxWaitTimeInSeconds);
      expect(messages.length).toBe(Math.min(config.error.status.messageLimit, queueRecords.length));
    });

    test('process retrieved messages', async () => {
      const originalProcessQueue = statusQueueProcessor.processQueue;
      const mockProcessQueue = jest.fn();
      statusQueueProcessor.processQueue = mockProcessQueue;

      await statusQueueProcessor.processQueue();

      expect(mockProcessQueue).toHaveBeenCalled();
      statusQueueProcessor.processQueue = originalProcessQueue;
    });

    test('emits NOTIF_Status_FAIL_READ_QUEUE event if failing to get messages from status queue', async () => {
      mockStatusClient.createReceiver.mockImplementationOnce(() => {
        throw new Error('Unknown error');
      });

      await expect(() => statusQueueProcessor.retrieveMessages())
        .rejects.toThrow();

      expect(mockedLogger.logEvent).toBeCalledWith(
        expect.objectContaining({}),
        BusinessTelemetryEvent.NOTIF_STATUS_FAIL_READ_QUEUE,
      );
    });

    test('emits NOTIF_Status_FAIL_CHECK event if failing to get status from notify', async () => {
      const serviceBusMessage: any = serviceBusMessages[0];
      mockGetStatus.mockImplementation(() => Promise.reject(new Error('unknown error')));

      await expect(statusQueueProcessor.checkMessage(serviceBusMessage))
        .rejects.toThrow();

      expect(NotifyController.getStatus).toBeCalled();
      expect(mockedLogger.logEvent).toBeCalledWith(
        expect.objectContaining({}),
        BusinessTelemetryEvent.NOTIF_STATUS_FAIL_CHECK,
        'Notification Status failed to communicate with Gov Notify',
      );
    });

    describe('for email statuses', () => {
      test('completes message and forwards status to CRM if status from notify is in a completed state: Delivered', async () => {
        const serviceBusMessage = serviceBusMessages[0] as StatusServiceBusMessage;
        serviceBusMessage.body.status = Status.DELIVERED;
        const updatedQueueRecord = { ...serviceBusMessage.body, status: Status.DELIVERED };
        mockGetStatus.mockImplementation(() => Promise.resolve(Status.DELIVERED));

        await statusQueueProcessor.checkMessage(serviceBusMessage);

        expect(serviceBusMessage.complete).toHaveBeenCalledWith();
        expect(mockCRM.sendNotificationStatus).toHaveBeenCalledWith(mockedContext, updatedQueueRecord, CRMStatus.DELIVERED);
      });

      test('send a queue record to status queue if status from notify is in a pending state: Sending', async () => {
        const serviceBusMessage = serviceBusMessages[0] as StatusServiceBusMessage;
        serviceBusMessage.body.status = Status.SENDING;
        const updatedQueueRecord = { ...serviceBusMessage.body, status: Status.SENDING };
        mockGetStatus.mockImplementation(() => Promise.resolve(Status.SENDING));

        await statusQueueProcessor.checkMessage(serviceBusMessage);

        expect(mockStatusClient.createSender).toHaveBeenCalled();
        expect(mockDefaultDataTransformer.encode).toHaveBeenCalled();
        expect(mockStatusClientSender.scheduleMessage).toHaveBeenCalled();
        expect(mockCRM.sendNotificationStatus).toHaveBeenCalledWith(mockedContext, updatedQueueRecord, CRMStatus.ACCEPTED);
        expect(mockStatusClientSender.scheduleMessage)
          .toHaveBeenCalledWith(new Date(globalDate.getTime() + config.error.status.retryDelay), expect.objectContaining({ body: updatedQueueRecord }));
      });

      test('send a queue record to status queue if status from notify is in a pending state: Created', async () => {
        const serviceBusMessage = serviceBusMessages[0] as StatusServiceBusMessage;
        serviceBusMessage.body.status = Status.CREATED;
        const updatedQueueRecord = { ...serviceBusMessage.body, status: Status.CREATED };
        mockGetStatus.mockImplementation(() => Promise.resolve(Status.CREATED));

        await statusQueueProcessor.checkMessage(serviceBusMessage);

        expect(mockStatusClient.createSender).toHaveBeenCalled();
        expect(mockDefaultDataTransformer.encode).toHaveBeenCalled();
        expect(mockStatusClientSender.scheduleMessage).toHaveBeenCalled();
        expect(mockCRM.sendNotificationStatus).toHaveBeenCalledWith(mockedContext, updatedQueueRecord, CRMStatus.ACCEPTED);
        expect(mockStatusClientSender.scheduleMessage).toHaveBeenCalledWith(new Date(globalDate.getTime() + config.error.status.retryDelay), expect.objectContaining({ body: updatedQueueRecord }));
      });

      test('completes message and sends failure status to CRM if status from notify is: permanent-failure', async () => {
        const serviceBusMessage = serviceBusMessages[0] as StatusServiceBusMessage;
        mockGetStatus.mockImplementation(() => Promise.resolve(Status.PERMANENT_FAILURE));

        await statusQueueProcessor.checkMessage(serviceBusMessage);

        expect(serviceBusMessage.complete).toHaveBeenCalled();
        expect(mockCRM.sendNotificationStatus).toHaveBeenCalledWith(mockedContext, serviceBusMessage.body, CRMStatus.PERMANENT_FAILURE);
      });

      test('performs validation on successful requests', async () => {
        const serviceBusMessage: any = serviceBusMessages[0];
        mockQueueRecordValidator.validateMessage.mockImplementationOnce(() => ({ isValid: true, errorMessage: null }));

        await statusQueueProcessor.checkMessage(serviceBusMessage);

        expect(mockQueueRecordValidator.validateMessage).toHaveBeenCalled();
        expect(mockGetStatus).toHaveBeenCalled();
      });

      test('performs validation on invalid requests', async () => {
        const emailServiceBusMessage: Partial<StatusServiceBusMessage> = { body: { ...buildEmailQueueRecord(), id: '1' }, complete: jest.fn() };
        emailServiceBusMessage.body.email.email_address = 'invalid';
        mockQueueRecordValidator.validateMessage.mockImplementationOnce(() => ({ isValid: false, errorMessage: null }));

        await statusQueueProcessor.checkMessage(emailServiceBusMessage as StatusServiceBusMessage);

        expect(mockQueueRecordValidator.validateMessage).toHaveBeenCalled();
        expect(mockGetStatus).not.toHaveBeenCalled();
      });

      describe('technical-failure', () => {
        test('increments no_of_retries and sends queue record to request queue', async () => {
          const [serviceBusMessage] = serviceBusMessages;
          const queueRecord: QueueRecord = serviceBusMessage.body;
          queueRecord.no_of_retries = 0;
          mockGetStatus.mockImplementation(() => Promise.resolve(Status.TECHNICAL_FAILURE));

          await statusQueueProcessor.checkMessage(serviceBusMessage as StatusServiceBusMessage);

          expect(queueRecord.no_of_retries).toEqual(1);
          expect(serviceBusMessage.complete).toHaveBeenCalled();
          expect(mockRequestClient.createSender).toHaveBeenCalled();
          expect(mockDefaultDataTransformer.encode).toHaveBeenCalled();
          expect(mockRequestSender.scheduleMessage).toHaveBeenCalled();
        });

        test('completes message and sends failure status to CRM when no_of_retries reaches 5', async () => {
          const [serviceBusMessage] = serviceBusMessages;
          const queueRecord: QueueRecord = serviceBusMessage.body;
          queueRecord.no_of_retries = 5;
          mockGetStatus.mockImplementation(() => Promise.resolve(Status.TECHNICAL_FAILURE));

          await statusQueueProcessor.checkMessage(serviceBusMessage as StatusServiceBusMessage);
          expect(queueRecord.no_of_retries).toEqual(5);
          expect(serviceBusMessage.complete).toHaveBeenCalled();
          expect(mockDefaultDataTransformer.encode).not.toHaveBeenCalled();
          expect(mockRequestClient.createSender).not.toHaveBeenCalled();
          expect(mockCRM.sendNotificationStatus).toHaveBeenCalledWith(mockedContext, serviceBusMessage.body, CRMStatus.DELIVERY_FAILURE);
        });
      });

      describe('temporary-failure', () => {
        test('increments no_of_retries and sends queue record to request queue', async () => {
          const [serviceBusMessage] = serviceBusMessages;
          const queueRecord: QueueRecord = serviceBusMessage.body;
          queueRecord.no_of_retries = 4;
          mockGetStatus.mockImplementation(() => Promise.resolve(Status.TEMPORARY_FAILURE));

          await statusQueueProcessor.checkMessage(serviceBusMessage as StatusServiceBusMessage);

          expect(queueRecord.no_of_retries).toEqual(5);
          expect(serviceBusMessage.complete).toHaveBeenCalled();
          expect(mockRequestClient.createSender).toHaveBeenCalled();
          expect(mockDefaultDataTransformer.encode).toHaveBeenCalled();
          expect(mockRequestSender.scheduleMessage).toHaveBeenCalled();
        });

        test('completes message and sends failure status to CRM when no_of_retries reaches 5', async () => {
          const [serviceBusMessage] = serviceBusMessages;
          const queueRecord: QueueRecord = serviceBusMessage.body;
          queueRecord.no_of_retries = 5;
          mockGetStatus.mockImplementation(() => Promise.resolve(Status.TEMPORARY_FAILURE));

          await statusQueueProcessor.checkMessage(serviceBusMessage as StatusServiceBusMessage);
          expect(queueRecord.no_of_retries).toEqual(5);
          expect(serviceBusMessage.complete).toHaveBeenCalled();
          expect(mockDefaultDataTransformer.encode).not.toHaveBeenCalled();
          expect(mockRequestClient.createSender).not.toHaveBeenCalled();
          expect(mockCRM.sendNotificationStatus).toHaveBeenCalledWith(mockedContext, serviceBusMessage.body, CRMStatus.DELIVERY_FAILURE);
        });
      });
    });

    describe('for letter statuses', () => {
      test('completes message and forwards status to CRM if status from notify is in a completed state: Received', async () => {
        const serviceBusMessage = serviceBusMessages[0];
        serviceBusMessage.body.status = Status.RECEIVED;
        serviceBusMessage.body.message_type = MessageType.LETTER;
        const updatedQueueRecord = { ...serviceBusMessage.body };
        mockGetStatus.mockImplementation(() => Promise.resolve(Status.RECEIVED));

        await statusQueueProcessor.checkMessage(serviceBusMessage as StatusServiceBusMessage);

        expect(serviceBusMessage.complete).toHaveBeenCalledWith();
        expect(mockCRM.sendNotificationStatus).toHaveBeenCalledWith(mockedContext, updatedQueueRecord, CRMStatus.DELIVERED);
      });

      test('send a queue record back to the status queue if status from notify is in a pending state: Accepted', async () => {
        const serviceBusMessage = serviceBusMessages[0];
        serviceBusMessage.body.status = Status.ACCEPTED;
        serviceBusMessage.body.message_type = MessageType.LETTER;
        const updatedQueueRecord = { ...serviceBusMessage.body };
        mockGetStatus.mockImplementation(() => Promise.resolve(Status.ACCEPTED));

        await statusQueueProcessor.checkMessage(serviceBusMessage as StatusServiceBusMessage);

        expect(mockStatusClient.createSender).toHaveBeenCalled();
        expect(mockDefaultDataTransformer.encode).toHaveBeenCalled();
        expect(mockStatusClientSender.scheduleMessage).toHaveBeenCalledWith(new Date(globalDate.getTime() + config.error.status.retryDelay), expect.objectContaining({ body: updatedQueueRecord }));
        expect(mockCRM.sendNotificationStatus).toHaveBeenCalledWith(mockedContext, updatedQueueRecord, CRMStatus.ACCEPTED);
      });

      describe('technical-failure', () => {
        test('increments no_of_retries and sends queue record to request queue', async () => {
          const [serviceBusMessage] = serviceBusMessages.filter((sb) => sb.body.message_type === MessageType.LETTER);
          const queueRecord: QueueRecord = serviceBusMessage.body;
          queueRecord.no_of_retries = 0;
          mockGetStatus.mockImplementation(() => Promise.resolve(Status.TECHNICAL_FAILURE));

          await statusQueueProcessor.checkMessage(serviceBusMessage as StatusServiceBusMessage);

          expect(queueRecord.no_of_retries).toEqual(1);
          expect(mockRequestClient.createSender).toHaveBeenCalled();
          expect(mockDefaultDataTransformer.encode).toHaveBeenCalled();
          expect(mockRequestSender.scheduleMessage).toHaveBeenCalled();
        });

        test('completes message and sends failure status to CRM when no_of_retries reaches 5', async () => {
          const [serviceBusMessage] = serviceBusMessages.filter((sb) => sb.body.message_type === MessageType.LETTER);
          const queueRecord: QueueRecord = serviceBusMessage.body;
          queueRecord.no_of_retries = 5;
          mockGetStatus.mockImplementation(() => Promise.resolve(Status.TECHNICAL_FAILURE));

          await statusQueueProcessor.checkMessage(serviceBusMessage as StatusServiceBusMessage);

          expect(queueRecord.no_of_retries).toEqual(5);
          expect(serviceBusMessage.complete).toHaveBeenCalled();
          expect(mockDefaultDataTransformer.encode).not.toHaveBeenCalled();
          expect(mockRequestClient.createSender).not.toHaveBeenCalled();
          expect(mockCRM.sendNotificationStatus).toHaveBeenCalledWith(mockedContext, serviceBusMessage.body, CRMStatus.DELIVERY_FAILURE);
        });
      });

      describe('failed', () => {
        test('increments no_of_retries and sends queue record to request queue', async () => {
          const [serviceBusMessage] = serviceBusMessages.filter((sb) => sb.body.message_type === MessageType.LETTER);
          const queueRecord: QueueRecord = serviceBusMessage.body;
          queueRecord.no_of_retries = 4;
          mockGetStatus.mockImplementation(() => Promise.resolve(Status.FAILED));

          await statusQueueProcessor.checkMessage(serviceBusMessage as StatusServiceBusMessage);
          expect(queueRecord.no_of_retries).toEqual(5);
          expect(mockRequestClient.createSender).toHaveBeenCalled();
          expect(mockDefaultDataTransformer.encode).toHaveBeenCalled();
          expect(mockRequestSender.scheduleMessage).toHaveBeenCalled();
        });

        test('completes message and sends failure status to CRM when no_of_retries reaches 5', async () => {
          const [serviceBusMessage] = serviceBusMessages;
          const queueRecord: QueueRecord = serviceBusMessage.body;
          queueRecord.no_of_retries = 5;
          mockGetStatus.mockImplementation(() => Promise.resolve(Status.FAILED));

          await statusQueueProcessor.checkMessage(serviceBusMessage as StatusServiceBusMessage);
          expect(queueRecord.no_of_retries).toEqual(5);
          expect(serviceBusMessage.complete).toHaveBeenCalled();
          expect(mockDefaultDataTransformer.encode).not.toHaveBeenCalled();
          expect(mockRequestClient.createSender).not.toHaveBeenCalled();
          expect(mockCRM.sendNotificationStatus).toHaveBeenCalledWith(mockedContext, serviceBusMessage.body, CRMStatus.DELIVERY_FAILURE);
        });
      });
    });
  });
});
