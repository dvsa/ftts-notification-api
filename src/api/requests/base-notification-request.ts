import { v4 as uuidv4 } from 'uuid';
import { NotificationHttpRequest, Identifiers, LetterOrEmailHttpRequest } from '../../interfaces/api';
import { BaseQueueRecord, QueueRecordItem } from '../../interfaces/queue';
import { MessageType, Target } from '../../lib/enums';
import { validateAgainstSchema } from '../../utils/schema-validator';

abstract class BaseNotificationRequest {
  // Validation schema needs to be loaded in
  // eslint-disable-next-line @typescript-eslint/ban-types
  abstract validationSchema: object;

  abstract messageType: MessageType;

  traceId: string;

  constructor(public request: NotificationHttpRequest) {
    this.traceId = uuidv4();
  }

  validate(): void {
    // Copy the request body to clean it up before validating
    const requestBody = { ...this.request.body };

    if (requestBody && 'target' in requestBody && typeof requestBody.target === 'string' ) {
      // Make target value lowercase since validator expects lowercase
      requestBody.target = <Target> requestBody.target.toLowerCase();
    }

    validateAgainstSchema(this.validationSchema, requestBody);
  }

  mapToQueueRecord(): QueueRecordItem {
    const { body } = this.request as LetterOrEmailHttpRequest;
    return {
      ...this.mapCommonData(),
      message_content: body.message_content,
      target: body.target,
    };
  }

  mapCommonData() : BaseQueueRecord {
    const { body } = this.request;

    return {
      message_type: this.messageType,
      no_of_request_retries: 0,
      no_of_retries: 0,
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
