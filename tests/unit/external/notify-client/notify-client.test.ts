import { Container } from 'typedi';
import NotifyController from '../../../../src/external/notify-client/notify-client';
import { QueueRecord } from '../../../../src/interfaces/queue';
import { MessageType, Target } from '../../../../src/lib/enums';
import { NotifySendError } from '../../../../src/lib/errors';
import { getIdentifiers } from '../../../../src/utils/log';
import { mockedContext } from '../../../mocks/context.mock';
import { mockedLogger } from '../../../mocks/logger.mock';
import {
  errorAuth, errorBadRequest, errorRateLimit, errorServer, errorUnknown,
} from '../../../mocks/notify';

jest.mock('notifications-node-client');
jest.mock('typedi');
jest.mock('../../../mocks/logger.mock');
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

describe('Notify Client', () => {
  let clientUnderTest: NotifyController;
  const message: QueueRecord = {
    message_content: 'Another test\nnext paragraph',
    message_type: MessageType.EMAIL,
    target: Target.GB,
    email: {
      message_subject: 'Message Subject',
      email_address: 'test@email.com',
    },
    no_of_request_retries: 0,
    no_of_retries: 0,
    reference: '23232323',
    context_id: '45454545',
    date: '',
    trace_id: '',
  };

  const notifyResponse = {
    id: 'bfb50d92-100d-4b8b-b559-14fa3b091cda',
    reference: null,
    content: {
      subject: 'Licence renewal',
      body: 'Dear Bill, your licence is due for renewal on 3 January 2016.',
      from_email: 'the_service@gov.uk',
    },
    uri: 'https://api.notifications.service.gov.uk/v2/notifications/ceb50d92-100d-4b8b-b559-14fa3b091cd',
    template: {
      id: 'ceb50d92-100d-4b8b-b559-14fa3b091cda',
      version: '1',
      uri: 'https://api.notificaitons.service.gov.uk/service/your_service_id/templates/bfb50d92-100d-4b8b-b559-14fa3b091cda',
    },
  };

  const mockNotifyClient = {
    sendEmail: jest.fn(() => Promise.resolve({ data: notifyResponse })),
    sendLetter: jest.fn(() => Promise.resolve({ data: notifyResponse })),
  };

  Container.get = jest.fn((library: string) => {
    const stored = {
      'notify:client:gb': mockNotifyClient,
      'notify:client:ni': mockNotifyClient,
      logger: mockedLogger,
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    return stored[library];
  }) as jest.Mock;

  beforeAll(() => {
  });

  beforeEach(() => {
    clientUnderTest = new NotifyController(mockedContext);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Email positive flows', () => {
    test('Email is sent to GB client', async () => {
      const actual = await clientUnderTest.sendNotification(message);

      expect(actual).toStrictEqual(notifyResponse.id);
    });

    test('Email is sent to NI client', async () => {
      const niRequest = {
        ...message,
        target: Target.NI,
      };
      const niResponse = {
        ...notifyResponse,
        target: Target.NI,
      };

      const actual = await clientUnderTest.sendNotification(niRequest);

      expect(actual).toStrictEqual(niResponse.id);
    });
  });

  describe('Letter Positive flows', () => {
    const letterInfo = {
      address_line_2: 'another line',
      address_line_3: 'more town',
      address_line_4: 'more city',
      address_line_5: 'another county',
      postcode: 'AA11 1AA',
    };
    let request: QueueRecord;

    beforeEach(() => {
      request = {
        ...message,
        ...letterInfo,
        message_type: MessageType.LETTER,
      };
    });

    test('letter send with GB client', async () => {
      const actual = await clientUnderTest.sendNotification(request);

      expect(actual).toStrictEqual(notifyResponse.id);
    });

    test('letter send with NI client', async () => {
      const letterRequest: QueueRecord = {
        ...request,
        target: Target.NI,
      };
      const response = {
        ...notifyResponse,
        target: Target.NI,
      };

      const actual = await clientUnderTest.sendNotification(letterRequest);

      expect(actual).toStrictEqual(response.id);
    });
  });

  describe('Message validation', () => {
    test('message without target is caught', async () => {
      const request: QueueRecord = { ...message };
      delete request.target;

      await expect(clientUnderTest.sendNotification(request))
        .rejects
        .toStrictEqual(new Error('NotifyController::validateMessage: message target not set'));
    });

    test('message without type is caught', async () => {
      const request = { ...message };
      delete request.message_type;

      await expect(clientUnderTest.sendNotification(request))
        .rejects
        .toStrictEqual(new Error('NotifyController::validateMessage: message type not set'));
    });

    test('Invalid message type is caught', async () => {
      const request: QueueRecord = { ...message };
      request.message_type = 'invalid';

      await expect(clientUnderTest.sendNotification(request))
        .rejects
        .toStrictEqual(new Error('NotifyController::sendNotification: invalid is an unrecognised message type'));
    });

    test('Invalid message target is caught', async () => {
      const request: QueueRecord = { ...message };
      request.target = 'invalid';

      await expect(clientUnderTest.sendNotification(request))
        .rejects
        .toStrictEqual(new Error('NotifyController::getClient: invalid is invalid message target'));
    });
  });

  describe('Notify sending errors - logged and re-thrown as a NotifySendError', () => {
    test('Bad request error (1)', async () => {
      mockNotifyClient.sendEmail = jest.fn(() => Promise.reject(errorBadRequest));
      const request = { ...message };

      await expect(clientUnderTest.sendNotification(request))
        .rejects
        .toThrow(NotifySendError);

      expect(mockedLogger.critical).toHaveBeenCalledWith(
        `NotifyController::logNotifySendError: Notify send error: ${errorBadRequest.response.data.status_code} - ${errorBadRequest.response.data.errors[0].message}`,
        {
          context: mockedContext,
          ...(getIdentifiers(request)),
        },
      );
      expect(mockedLogger.warn).not.toHaveBeenCalled();
    });

    test('Authentication error (1)', async () => {
      mockNotifyClient.sendEmail = jest.fn(() => Promise.reject(errorAuth));
      const request = { ...message };

      await expect(clientUnderTest.sendNotification(request))
        .rejects
        .toThrow(NotifySendError);

      expect(mockedLogger.critical).not.toHaveBeenCalled();
      expect(mockedLogger.warn).not.toHaveBeenCalled();
      expect(mockedLogger.error).toHaveBeenCalledWith(
        { name: 'NotifyError', ...errorAuth.response.data.errors[0] },
        `NotifyController::logNotifySendError: Notify send error: ${errorAuth.response.data.status_code} - ${errorAuth.response.data.errors[0].message}`,
        {
          context: mockedContext,
          ...(getIdentifiers(request)),
        },
      );
    });

    test('Rate limit error (1)', async () => {
      mockNotifyClient.sendEmail = jest.fn(() => Promise.reject(errorRateLimit));
      const request = { ...message };

      await expect(clientUnderTest.sendNotification(request))
        .rejects
        .toThrow(NotifySendError);

      expect(mockedLogger.critical).not.toHaveBeenCalled();
      expect(mockedLogger.error).not.toHaveBeenCalled();
      expect(mockedLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockedLogger.warn).toHaveBeenCalledWith(
        `NotifyController::logNotifySendError: Notify send error: ${errorRateLimit.response.data.status_code} - ${errorRateLimit.response.data.errors[0].message}`,
        {
          context: mockedContext,
          ...(getIdentifiers(request)),
        },
      );
    });

    test('Notify server error (1)', async () => {
      mockNotifyClient.sendEmail = jest.fn(() => Promise.reject(errorServer));
      const request = { ...message };

      await expect(clientUnderTest.sendNotification(request))
        .rejects
        .toThrow(NotifySendError);

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        `NotifyController::logNotifySendError: Notify send error: ${errorServer.response.data.status_code} - ${errorServer.response.data.errors[0].message}`,
        {
          context: mockedContext,
          ...(getIdentifiers(request)),
        },
      );
      expect(mockedLogger.critical).not.toHaveBeenCalled();
    });

    test('Notify server error (1) - letter', async () => {
      mockNotifyClient.sendLetter = jest.fn(() => Promise.reject(errorServer));
      const request = { ...message, message_type: MessageType.LETTER };

      await expect(clientUnderTest.sendNotification(request))
        .rejects
        .toThrow(NotifySendError);

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        `NotifyController::logNotifySendError: Notify send error: ${errorServer.response.data.status_code} - ${errorServer.response.data.errors[0].message}`,
        {
          context: mockedContext,
          ...(getIdentifiers(request)),
        },
      );
      expect(mockedLogger.critical).not.toHaveBeenCalled();
    });

    test('Unknown error code', async () => {
      mockNotifyClient.sendEmail = jest.fn(() => Promise.reject(errorUnknown));
      const request = { ...message };

      await expect(clientUnderTest.sendNotification(request))
        .rejects
        .toThrow(NotifySendError);

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        `NotifyController::logNotifySendError: Unrecognised error code ${errorUnknown.response.data.status_code} ${errorUnknown.response.data.errors[0].message}`,
        {
          context: mockedContext,
          ...(getIdentifiers(request)),
        },
      );
      expect(mockedLogger.critical).not.toHaveBeenCalled();
    });
  });
});
