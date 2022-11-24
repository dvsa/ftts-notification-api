import { MessagingError } from '@azure/service-bus';

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
    await httpTrigger(mockedContext, {} as any);

    expect(loaders).toHaveBeenCalled();
  });

  test('Request is handled via SendNotification Controller', async () => {
    await httpTrigger(mockedContext, {} as any);

    expect(SendNotificationController).toHaveBeenCalled();
    expect(SendNotificationController.prototype.sendEmail).toHaveBeenCalledWith(mockedContext);
  });

  test('service bus error is caught', async () => {
    const messagingError = new MessagingError('mock service bus error');
    SendNotificationController.prototype.sendEmail = jest.fn().mockImplementation(async () => Promise.reject(messagingError));

    await expect(httpTrigger(mockedContext, {} as any)).rejects.toThrow(messagingError);
  });
});
