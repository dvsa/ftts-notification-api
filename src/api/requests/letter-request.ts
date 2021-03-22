import BaseNotificationRequest from './base-notification-request';
import LetterRequestBodySchema from '../../schemas/LetterRequestBody.schema.json';
import { QueueRecord } from '../../interfaces/queue';
import { MessageType } from '../../lib/enums';
import { LetterHttpRequest } from '../../interfaces/api';

class LetterRequest extends BaseNotificationRequest {
  validationSchema = LetterRequestBodySchema;

  messageType = MessageType.LETTER;

  constructor(public request: LetterHttpRequest) {
    super(request);
  }

  mapToQueueRecord(): QueueRecord {
    const { body } = this.request;

    return {
      ...super.mapToQueueRecord(),
      letter: {
        name: body.name,
        address_line_1: body.address_line_1,
        address_line_2: body.address_line_2,
        address_line_3: body.address_line_3,
        address_line_4: body.address_line_4,
        address_line_5: body.address_line_5,
        address_line_6: body.address_line_6,
        postcode: body.postcode,
      },
    };
  }
}

export default LetterRequest;
