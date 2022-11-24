import { Container } from 'typedi';
import NotifyController from '../../../../src/external/notify-client/notify-client';
import { Status } from '../../../../src/lib/enums';
import { buildStatusQueueRecord } from '../../../mocks/queue-records';

jest.mock('notifications-node-client');
jest.mock('typedi');
jest.mock('../../../../src/config', () => ({
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
}));

describe('Notify client - Check', () => {
  const mockLogger = {
    error: jest.fn(),
    log: jest.fn(),
    info: jest.fn(),
  };

  const mockNotifyClient = {
    getNotificationById: jest.fn((id) => {
      const data = {
        ...buildStatusQueueRecord(),
        status: id === '0' ? Status.DELIVERED : Status.PERMANENT_FAILURE,
      };
      delete data.target;
      return Promise.resolve({ data });
    }),
  };

  Container.get = jest.fn((library: string) => {
    const stored = {
      'notify:client:gb': mockNotifyClient,
      'notify:client:ni': mockNotifyClient,
      logger: mockLogger,
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    return stored[library];
  }) as jest.Mock;

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('status delivered received', async () => {
    const request = {
      ...buildStatusQueueRecord(),
      id: '0',
    };

    const { status } = await NotifyController.getStatusResponse(request.target, request.id);

    expect(status).toEqual(Status.DELIVERED);
    expect(mockNotifyClient.getNotificationById).toHaveBeenCalledWith(request.id);
  });

  test('status permanent failure received', async () => {
    const request = {
      ...buildStatusQueueRecord(),
      id: '1',
    };

    const { status } = await NotifyController.getStatusResponse(request.target, request.id);

    expect(status).toEqual(Status.PERMANENT_FAILURE);
    expect(mockNotifyClient.getNotificationById).toHaveBeenCalledWith(request.id);
  });
});
