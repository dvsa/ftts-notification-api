import { mocked } from 'ts-jest/utils';
import { Container } from 'typedi';

import EmailRequest from '../../../src/api/requests/email-request';
import LetterRequest from '../../../src/api/requests/letter-request';
import SendNotificationController from '../../../src/api/send-notification-controller';
import { BusinessTelemetryEvent } from '../../../src/utils/logger';
import { mockedContext } from '../../mocks/context.mock';
import { mockedLogger } from '../../mocks/logger.mock';
import { buildEmailQueueRecord, buildLetterQueueRecord } from '../../mocks/queue-records';

jest.mock('typedi');
const mockRequestQueueSender = {
  send: jest.fn(),
};
const mockRequestQueueClient = {
  createSender: () => mockRequestQueueSender,
};

jest.mock('../../../src/api/requests/email-request');
const mockedEmailRequest = mocked(EmailRequest, true);

jest.mock('../../../src/api/requests/letter-request');
const mockedLetterRequest = mocked(LetterRequest, true);

describe('SendNotificationController', () => {
  let controller: SendNotificationController;
  beforeAll(() => {
    Container.get = jest.fn((library: string) => {
      const stored = {
        logger: mockedLogger,
        'request:queue:client': mockRequestQueueClient,
      };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
      return stored[library];
    }) as jest.Mock;

    controller = new SendNotificationController();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendEmail handler', () => {
    const mockQueueRecord = buildEmailQueueRecord();

    describe('if the request payload is valid', () => {
      beforeEach(() => {
        mockedEmailRequest.prototype.isValid.mockImplementationOnce(() => true);
        mockedEmailRequest.prototype.mapToQueueRecord.mockImplementationOnce(() => mockQueueRecord);
      });

      test('puts the request on the queue', async () => {
        await controller.sendEmail(mockedContext);

        expect(mockRequestQueueSender.send).toHaveBeenCalledWith(expect.objectContaining({
          body: mockQueueRecord,
        }));
        expect(mockedLogger.request).toHaveBeenCalledWith(mockedContext, 'Ntf Request Queue', expect.objectContaining({}));
      });

      test('sends a 201 success response', async () => {
        await controller.sendEmail(mockedContext);

        expect(mockedContext.res).toStrictEqual({
          headers: { 'Content-Type': 'application/json' },
          status: 201,
          body: { description: 'Notification sent' },
        });
      });
    });

    describe('if the request payload is invalid', () => {
      beforeEach(() => {
        mockedEmailRequest.prototype.isValid.mockImplementationOnce(() => false);
        mockedEmailRequest.prototype.mapToQueueRecord.mockImplementationOnce(() => mockQueueRecord);
      });

      test('sends a 400 error response', async () => {
        await controller.sendEmail(mockedContext);

        expect(mockedContext.res).toStrictEqual({
          headers: { 'Content-Type': 'application/json' },
          status: 400,
          body: { description: 'Bad Request' },
        });
      });
    });
  });

  describe('sendLetter handler', () => {
    const mockQueueRecord = buildLetterQueueRecord();

    describe('if the request payload is valid', () => {
      beforeEach(() => {
        mockedLetterRequest.prototype.isValid.mockImplementationOnce(() => true);
        mockedLetterRequest.prototype.mapToQueueRecord.mockImplementationOnce(() => mockQueueRecord);
      });

      test('puts the request on the queue', async () => {
        await controller.sendLetter(mockedContext);

        expect(mockRequestQueueSender.send).toHaveBeenCalledWith(expect.objectContaining({
          body: mockQueueRecord,
        }));
        expect(mockedLogger.request).toHaveBeenCalledWith(mockedContext, 'Ntf Request Queue', expect.objectContaining({}));
      });

      test('sends a 201 success response', async () => {
        await controller.sendLetter(mockedContext);

        expect(mockedContext.res).toStrictEqual({
          headers: { 'Content-Type': 'application/json' },
          status: 201,
          body: { description: 'Notification sent' },
        });
      });
    });

    describe('if the request payload is invalid', () => {
      beforeEach(() => {
        mockedLetterRequest.prototype.isValid.mockImplementationOnce(() => false);
      });

      test('sends a 400 error response', async () => {
        await controller.sendLetter(mockedContext);

        expect(mockedContext.res).toStrictEqual({
          headers: { 'Content-Type': 'application/json' },
          status: 400,
          body: { description: 'Bad Request' },
        });
      });
    });
  });

  describe('Error paths', () => {
    test('Failing to add message to request queue, alert the FAIL_WRITE_QUEUE event', async () => {
      const mockQueueRecord = buildEmailQueueRecord();
      mockedEmailRequest.prototype.isValid.mockImplementationOnce(() => true);
      mockedEmailRequest.prototype.mapToQueueRecord.mockImplementationOnce(() => mockQueueRecord);
      mockRequestQueueSender.send.mockImplementation(() => {
        throw Error();
      });

      await expect(controller.sendEmail(mockedContext)).rejects.toThrow();

      expect(mockedLogger.request).toHaveBeenCalledWith(mockedContext, 'Ntf Request Queue', expect.objectContaining({}));
      expect(mockedLogger.logEvent).toHaveBeenCalledWith(
        mockedContext,
        BusinessTelemetryEvent.NOTIF_API_FAIL_WRITE_QUEUE, expect.any(String),
      );
    });
  });
});
