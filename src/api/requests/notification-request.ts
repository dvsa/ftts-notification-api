import BaseNotificationRequest from './base-notification-request';
import NotificationRequestBodySchema from '../../schemas/NotificationRequestBody.schema.json';
import { BaseQueueRecord, Notification, QueueRecordItem } from '../../interfaces/queue';
import { Agency, Channel, Language, MessageType } from '../../lib/enums';
import {
  Identifiers,
  NotificationPostalAddressBody,
  SendNotificationHttpRequest,
} from '../../interfaces/api';
import { SchemaValidationError } from '../../utils/schemaValidationError';

class SendNotificationRequest extends BaseNotificationRequest {
  validationSchema = NotificationRequestBodySchema;

  messageType = MessageType.NOTIFICATION;

  constructor(public request: SendNotificationHttpRequest) {
    super(request);
  }

  validate() {
    super.validate();
    const { body } = this.request;
    if (body.agency === Agency.DVA && body.language === Language.CY) {
      throw new SchemaValidationError('The language can\'t be cy if the agency is DVA');
    }
    if (body.channel === Channel.EMAIL && !body.email_address) {
      throw new SchemaValidationError('If the channel is email then the email address can\'t be empty');
    }
    if (body.channel === Channel.LETTER && !body.postal_address) {
      throw new SchemaValidationError('If the channel is letter then the postal_address can\'t be empty');
    }
  }

  mapToQueueRecord(): QueueRecordItem {
    const { body } = this.request;
    const isValidLetter: boolean = body.channel === Channel.LETTER && 'postal_address' in body;

    return {
      ...super.mapCommonData(),
      notification: {
        ...isValidLetter ? this.mapLetterData(body as NotificationPostalAddressBody & Identifiers) : this.mapEmailData(),
      },
    } as BaseQueueRecord;
  }

  mapLetterData(body: NotificationPostalAddressBody & Identifiers): Notification {
    return {
      channel: body.channel,
      agency: body.agency,
      language: body.language,
      category: body.category,
      postal_address: {
        name: body.postal_address.name,
        address_line_1: body.postal_address.address_line_1,
        address_line_2: body.postal_address.address_line_2,
        address_line_3: body.postal_address.address_line_3,
        address_line_4: body.postal_address.address_line_4,
        address_line_5: body.postal_address.address_line_5,
        address_line_6: body.postal_address.address_line_6,
        postcode: body.postal_address.postcode,
      },
    };
  }

  mapEmailData(): Notification {
    const { body } = this.request;
    return {
      channel: body.channel,
      agency: body.agency,
      language: body.language,
      category: body.category,
      email_address: body.email_address,
    };
  }
}

export default SendNotificationRequest;
