import { SendableMessageInfo, Sender } from '@azure/service-bus';
import { RequestQueueClient } from '../../../src/queues/request-queue-client';

const mockSender = {
  send: jest.fn(),
  scheduleMessage: jest.fn(),
};

describe('RequestQueueClient wrapper', () => {
  let requestQueueClient: RequestQueueClient;

  beforeEach(() => {
    requestQueueClient = new RequestQueueClient(mockSender as any as Sender);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendMessage', () => {
    test('sends the given message then closes the connection', async () => {
      const mockMessage: SendableMessageInfo = { body: 'some message' };

      await requestQueueClient.sendMessage(mockMessage);

      expect(mockSender.send).toHaveBeenCalledWith(mockMessage);
    });
  });

  describe('scheduleMessage', () => {
    test('schedules the given message at the given time then closes the connection', async () => {
      const mockRetryTime = new Date();
      const mockMessage: SendableMessageInfo = { body: 'some message' };

      await requestQueueClient.scheduleMessage(mockRetryTime, mockMessage);

      expect(mockSender.scheduleMessage).toHaveBeenCalledWith(mockRetryTime, mockMessage);
    });
  });
});
