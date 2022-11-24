import { mocked } from 'ts-jest/utils';
import { Container } from 'typedi';
import EmailRequest from '../../../src/api/requests/email-request';
import LetterRequest from '../../../src/api/requests/letter-request';
import SendNotificationController from '../../../src/api/send-notification-controller';
import { BusinessTelemetryEvent } from '../../../src/utils/logger';
import { SchemaValidationError } from '../../../src/utils/schemaValidationError';
import { mockedContext } from '../../mocks/context.mock';
import { mockedLogger } from '../../mocks/logger.mock';
import { buildEmailQueueRecord, buildLetterQueueRecord, buildNotificationQueueRecord } from '../../mocks/queue-records';
import { RequestQueueClient } from '../../../src/queues/request-queue-client';
import NotificationRequest from '../../../src/api/requests/notification-request';

jest.mock('typedi');

jest.mock('../../../src/api/requests/email-request');
const mockedEmailRequest = mocked(EmailRequest, true);

jest.mock('../../../src/api/requests/letter-request');
const mockedLetterRequest = mocked(LetterRequest, true);

jest.mock('../../../src/api/requests/notification-request');
const mockedNotificationRequest = mocked(NotificationRequest, true);

jest.mock('../../../src/queues/request-queue-client');
const mockedRequestQueueClient = mocked(RequestQueueClient, true);

describe('SendNotificationController', () => {
  let controller: SendNotificationController;

  beforeAll(() => {
    Container.get = jest.fn((library: string) => {
      const stored = {
        logger: mockedLogger,
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
        mockedEmailRequest.prototype.mapToQueueRecord.mockImplementationOnce(() => mockQueueRecord);
      });

      test('puts the request on the queue', async () => {
        await controller.sendEmail(mockedContext);

        expect(mockedRequestQueueClient.prototype.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
          body: mockQueueRecord,
        }));
        expect(mockedLogger.request).toHaveBeenCalledWith('Ntf Request Queue', expect.objectContaining({}));
      });
    });

    describe('if the request payload is invalid', () => {
      test('throws SchemaValidationError', async () => {
        const expectedError = new SchemaValidationError('wrong data');
        mockedEmailRequest.prototype.validate.mockImplementationOnce(() => { throw expectedError; });
        mockedEmailRequest.prototype.mapToQueueRecord.mockImplementationOnce(() => mockQueueRecord);

        await expect(() => controller.sendEmail(mockedContext)).rejects.toThrow(expectedError);
      });
    });
  });

  describe('sendLetter handler', () => {
    const mockQueueRecord = buildLetterQueueRecord();

    describe('if the request payload is valid', () => {
      beforeEach(() => {
        mockedLetterRequest.prototype.mapToQueueRecord.mockImplementationOnce(() => mockQueueRecord);
      });

      test('puts the request on the queue', async () => {
        await controller.sendLetter(mockedContext);

        expect(mockedRequestQueueClient.prototype.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
          body: mockQueueRecord,
        }));
        expect(mockedLogger.request).toHaveBeenCalledWith('Ntf Request Queue', expect.objectContaining({}));
      });
    });

    describe('if the request payload is invalid', () => {
      test('throws SchemaValidationError', async () => {
        const expectedError = new SchemaValidationError('wrong data');
        mockedLetterRequest.prototype.validate.mockImplementationOnce(() => { throw expectedError; });

        await expect(() => controller.sendLetter(mockedContext)).rejects.toThrow(expectedError);
      });
    });
  });

  describe('sendNotification handler', () => {
    const mockQueueRecord = buildNotificationQueueRecord();

    describe('if the request payload is valid', () => {
      beforeEach(() => {
        mockedNotificationRequest.prototype.mapToQueueRecord.mockImplementationOnce(() => mockQueueRecord);
      });

      test('puts the request on the queue', async () => {
        await controller.sendNotification(mockedContext);

        expect(mockedRequestQueueClient.prototype.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
          body: mockQueueRecord,
        }));
        expect(mockedLogger.request).toHaveBeenCalledWith('Ntf Request Queue', expect.objectContaining({}));
      });
    });

    describe('if the request payload is invalid', () => {
      test('throws SchemaValidationError', async () => {
        const expectedError = new SchemaValidationError('wrong data');
        mockedNotificationRequest.prototype.validate.mockImplementationOnce(() => { throw expectedError; });

        await expect(() => controller.sendNotification(mockedContext)).rejects.toThrow(expectedError);
      });
    });
  });

  describe('Error paths', () => {
    test('Failing to add message to request queue, alert the FAIL_WRITE_QUEUE event', async () => {
      const mockQueueRecord = buildEmailQueueRecord();
      mockedEmailRequest.prototype.mapToQueueRecord.mockImplementationOnce(() => mockQueueRecord);
      mockedRequestQueueClient.prototype.sendMessage.mockImplementation(() => {
        throw Error();
      });

      await expect(controller.sendEmail(mockedContext)).rejects.toThrow();

      expect(mockedLogger.request).toHaveBeenCalledWith('Ntf Request Queue', expect.objectContaining({}));
      expect(mockedLogger.event).toHaveBeenCalledWith(
        BusinessTelemetryEvent.NOTIF_API_FAIL_WRITE_QUEUE,
        expect.any(String),
        expect.any(Object),
      );
    });
  });
});
