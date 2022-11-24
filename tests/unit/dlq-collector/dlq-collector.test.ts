import { Container } from 'typedi';
import DeadLetterQueueCollector from '../../../src/dlq-collector/dlq-collector';
import {
  requestQueueRecords,
  statusQueueRecords,
  buildEmailQueueRecord,
} from '../../mocks/queue-records';
import { CRMStatus } from '../../../src/lib/enums';
import { mockedLogger } from '../../mocks/logger.mock';
import { BusinessTelemetryEvent } from '../../../src/utils/logger';
import { mockedContext } from '../../mocks/context.mock';

jest.mock('typedi');
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/utils/queue-record-validator');
jest.mock('../../../src/external/crm/crm');

describe('DeadLetterQueueCollector', () => {
  const mockCRM = {
    sendNotificationStatus: jest.fn(),
  };

  const [requestRecord] = requestQueueRecords;
  const [statusRecord] = statusQueueRecords;

  const mockQueueRecordValidator = {
    validateMessage: jest.fn(() => ({ isValid: true, errorMessage: null })),
  };

  Container.get = jest.fn((library: string) => {
    const stored = {
      logger: mockedLogger,
      crm: mockCRM,
      'validator:queuerecord': mockQueueRecordValidator,
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    return stored[library];
  }) as jest.Mock;

  const collector = new DeadLetterQueueCollector();

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processMessage', () => {
    test('emit event FOUND_MSG', async () => {
      await collector.processMessage(mockedContext, requestRecord);

      expect(mockedLogger.event).toHaveBeenCalledWith(BusinessTelemetryEvent.NOTIF_COLLECTOR_FOUND_MSG, 'DeadLetterQueueCollector:::processMessage');
    });

    test('sends a message to CRM from Notification Request dead letter queue', async () => {
      const requestDlqQueueRecord = requestRecord;
      await collector.processMessage(mockedContext, requestRecord);

      expect(mockCRM.sendNotificationStatus).toHaveBeenCalledWith(mockedContext, requestDlqQueueRecord, CRMStatus.NOTIFY_FAILURE);
    });

    test('sends a message to CRM from Notification Status dead letter queue', async () => {
      const statusDlqQueueRecord = statusRecord;

      await collector.processMessage(mockedContext, statusDlqQueueRecord);

      expect(mockCRM.sendNotificationStatus).toHaveBeenCalledWith(mockedContext, statusDlqQueueRecord, CRMStatus.NOTIFY_FAILURE);
    });

    test('handles error from CRM', async () => {
      const dlqRecord = buildEmailQueueRecord();
      const crmError = new Error('CRM Failure');
      mockCRM.sendNotificationStatus.mockImplementationOnce(() => Promise.reject(crmError));

      await collector.processMessage(mockedContext, dlqRecord);

      expect(mockCRM.sendNotificationStatus).toHaveBeenCalledWith(mockedContext, dlqRecord, CRMStatus.NOTIFY_FAILURE);
      expect(mockedLogger.error).toHaveBeenCalledWith(
        crmError,
        'DeadLetterQueueCollector::processMessage: Could not process DLQ message, Error sending to CRM queue',
        expect.objectContaining({}),
      );
      expect(mockedLogger.event).toHaveBeenCalledWith(BusinessTelemetryEvent.NOTIF_COLLECTOR_FAIL_CDS, expect.any(String), { error: crmError });
    });

    test('performs validation on successful requests', async () => {
      const statusDlqQueueRecord = buildEmailQueueRecord();
      mockQueueRecordValidator.validateMessage.mockImplementationOnce(() => ({ isValid: true, errorMessage: null }));

      await collector.processMessage(mockedContext, statusDlqQueueRecord);

      expect(mockQueueRecordValidator.validateMessage).toHaveBeenCalled();
      expect(mockCRM.sendNotificationStatus).toHaveBeenCalled();
    });

    test('performs validation on invalid requests', async () => {
      const statusDlqQueueRecord = buildEmailQueueRecord();
      statusDlqQueueRecord.email.email_address = 'invalid';
      mockQueueRecordValidator.validateMessage.mockImplementationOnce(() => ({ isValid: false, errorMessage: null }));

      await collector.processMessage(mockedContext, statusDlqQueueRecord);

      expect(mockQueueRecordValidator.validateMessage).toHaveBeenCalled();
      expect(mockCRM.sendNotificationStatus).not.toHaveBeenCalled();
    });
  });
});
