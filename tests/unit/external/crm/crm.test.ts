import { Container } from 'typedi';

import CRM from '../../../../src/external/crm/crm';
import { buildStatusQueueRecord } from '../../../mocks/queue-records';
import { CRMStatus } from '../../../../src/lib/enums';
import { mockedLogger } from '../../../mocks/logger.mock';
import { mockedContext } from '../../../mocks/context.mock';

describe('CRM', () => {
  const mockCrmQueueSender = { send: jest.fn() };
  const mockCrmQueueClient = { createSender: jest.fn(() => mockCrmQueueSender) };

  Container.get = jest.fn((library: any) => {
    const stored = {
      'crm:queue:client': mockCrmQueueClient,
      logger: mockedLogger,
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    return stored[library];
  });

  const crm: CRM = new CRM();

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendNotificationStatus', () => {
    test('send passed notification to CRM queue with CRM status set and trace_id removed', async () => {
      const mockMessage = buildStatusQueueRecord();
      const mockCrmStatus = CRMStatus.DELIVERED;
      const expectedMessage = {
        ...mockMessage,
        status: mockCrmStatus,
      };
      delete expectedMessage.trace_id;

      await crm.sendNotificationStatus(mockedContext, mockMessage, mockCrmStatus);

      expect(mockCrmQueueSender.send).toHaveBeenCalledWith(expect.objectContaining({ body: expectedMessage }));
    });

    test('send passed notification to CRM queue with CRM status set and trace_id removed', async () => {
      const mockMessage = buildStatusQueueRecord();
      const mockCrmStatus = CRMStatus.DELIVERED;
      const expectedMessage = {
        ...mockMessage,
        status: mockCrmStatus,
      };
      mockCrmQueueSender.send.mockImplementation(() => {
        throw Error();
      });
      delete expectedMessage.trace_id;

      await expect(crm.sendNotificationStatus(mockedContext, mockMessage, mockCrmStatus)).rejects.toThrow();
    });
  });
});
