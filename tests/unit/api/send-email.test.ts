import SendNotificationController from '../../../src/api/send-notification-controller';
import { httpTrigger } from '../../../src/api/send-email';
import loaders from '../../../src/loaders/index';
import { mockedContext } from '../../mocks/context.mock';

jest.mock('typedi');
jest.mock('../../../src/loaders/index');
jest.mock('../../../src/api/send-notification-controller');
jest.mock('../../../src/api/requests/email-request');
jest.mock('../../../src/api/requests/letter-request');

describe('Send Email Entrypoint', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('Loaders is run', async () => {
    await httpTrigger(mockedContext as any, {} as any);

    expect(loaders).toHaveBeenCalled();
  });

  test('Request is handled via SendNotification Controller', async () => {
    await httpTrigger(mockedContext as any, {} as any);

    expect(SendNotificationController).toHaveBeenCalled();
    expect(SendNotificationController.prototype.sendEmail).toHaveBeenCalledWith(mockedContext);
  });
});
