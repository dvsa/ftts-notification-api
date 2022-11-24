import BaseNotificationRequest from './base-notification-request';
import EmailRequestBodySchema from '../../schemas/EmailRequestBody.schema.json';
import { QueueRecordItem } from '../../interfaces/queue';
import { MessageType } from '../../lib/enums';
import { EmailHttpRequest } from '../../interfaces/api';

class EmailRequest extends BaseNotificationRequest {
  validationSchema = EmailRequestBodySchema;

  messageType = MessageType.EMAIL;

  constructor(public request: EmailHttpRequest) {
    super(request);
  }

  mapToQueueRecord(): QueueRecordItem {
    const { body } = this.request;

    return {
      ...super.mapToQueueRecord(),
      email: {
        message_subject: body.message_subject,
        email_address: body.email_address,
      },
    };
  }
}

export default EmailRequest;
