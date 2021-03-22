import { v4 as uuidv4 } from 'uuid';
import { Identifiers, NotificationHttpRequest } from '../../interfaces/api';
import { QueueRecord } from '../../interfaces/queue';
import { MessageType, Target } from '../../lib/enums';
import { createAjv } from '../../utils/schema-validator';

abstract class BaseNotificationRequest {
  // Validation schema needs to be loaded in
  // eslint-disable-next-line @typescript-eslint/ban-types
  abstract validationSchema: object;

  abstract messageType: MessageType;

  traceId: string;

  constructor(public request: NotificationHttpRequest) {
    this.traceId = uuidv4();
  }

  isValid(): boolean {
    // Copy the request body to clean it up before validating
    const requestBody = { ...this.request.body };

    // Make target value lowercase since validator expects lowercase
    if (requestBody && requestBody.target && typeof requestBody.target === 'string') {
      requestBody.target = <Target> requestBody.target.toLowerCase();
    }

    const ajv = createAjv();
    return Boolean(ajv.validate(this.validationSchema, requestBody));
  }

  mapToQueueRecord(): QueueRecord {
    const { body } = this.request;

    return {
      message_type: this.messageType,
      no_of_request_retries: 0,
      no_of_retries: 0,
      message_content: body.message_content,
      target: body.target,
      reference: body.reference,
      context_id: body.context_id,
      trace_id: this.traceId,
      date: new Date(Date.now()),
    };
  }

  getIdentifiers(): Identifiers {
    const { body } = this.request;

    return {
      reference: body?.reference,
      context_id: body?.context_id,
      trace_id: this.traceId,
    };
  }
}

export default BaseNotificationRequest;
