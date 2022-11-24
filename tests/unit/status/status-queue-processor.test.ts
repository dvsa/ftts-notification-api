import { mocked } from 'ts-jest/utils';
import { Container } from 'typedi';
import config from '../../../src/config';
import { NotifyController } from '../../../src/external';
import { QueueRecord, StatusServiceBusMessage } from '../../../src/interfaces/queue';
import { CRMStatus, MessageType, Status } from '../../../src/lib/enums';
import StatusQueueProcessor from '../../../src/status/status-queue-processor';
import { BusinessTelemetryEvent } from '../../../src/utils/logger';
import { mockedContext } from '../../mocks/context.mock';
import { globalDate } from '../../mocks/date.mock';
import { mockedLogger } from '../../mocks/logger.mock';
import { buildEmailQueueRecord, statusQueueRecords } from '../../mocks/queue-records';
import { RequestQueueClient } from '../../../src/queues/request-queue-client';
import { StatusQueueClient } from '../../../src/queues/status-queue-client';

jest.mock('typedi');
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/external/crm/crm');
jest.mock('../../../src/utils/queue-record-validator');
jest.mock('@azure/service-bus');
jest.mock('../../../src/config', () => ({
  error: {
    status: {
      retryCount: 5,
      retryDelay: 2000,
      messageLimit: 5,
    },
  },
  serviceBus: {
    apiConnectionString: 'mockSbConnectionString',
  },
  queues: {
    notificationRequest: {
      name: 'mockNtfRequestQueue',
    },
    notificationStatus: {
      name: 'mockNtfStatusQueue',
    },
    crmResult: {
      name: 'mockCrmResultQueue',
    },
  },
}));
jest.mock('../../../src/queues/request-queue-client');
const mockedRequestQueueClient = mocked(RequestQueueClient, true);
jest.mock('../../../src/queues/status-queue-client');
const mockedStatusQueueClient = mocked(StatusQueueClient, true);

const queueRecords = [...statusQueueRecords.map((queueRecord, index) => ({
  ...queueRecord,
  id: String(index),
}))];

