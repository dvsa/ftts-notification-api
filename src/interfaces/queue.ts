import { ServiceBusMessage } from '@azure/service-bus';
import { MessageType, Target, Status, Channel, Agency, Language, BookingCategory } from '../lib/enums';

export interface QueueRecord extends BaseQueueRecord {
  /**
   * @notEmpty true
   */
  message_content: string;
  target: Target;
}

export interface BaseQueueRecord {
  id?: string;
  /**
   * @notEmpty true
   */
  date: Date | string;
  status?: Status;
  /**
   * @notEmpty true
   */
  message_type: MessageType;
  email?: Email;
  letter?: Letter;
  notification?: Notification;
  no_of_request_retries: number;
  no_of_retries: number;
  /**
   * @notEmpty true
   */
  trace_id?: string;
  parent_id?: string;
  reference?: string;
  context_id?: string;
}

export type QueueRecordItem = BaseQueueRecord | QueueRecord;

export interface StatusQueueRecord extends QueueRecord {
  /**
   * @notEmpty true
   */
  id: string;
}

export interface Email {
  /**
   * @notEmpty true
   */
  message_subject: string;
  /**
   * @format email
   * @notEmpty true
   */
  email_address: string;
}

export interface Letter {
  /**
   * @notEmpty true
   */
  name: string;
  /**
   * @notEmpty true
   */
  address_line_1: string;
  /**
   * @notEmpty true
   */
  address_line_2: string;
  address_line_3?: string;
  address_line_4?: string;
  address_line_5?: string;
  address_line_6?: string;
  /**
   * @notEmpty true
   */
  postcode: string;
}

export interface Notification {
  /**
   * @notEmpty true
   */
  channel: Channel;
  /**
   * @notEmpty true
   */
  agency: Agency;
  /**
   * @notEmpty true
   */
  language: Language;
  /**
   * @notEmpty true
   */
  category: BookingCategory;
  email_address?: string;
  postal_address?: Letter;
  reference?: string;
  context_id?: string;
}

export interface SenderServiceBusMessage extends ServiceBusMessage {
  body: QueueRecord;
}

export interface StatusServiceBusMessage extends ServiceBusMessage {
  body: StatusQueueRecord;
}
