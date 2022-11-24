import { Receiver, SendableMessageInfo, Sender } from '@azure/service-bus';
import { StatusQueueClient } from '../../../src/queues/status-queue-client';

const mockSender = {
  send: jest.fn(),
  scheduleMessage: jest.fn(),
};
const mockReceiver = {
  receiveMessages: jest.fn(),
};

jest.mock('../../../src/config', () => ({
  error: {
    status: {
      messageLimit: 50,
      maxWaitTimeInSeconds: 5,
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
  },
}));

describe('StatusQueueClient wrapper', () => {
  let statusQueueClient: StatusQueueClient;

  beforeEach(() => {
    statusQueueClient = new StatusQueueClient(mockSender as any as Sender, mockReceiver as any as Receiver);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendMessage', () => {
    test('sends the given message', async () => {
      const mockMessage: SendableMessageInfo = { body: 'some message' };

      await statusQueueClient.sendMessage(mockMessage);

      expect(mockSender.send).toHaveBeenCalledWith(mockMessage);
    });
  });

  describe('scheduleMessage', () => {
    test('schedules the given message at the given time', async () => {
      const mockRetryTime = new Date();
      const mockMessage: SendableMessageInfo = { body: 'some message' };

      await statusQueueClient.scheduleMessage(mockRetryTime, mockMessage);

      expect(mockSender.scheduleMessage).toHaveBeenCalledWith(mockRetryTime, mockMessage);
    });
  });

  describe('receiveMessages', () => {
    test('receives messages passing in correct config', async () => {
      const mockMessages = [{ body: 'something' }];
      mockReceiver.receiveMessages.mockReturnValue(mockMessages);

      const result = await statusQueueClient.receiveMessages();

      expect(result).toStrictEqual(mockMessages);
      expect(mockReceiver.receiveMessages).toHaveBeenCalledWith(50, 5);
    });
  });
});