describe('StatusQueueProcessor', () => {
  const mockGetStatusResponse = jest.spyOn(NotifyController, 'getStatusResponse');
  mockGetStatusResponse.mockImplementation(() => Promise.resolve({ status: Status.RECEIVED }));

  const mockCRM = {
    sendNotificationStatus: jest.fn(() => Promise.resolve({ successful: true })),
  };

  const mockDefaultDataTransformer = { decode: jest.fn((x: QueueRecord) => x), encode: jest.fn((x: QueueRecord) => x) };

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
      'validator:queuerecord': mockQueueRecordValidator,
      logger: mockedLogger,
      crm: mockCRM,
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    return stored[library];
  }) as jest.Mock;

  const statusQueueProcessor = new StatusQueueProcessor(mockedContext);

  beforeAll(() => {
    mockedStatusQueueClient.prototype.receiveMessages.mockResolvedValue(serviceBusMessages as any as StatusServiceBusMessage[]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processQueue', () => {
    test('retrieves messages from status queue', async () => {
      const messages = await statusQueueProcessor.retrieveMessages();

      expect(mockedStatusQueueClient.prototype.receiveMessages).toHaveBeenCalled();
      expect(messages).toHaveLength(Math.min(config.error.status.messageLimit, queueRecords.length));
    });

    test('process retrieved messages', async () => {
      // eslint-disable-next-line jest/unbound-method
      const originalProcessQueue = statusQueueProcessor.processQueue;
      const mockProcessQueue = jest.fn();
      statusQueueProcessor.processQueue = mockProcessQueue;

      await statusQueueProcessor.processQueue();

      expect(mockProcessQueue).toHaveBeenCalled();
      statusQueueProcessor.processQueue = originalProcessQueue;
    });

    test('emits NOTIF_Status_FAIL_READ_QUEUE event if failing to get messages from status queue', async () => {
      mockedStatusQueueClient.prototype.receiveMessages.mockImplementationOnce(() => {
        throw new Error('Unknown error');
      });

      await expect(() => statusQueueProcessor.retrieveMessages())
        .rejects.toThrow();

      expect(mockedLogger.event).toHaveBeenCalledWith(
        BusinessTelemetryEvent.NOTIF_STATUS_FAIL_READ_QUEUE,
      );
    });

    test('emits NOTIF_Status_FAIL_CHECK event if failing to get status from notify', async () => {
      const serviceBusMessage: any = serviceBusMessages[0];
      mockGetStatusResponse.mockImplementation(() => Promise.reject(new Error('unknown error')));

      await expect(statusQueueProcessor.checkMessage(serviceBusMessage as StatusServiceBusMessage))
        .rejects.toThrow();

      expect(NotifyController.getStatusResponse).toHaveBeenCalled();
      expect(mockedLogger.event).toHaveBeenCalledWith(
        BusinessTelemetryEvent.NOTIF_STATUS_FAIL_CHECK,
        'StatusQueueProcessor::getStatusResponse: Notification Status failed to communicate with Gov Notify',
        expect.objectContaining(
          {
            id: '0',
          },
        ),
      );
    });

    describe('for email statuses', () => {
      test('completes message and forwards status to CRM if status from notify is in a completed state: Delivered', async () => {
        const serviceBusMessage = serviceBusMessages[0] as StatusServiceBusMessage;
        serviceBusMessage.body.status = Status.DELIVERED;
        const updatedQueueRecord = { ...serviceBusMessage.body, status: Status.DELIVERED };
        mockGetStatusResponse.mockImplementation(() => Promise.resolve({ status: Status.DELIVERED }));

        await statusQueueProcessor.checkMessage(serviceBusMessage);

        expect(serviceBusMessage.complete).toHaveBeenCalledWith();
        expect(mockCRM.sendNotificationStatus).toHaveBeenCalledWith(mockedContext, updatedQueueRecord, CRMStatus.DELIVERED);
      });

      test('send a queue record to status queue if status from notify is in a pending state: Sending', async () => {
        const serviceBusMessage = serviceBusMessages[0] as StatusServiceBusMessage;
        serviceBusMessage.body.status = Status.SENDING;
        const updatedQueueRecord = { ...serviceBusMessage.body, status: Status.SENDING };
        mockGetStatusResponse.mockImplementation(() => Promise.resolve({ status: Status.SENDING }));

        await statusQueueProcessor.checkMessage(serviceBusMessage);

        expect(mockDefaultDataTransformer.encode).toHaveBeenCalled();
        expect(mockedStatusQueueClient.prototype.scheduleMessage).toHaveBeenCalled();
        expect(mockCRM.sendNotificationStatus).toHaveBeenCalledWith(mockedContext, updatedQueueRecord, CRMStatus.ACCEPTED);
        expect(mockedStatusQueueClient.prototype.scheduleMessage)
          .toHaveBeenCalledWith(new Date(globalDate.getTime() + config.error.status.retryDelay), expect.objectContaining({ body: updatedQueueRecord }));
      });

      test('send a queue record to status queue if status from notify is in a pending state: Created', async () => {
        const serviceBusMessage = serviceBusMessages[0] as StatusServiceBusMessage;
        serviceBusMessage.body.status = Status.CREATED;
        const updatedQueueRecord = { ...serviceBusMessage.body, status: Status.CREATED };
        mockGetStatusResponse.mockImplementation(() => Promise.resolve({ status: Status.CREATED }));

        await statusQueueProcessor.checkMessage(serviceBusMessage);

        expect(mockDefaultDataTransformer.encode).toHaveBeenCalled();
        expect(mockedStatusQueueClient.prototype.scheduleMessage).toHaveBeenCalled();
        expect(mockCRM.sendNotificationStatus).toHaveBeenCalledWith(mockedContext, updatedQueueRecord, CRMStatus.ACCEPTED);
        expect(mockedStatusQueueClient.prototype.scheduleMessage).toHaveBeenCalledWith(new Date(globalDate.getTime() + config.error.status.retryDelay), expect.objectContaining({ body: updatedQueueRecord }));
      });

      test('completes message and sends failure status to CRM if status from notify is: permanent-failure', async () => {
        const serviceBusMessage = serviceBusMessages[0] as StatusServiceBusMessage;
        mockGetStatusResponse.mockImplementation(() => Promise.resolve({ status: Status.PERMANENT_FAILURE }));

        await statusQueueProcessor.checkMessage(serviceBusMessage);

        expect(serviceBusMessage.complete).toHaveBeenCalled();
        expect(mockCRM.sendNotificationStatus).toHaveBeenCalledWith(mockedContext, serviceBusMessage.body, CRMStatus.PERMANENT_FAILURE);
      });

      test('performs validation on successful requests', async () => {
        const serviceBusMessage: any = serviceBusMessages[0];
        mockQueueRecordValidator.validateMessage.mockImplementationOnce(() => ({ isValid: true, errorMessage: null }));

        await statusQueueProcessor.checkMessage(serviceBusMessage as StatusServiceBusMessage);

        expect(mockQueueRecordValidator.validateMessage).toHaveBeenCalled();
        expect(mockGetStatusResponse).toHaveBeenCalled();
      });

      test('performs validation on invalid requests', async () => {
        const emailServiceBusMessage: Partial<StatusServiceBusMessage> = { body: { ...buildEmailQueueRecord(), id: '1' }, complete: jest.fn() };
        emailServiceBusMessage.body.email.email_address = 'invalid';
        mockQueueRecordValidator.validateMessage.mockImplementationOnce(() => ({ isValid: false, errorMessage: null }));

        await statusQueueProcessor.checkMessage(emailServiceBusMessage as StatusServiceBusMessage);

        expect(mockQueueRecordValidator.validateMessage).toHaveBeenCalled();
        expect(mockGetStatusResponse).not.toHaveBeenCalled();
      });

      describe('technical-failure', () => {
        test('increments no_of_retries and sends queue record to request queue', async () => {
          const [serviceBusMessage] = serviceBusMessages;
          const queueRecord: QueueRecord = serviceBusMessage.body;
          queueRecord.no_of_retries = 0;
          mockGetStatusResponse.mockImplementation(() => Promise.resolve({ status: Status.TECHNICAL_FAILURE }));

          await statusQueueProcessor.checkMessage(serviceBusMessage as StatusServiceBusMessage);

          expect(queueRecord.no_of_retries).toBe(1);
          expect(serviceBusMessage.complete).toHaveBeenCalled();
          expect(mockDefaultDataTransformer.encode).toHaveBeenCalled();
          expect(mockedRequestQueueClient.prototype.scheduleMessage).toHaveBeenCalled();
        });

        test('completes message and sends failure status to CRM when no_of_retries reaches 5', async () => {
          const [serviceBusMessage] = serviceBusMessages;
          const queueRecord: QueueRecord = serviceBusMessage.body;
          queueRecord.no_of_retries = 5;
          mockGetStatusResponse.mockImplementation(() => Promise.resolve({ status: Status.TECHNICAL_FAILURE }));

          await statusQueueProcessor.checkMessage(serviceBusMessage as StatusServiceBusMessage);
          expect(queueRecord.no_of_retries).toBe(5);
          expect(serviceBusMessage.complete).toHaveBeenCalled();
          expect(mockDefaultDataTransformer.encode).not.toHaveBeenCalled();
          expect(mockedRequestQueueClient.prototype.scheduleMessage).not.toHaveBeenCalled();
          expect(mockCRM.sendNotificationStatus).toHaveBeenCalledWith(mockedContext, serviceBusMessage.body, CRMStatus.DELIVERY_FAILURE);
        });
      });

      describe('temporary-failure', () => {
        test('increments no_of_retries and sends queue record to request queue', async () => {
          const [serviceBusMessage] = serviceBusMessages;
          const queueRecord: QueueRecord = serviceBusMessage.body;
          queueRecord.no_of_retries = 4;
          mockGetStatusResponse.mockImplementation(() => Promise.resolve({ status: Status.TEMPORARY_FAILURE }));

          await statusQueueProcessor.checkMessage(serviceBusMessage as StatusServiceBusMessage);

          expect(queueRecord.no_of_retries).toBe(5);
          expect(serviceBusMessage.complete).toHaveBeenCalled();
          expect(mockDefaultDataTransformer.encode).toHaveBeenCalled();
          expect(mockedRequestQueueClient.prototype.scheduleMessage).toHaveBeenCalled();
        });

        test('completes message and sends failure status to CRM when no_of_retries reaches 5', async () => {
          const [serviceBusMessage] = serviceBusMessages;
          const queueRecord: QueueRecord = serviceBusMessage.body;
          queueRecord.no_of_retries = 5;
          mockGetStatusResponse.mockImplementation(() => Promise.resolve({ status: Status.TEMPORARY_FAILURE }));

          await statusQueueProcessor.checkMessage(serviceBusMessage as StatusServiceBusMessage);
          expect(queueRecord.no_of_retries).toBe(5);
          expect(serviceBusMessage.complete).toHaveBeenCalled();
          expect(mockDefaultDataTransformer.encode).not.toHaveBeenCalled();
          expect(mockedRequestQueueClient.prototype.scheduleMessage).not.toHaveBeenCalled();
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
        mockGetStatusResponse.mockImplementation(() => Promise.resolve({ status: Status.RECEIVED }));

        await statusQueueProcessor.checkMessage(serviceBusMessage as StatusServiceBusMessage);

        expect(serviceBusMessage.complete).toHaveBeenCalledWith();
        expect(mockCRM.sendNotificationStatus).toHaveBeenCalledWith(mockedContext, updatedQueueRecord, CRMStatus.DELIVERED);
      });

      test('send a queue record back to the status queue if status from notify is in a pending state: Accepted', async () => {
        const serviceBusMessage = serviceBusMessages[0];
        serviceBusMessage.body.status = Status.ACCEPTED;
        serviceBusMessage.body.message_type = MessageType.LETTER;
        const updatedQueueRecord = { ...serviceBusMessage.body };
        mockGetStatusResponse.mockImplementation(() => Promise.resolve({ status: Status.ACCEPTED }));

        await statusQueueProcessor.checkMessage(serviceBusMessage as StatusServiceBusMessage);

        expect(mockDefaultDataTransformer.encode).toHaveBeenCalled();
        expect(mockedStatusQueueClient.prototype.scheduleMessage).toHaveBeenCalledWith(new Date(globalDate.getTime() + config.error.status.retryDelay), expect.objectContaining({ body: updatedQueueRecord }));
        expect(mockCRM.sendNotificationStatus).toHaveBeenCalledWith(mockedContext, updatedQueueRecord, CRMStatus.ACCEPTED);
      });

      describe('technical-failure', () => {
        test('increments no_of_retries and sends queue record to request queue', async () => {
          const [serviceBusMessage] = serviceBusMessages.filter((sb) => sb.body.message_type === MessageType.LETTER);
          const queueRecord: QueueRecord = serviceBusMessage.body;
          queueRecord.no_of_retries = 0;
          mockGetStatusResponse.mockImplementation(() => Promise.resolve({ status: Status.TECHNICAL_FAILURE }));

          await statusQueueProcessor.checkMessage(serviceBusMessage as StatusServiceBusMessage);

          expect(queueRecord.no_of_retries).toBe(1);
          expect(mockDefaultDataTransformer.encode).toHaveBeenCalled();
          expect(mockedRequestQueueClient.prototype.scheduleMessage).toHaveBeenCalled();
        });

        test('completes message and sends failure status to CRM when no_of_retries reaches 5', async () => {
          const [serviceBusMessage] = serviceBusMessages.filter((sb) => sb.body.message_type === MessageType.LETTER);
          const queueRecord: QueueRecord = serviceBusMessage.body;
          queueRecord.no_of_retries = 5;
          mockGetStatusResponse.mockImplementation(() => Promise.resolve({ status: Status.TECHNICAL_FAILURE }));

          await statusQueueProcessor.checkMessage(serviceBusMessage as StatusServiceBusMessage);

          expect(queueRecord.no_of_retries).toBe(5);
          expect(serviceBusMessage.complete).toHaveBeenCalled();
          expect(mockDefaultDataTransformer.encode).not.toHaveBeenCalled();
          expect(mockedRequestQueueClient.prototype.scheduleMessage).not.toHaveBeenCalled();
          expect(mockCRM.sendNotificationStatus).toHaveBeenCalledWith(mockedContext, serviceBusMessage.body, CRMStatus.DELIVERY_FAILURE);
        });
      });

      describe('failed', () => {
        test('increments no_of_retries and sends queue record to request queue', async () => {
          const [serviceBusMessage] = serviceBusMessages.filter((sb) => sb.body.message_type === MessageType.LETTER);
          const queueRecord: QueueRecord = serviceBusMessage.body;
          queueRecord.no_of_retries = 4;
          mockGetStatusResponse.mockImplementation(() => Promise.resolve({ status: Status.FAILED }));

          await statusQueueProcessor.checkMessage(serviceBusMessage as StatusServiceBusMessage);
          expect(queueRecord.no_of_retries).toBe(5);
          expect(mockDefaultDataTransformer.encode).toHaveBeenCalled();
          expect(mockedRequestQueueClient.prototype.scheduleMessage).toHaveBeenCalled();
        });

        test('completes message and sends failure status to CRM when no_of_retries reaches 5', async () => {
          const [serviceBusMessage] = serviceBusMessages;
          const queueRecord: QueueRecord = serviceBusMessage.body;
          queueRecord.no_of_retries = 5;
          mockGetStatusResponse.mockImplementation(() => Promise.resolve({ status: Status.FAILED }));

          await statusQueueProcessor.checkMessage(serviceBusMessage as StatusServiceBusMessage);
          expect(queueRecord.no_of_retries).toBe(5);
          expect(serviceBusMessage.complete).toHaveBeenCalled();
          expect(mockDefaultDataTransformer.encode).not.toHaveBeenCalled();
          expect(mockedRequestQueueClient.prototype.scheduleMessage).not.toHaveBeenCalled();
          expect(mockCRM.sendNotificationStatus).toHaveBeenCalledWith(mockedContext, serviceBusMessage.body, CRMStatus.DELIVERY_FAILURE);
        });
      });
    });
  });
});
