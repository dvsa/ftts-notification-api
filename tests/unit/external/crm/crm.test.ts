import { mocked } from 'ts-jest/utils';
import { Container } from 'typedi';
import CRM from '../../../../src/external/crm/crm';
import { CRMStatus } from '../../../../src/lib/enums';
import { mockedContext } from '../../../mocks/context.mock';
import { mockedLogger } from '../../../mocks/logger.mock';
import { buildStatusQueueRecord } from '../../../mocks/queue-records';
import { CRMQueueClient } from '../../../../src/queues/crm-queue-client';
import config from '../../../../src/config';

jest.mock('../../../../src/config', () => ({
  serviceBus: {
    crmConnectionString: process.env.SERVICE_BUS_CONNECTION_STRING_CRM || '',
  },
  queues: {
    crmResult: {
      name: process.env.QUEUE_CRM_RESULT_NAME || '',
    },
    stubCrmResult: {
      name: process.env.QUEUE_CRM_STUB_RESULT_NAME || '',
    },
  },
  featureToggles: {
    sendToCrmQueue: true,
  },
}));
jest.mock('../../../../src/queues/crm-queue-client');
const mockedCRMQueueClient = mocked(CRMQueueClient, true);

describe('CRM', () => {
  Container.get = jest.fn((library: any) => {
    const stored = {
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

      expect(mockedCRMQueueClient.prototype.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ body: expectedMessage }));
    });

    test('if crm queue client fails to send message - throw the error', async () => {
      const mockMessage = buildStatusQueueRecord();
      const mockCrmStatus = CRMStatus.DELIVERED;
      const expectedMessage = {
        ...mockMessage,
        status: mockCrmStatus,
      };
      mockedCRMQueueClient.prototype.sendMessage.mockImplementation(() => {
        throw Error();
      });
      delete expectedMessage.trace_id;

      await expect(crm.sendNotificationStatus(mockedContext, mockMessage, mockCrmStatus)).rejects.toThrow();
    });
  });

  describe('sendNotificationStatus with sendToCrmQueue off', () => {
    test('messages are not sent to the CRM queue', async () => {
      config.featureToggles.sendToCrmQueue = false;
      const mockMessage = buildStatusQueueRecord();
      const mockCrmStatus = CRMStatus.DELIVERED;
      const expectedMessage = {
        ...mockMessage,
        status: mockCrmStatus,
      };
      delete expectedMessage.trace_id;

      await crm.sendNotificationStatus(mockedContext, mockMessage, mockCrmStatus);

      expect(mockedCRMQueueClient.prototype.sendMessage).not.toHaveBeenCalled();
    });
  });
});
