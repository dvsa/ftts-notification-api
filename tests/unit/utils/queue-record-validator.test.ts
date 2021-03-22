import { buildEmailQueueRecord, buildLetterQueueRecord } from '../../mocks/queue-records';
import QueueRecordValidator from '../../../src/utils/queue-record-validator';
import { Status } from '../../../src/lib/enums';
import { globalDate } from '../../mocks/date.mock';

jest.mock('../../mocks/logger.mock');

describe('QueueRecordValidator', () => {
  const queueRecordValidator = new QueueRecordValidator();

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('missing trace_id is not valid', () => {
    const message = buildLetterQueueRecord();
    delete message.trace_id;

    const response = queueRecordValidator.validateMessage(message).isValid;

    expect(response).toBe(false);
  });

  test('empty trace_id is not valid', () => {
    const message = buildLetterQueueRecord();
    message.trace_id = ' ';

    const response = queueRecordValidator.validateMessage(message).isValid;

    expect(response).toBe(false);
  });

  test('missing message content is not valid', () => {
    const message = buildLetterQueueRecord();
    delete message.message_content;

    const response = queueRecordValidator.validateMessage(message).isValid;

    expect(response).toBe(false);
  });

  test('empty message content is not valid', () => {
    const message = buildLetterQueueRecord();
    message.message_content = ' ';

    const response = queueRecordValidator.validateMessage(message).isValid;

    expect(response).toBe(false);
  });

  test('missing status is still valid', () => {
    const message = buildEmailQueueRecord();
    delete message.status;

    const response = queueRecordValidator.validateMessage(message).isValid;

    expect(response).toBe(true);
  });

  test('correct status is valid', () => {
    const message = buildEmailQueueRecord();
    message.status = Status.DELIVERED;

    const response = queueRecordValidator.validateMessage(message).isValid;

    expect(response).toBe(true);
  });

  test('incorrect status is not valid', () => {
    const message = buildLetterQueueRecord();
    message.status = 'INVALID_Status';

    const response = queueRecordValidator.validateMessage(message).isValid;

    expect(response).toBe(false);
  });

  test('uppercase target is valid', () => {
    const message = buildLetterQueueRecord();
    message.target = 'GB';

    const response = queueRecordValidator.validateMessage(message).isValid;

    expect(response).toBe(true);
  });

  test('missing target is not valid', () => {
    const message = buildLetterQueueRecord();
    delete message.target;

    const response = queueRecordValidator.validateMessage(message).isValid;

    expect(response).toBe(false);
  });

  test('incorrect target is not valid', () => {
    const message = buildLetterQueueRecord();
    message.target = 'AL';

    const response = queueRecordValidator.validateMessage(message).isValid;

    expect(response).toBe(false);
  });

  test('missing message type is not valid', () => {
    const message = buildLetterQueueRecord();
    delete message.message_type;

    const response = queueRecordValidator.validateMessage(message).isValid;

    expect(response).toBe(false);
  });

  test('incorrect message type is not valid', () => {
    const message = buildLetterQueueRecord();
    message.message_type = 'chat';

    const response = queueRecordValidator.validateMessage(message).isValid;

    expect(response).toBe(false);
  });

  test('additional fields are not valid', () => {
    const message = buildLetterQueueRecord();
    message.uri = 'invalid';

    const response = queueRecordValidator.validateMessage(message).isValid;

    expect(response).toBe(false);
  });

  describe('Email validation', () => {
    test('correct email addresses are valid', () => {
      const message = buildEmailQueueRecord();

      const response = queueRecordValidator.validateMessage(message).isValid;

      expect(response).toBe(true);
    });

    test('incorrect email addresses are not valid', () => {
      const message = buildEmailQueueRecord();
      message.email.email_address = 'invalid';

      const response = queueRecordValidator.validateMessage(message).isValid;

      expect(response).toBe(false);
    });

    test('missing email address is not valid', () => {
      const message = buildEmailQueueRecord();
      delete message.email.email_address;

      const response = queueRecordValidator.validateMessage(message).isValid;

      expect(response).toBe(false);
    });

    test('empty email address is not valid', () => {
      const message = buildEmailQueueRecord();
      message.email.email_address = ' ';

      const response = queueRecordValidator.validateMessage(message).isValid;

      expect(response).toBe(false);
    });

    test('missing message subject is not valid', () => {
      const message = buildEmailQueueRecord();
      delete message.email.message_subject;

      const response = queueRecordValidator.validateMessage(message).isValid;

      expect(response).toBe(false);
    });

    test('empty message subject is not valid', () => {
      const message = buildEmailQueueRecord();
      message.email.message_subject = ' ';

      const response = queueRecordValidator.validateMessage(message).isValid;

      expect(response).toBe(false);
    });

    test('additional fields inside email obj are not valid', () => {
      const message = buildEmailQueueRecord();
      message.email.postcode = 'invalid';

      const response = queueRecordValidator.validateMessage(message).isValid;

      expect(response).toBe(false);
    });
  });

  describe('Letter validation', () => {
    test('missing letter is not valid', () => {
      const message = buildLetterQueueRecord();
      delete message.letter;

      const response = queueRecordValidator.validateMessage(message).isValid;

      expect(response).toBe(false);
    });

    test('missing name is not valid', () => {
      const message = buildLetterQueueRecord();
      delete message.letter.name;

      const response = queueRecordValidator.validateMessage(message).isValid;

      expect(response).toBe(false);
    });

    test('missing address line 1 is not valid', () => {
      const message = buildLetterQueueRecord();
      delete message.letter.address_line_1;

      const response = queueRecordValidator.validateMessage(message).isValid;

      expect(response).toBe(false);
    });

    test('empty address line 1 is not valid', () => {
      const message = buildLetterQueueRecord();
      message.letter.address_line_1 = ' ';

      const response = queueRecordValidator.validateMessage(message).isValid;

      expect(response).toBe(false);
    });

    test('missing address line 2 is not valid', () => {
      const message = buildLetterQueueRecord();
      delete message.letter.address_line_2;

      const response = queueRecordValidator.validateMessage(message).isValid;

      expect(response).toBe(false);
    });

    test('empty missing address line 2 is not valid', () => {
      const message = buildLetterQueueRecord();
      message.letter.address_line_2 = ' ';

      const response = queueRecordValidator.validateMessage(message).isValid;

      expect(response).toBe(false);
    });

    test('missing address line 3 is still valid', () => {
      const message = buildLetterQueueRecord();
      delete message.letter.address_line_3;

      const response = queueRecordValidator.validateMessage(message).isValid;

      expect(response).toBe(true);
    });

    test('missing postcode is not valid', () => {
      const message = buildLetterQueueRecord();
      delete message.letter.postcode;

      const response = queueRecordValidator.validateMessage(message).isValid;

      expect(response).toBe(false);
    });

    test('empty postcode is not valid', () => {
      const message = buildLetterQueueRecord();
      message.letter.postcode = ' ';

      const response = queueRecordValidator.validateMessage(message).isValid;

      expect(response).toBe(false);
    });

    test('typed dates are valid', () => {
      const message = buildLetterQueueRecord();
      message.date = globalDate;
      const response = queueRecordValidator.validateMessage(message).isValid;

      expect(response).toBe(true);
    });

    test('string dates are valid', () => {
      const message = buildLetterQueueRecord();
      message.date = globalDate.toISOString();
      const response = queueRecordValidator.validateMessage(message).isValid;

      expect(response).toBe(true);
    });

    test('additional fields inside letter obj are not valid', () => {
      const message = buildLetterQueueRecord();
      message.letter.message_subject = 'invalid';

      const response = queueRecordValidator.validateMessage(message).isValid;

      expect(response).toBe(false);
    });
  });
});
