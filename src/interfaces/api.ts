import { HttpRequest } from '@azure/functions';
import { Agency, BookingCategory, Channel, Language, Target } from '../lib/enums';

export interface EmailRequestBody extends RequestBase {
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

export interface LetterRequestBody extends RequestBase {
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

interface PostalAddressRequestBody {
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

export interface NotificationPostalAddressBody extends NotificationRequestBody {
  postal_address: PostalAddressRequestBody;
}

export interface NotificationRequestBody {
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
  postal_address?: PostalAddressRequestBody;
  reference?: string;
  context_id?: string;
}

export interface RequestBase {
  target: Target;
  /**
   * @notEmpty true
   */
  message_content: string;
  reference?: string;
  context_id?: string;
}

export interface Identifiers {
  reference?: string;
  context_id?: string;
  trace_id?: string;
}

export interface LetterOrEmailHttpRequest extends HttpRequest {
  body: RequestBase & Identifiers;
}

export interface EmailHttpRequest extends HttpRequest {
  body: EmailRequestBody & Identifiers;
}

export interface LetterHttpRequest extends HttpRequest {
  body: LetterRequestBody & Identifiers;
}

export interface SendNotificationHttpRequest extends HttpRequest {
  body: NotificationRequestBody & Identifiers;
}

export type NotificationHttpRequest = LetterOrEmailHttpRequest | SendNotificationHttpRequest;

export interface ApiResponse {
  headers: Record<string, string>,
  status: number,
  body: {
    description: string,
  },
}
