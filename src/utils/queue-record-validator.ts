import { QueueRecord } from '../interfaces/queue';
import { ValidationResponse } from '../interfaces/validate-response';
import { Target } from '../lib/enums';
import QueueRecordSchema from '../schemas/QueueRecord.schema.json';
import { createAjv } from './schema-validator';

class QueueRecordValidator {
  sanitizeMessage(object: QueueRecord): QueueRecord {
    if (object && object.target && typeof object.target === 'string') {
      object.target = object.target.toLowerCase() as Target;
    }

    if (object && object.date) {
      object.date = String(object.date);
    }

    return object;
  }

  validateMessage(message: QueueRecord): ValidationResponse {
    if (!message.email && !message.letter) {
      return { isValid: false, errorMessage: 'Message does not include an email or letter object' };
    }

    const ajv = createAjv();
    const isValid = Boolean(ajv.validate(QueueRecordSchema, this.sanitizeMessage(message)));

    return {
      isValid,
      errorMessage: ajv.errorsText(),
    };
  }
}

export default QueueRecordValidator;
