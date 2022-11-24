import { SendableMessageInfo, Sender } from '@azure/service-bus';
import { CRMQueueClient } from '../../../src/queues/crm-queue-client';

const mockSender = {
  send: jest.fn(),
};

describe('CRMQueueClient wrapper', () => {
  let crmQueueClient: CRMQueueClient;
  
  beforeEach(() => {
    crmQueueClient = new CRMQueueClient(mockSender as any as Sender);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendMessage', () => {
    test('sends the given message then closes the connection', async () => {
      const mockMessage: SendableMessageInfo = { body: 'some message' };

      await crmQueueClient.sendMessage(mockMessage);

      expect(mockSender.send).toHaveBeenCalledWith(mockMessage);
    });
  });
});
