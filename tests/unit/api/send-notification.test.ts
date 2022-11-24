import { MessagingError } from '@azure/service-bus';
import { httpTrigger } from '../../../src/api/send-notification';
import SendNotificationController from '../../../src/api/send-notification-controller';
import loaders from '../../../src/loaders/index';
import { mockedContext } from '../../mocks/context.mock';
import { handleError } from '../../../src/utils/handleError';
import mocked = jest.mocked;

jest.mock('typedi');
jest.mock('../../../src/loaders/index');
jest.mock('../../../src/api/send-notification-controller');
jest.mock('../../../src/api/requests/notification-request');
jest.mock('../../../src/utils/handleError');
const mockedHandleError = mocked(handleError);


describe('Send Notification Entrypoint', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('Loaders is run', async () => {
    await httpTrigger(mockedContext, mockedContext.req);

    expect(loaders).toHaveBeenCalled();
  });

  test('Request is handled via SendNotification Controller', async () => {
    await httpTrigger(mockedContext, mockedContext.req);

    expect(SendNotificationController).toHaveBeenCalledTimes(1);
    expect(SendNotificationController.prototype.sendNotification).toHaveBeenCalledWith(mockedContext);
  });

  test('service bus error is caught', async () => {
    const messagingError = new MessagingError('mock service bus error');
    SendNotificationController.prototype.sendNotification = jest.fn().mockImplementation(async () => Promise.reject(messagingError));
    mockedHandleError.mockImplementation( () => { throw messagingError; } );

    await expect(httpTrigger(mockedContext, mockedContext.req)).rejects.toThrow(messagingError);
    expect(mockedHandleError).toHaveBeenCalled();
  });
});
