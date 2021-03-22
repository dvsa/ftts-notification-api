import { Container } from 'typedi';

import NotifySender from '../../../src/sender/sender';
import config from '../../../src/config';
import { NotifySendError } from '../../../src/lib/errors';
import { emailQueueRecord } from '../../mocks/sender';
import { mockedContext } from '../../mocks/context.mock';
import { mockedLogger } from '../../mocks/logger.mock';
import { BusinessTelemetryEvent } from '../../../src/utils/logger';
import { QueueRecord } from '../../../src/interfaces/queue';
import { globalDate } from '../../mocks/date.mock';

jest.mock('notifications-node-client');
jest.mock('typedi');
jest.mock('@azure/service-bus');
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/external/notify-client/notify-client');
jest.mock('../../../src/utils/queue-record-validator');
jest.mock('../../../src/interfaces/validate-response');
jest.mock('../../../src/config', () => ({
  error: {
    request: {
      retryCount: 2,
      retryDelay: 5000,
    },
  },
}));

describe('Sender - processMessage', () => {
  const buildMockMessage = () => emailQueueRecord;

  const mockNotificationId = '123456';
  const mockNotifyController = {
    sendNotification: jest.fn(() => Promise.resolve(mockNotificationId)),
  };

  const mockRequestQueueClient = {
    createSender: jest.fn(() => mockRequestQueueSender),
  };

  const mockRequestQueueSender = {
    scheduleMessage: jest.fn(),
  };

  const mockStatusQueueClient = {
    createSender: jest.fn(() => mockStatusQueueSender),
  };

  const mockStatusQueueSender = {
    send: jest.fn(),
  };

  const mockDataTransformer = {
    encode: jest.fn((message: QueueRecord) => message),
  };

  const mockQueueRecordValidator = {
    validateMessage: jest.fn(() => ({ isValid: true, errorMessage: null })),
  };

  Container.get = jest.fn((library: any) => {
    const stored = {
      'notify:controller': mockNotifyController,
      'request:queue:client': mockRequestQueueClient,
      'status:queue:client': mockStatusQueueClient,
      'validator:queuerecord': mockQueueRecordValidator,
      datatransformer: mockDataTransformer,
      logger: mockedLogger,
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    return stored[library];
  });
  const sender: NotifySender = new NotifySender(mockedContext);

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('send a message and put it on the status queue with request retry count reset', async () => {
    const message = {
      ...buildMockMessage(),
      no_of_request_retries: 1,
    };
    const expectedStatusQueueRecord = {
      body: {
        ...message,
        no_of_request_retries: 0,
        id: mockNotificationId,
      },
    };

    await sender.processMessage(message);

    expect(mockNotifyController.sendNotification).toHaveBeenCalledWith(message);
    expect(mockStatusQueueSender.send).toHaveBeenCalledWith(expect.objectContaining({
      ...expectedStatusQueueRecord,
    }));
  });

  test('performs validation on successful requests', async () => {
    const request = {
      ...emailQueueRecord,
    };
    mockQueueRecordValidator.validateMessage.mockImplementationOnce(() => ({ isValid: true, errorMessage: null }));

    await sender.processMessage(request);

    expect(mockQueueRecordValidator.validateMessage).toHaveBeenCalled();
    expect(mockNotifyController.sendNotification).toHaveBeenCalled();
  });

  test('performs validation on invalid requests', async () => {
    const request = {
      ...emailQueueRecord,
    };
    request.target = 'AL';
    mockQueueRecordValidator.validateMessage.mockImplementationOnce(() => ({ isValid: false, errorMessage: null }));

    await sender.processMessage(request);

    expect(mockQueueRecordValidator.validateMessage).toHaveBeenCalled();
    expect(mockNotifyController.sendNotification).not.toHaveBeenCalled();
  });

  describe('if there is a NotifySendError trying to send a message', () => {
    beforeEach(() => {
      mockNotifyController.sendNotification.mockImplementationOnce(() => Promise.reject(new NotifySendError()));
    });

    describe('if the max number of retries has been reached', () => {
      test('throw an error to abandon the message', async () => {
        const message = {
          ...buildMockMessage(),
          no_of_request_retries: config.error.request.retryCount,
        };

        await expect(sender.processMessage(message)).rejects.toBeInstanceOf(Error);
        expect(mockRequestQueueSender.scheduleMessage).toHaveBeenCalledTimes(0);
      });
    });

    describe('if the max number of retries has *not* been reached', () => {
      test('schedule a clone of the message with retry count incremented', async () => {
        const message = {
          ...buildMockMessage(),
          no_of_request_retries: 0,
        };
        const expectedClonedMessage = {
          ...message,
          no_of_request_retries: 1,
        };

        await sender.processMessage(message);

        expect(mockRequestQueueSender.scheduleMessage).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ body: expectedClonedMessage }),
        );
      });

      test('schedule a clone of the message with retry delay a multiple of the retry count', async () => {
        const message = {
          ...buildMockMessage(),
          no_of_request_retries: 1,
        };
        const expectedRetryDelay = config.error.request.retryDelay * 2;

        await sender.processMessage(message);

        expect(mockRequestQueueSender.scheduleMessage).toHaveBeenCalledWith(
          new Date(globalDate.getTime() + expectedRetryDelay),
          expect.anything(),
        );
      });
    });
  });

  describe('if there is some other unknown error trying to send a message', () => {
    test('rethrow the error', async () => {
      const message = buildMockMessage();
      const mockError = new Error();
      mockNotifyController.sendNotification.mockImplementationOnce(() => Promise.reject(mockError));

      await expect(sender.processMessage(message)).rejects.toEqual(mockError);
    });

    test('if govnotify errors, emit event FAIL_SEND', async () => {
      const message = buildMockMessage();
      const mockError = new NotifySendError();
      mockNotifyController.sendNotification.mockImplementationOnce(() => Promise.reject(mockError));

      await sender.processMessage(message);

      expect(mockedLogger.logEvent).toHaveBeenCalledWith(mockedContext, BusinessTelemetryEvent.NOTIF_SENDER_FAIL_SEND, expect.any(String));
    });

    test('if sending to status queue fails, emit event FAIL_WRITE_QUEUE', async () => {
      const message = buildMockMessage();
      const mockError = new Error();
      mockStatusQueueSender.send.mockImplementationOnce(() => Promise.reject(mockError));

      await expect(sender.processMessage(message)).rejects.toEqual(mockError);

      expect(mockedLogger.logEvent).toHaveBeenCalledWith(mockedContext, BusinessTelemetryEvent.NOTIF_SENDER_FAIL_WRITE_QUEUE, expect.any(String));
    });
  });
});
