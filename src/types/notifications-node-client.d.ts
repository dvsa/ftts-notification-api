declare module 'notifications-node-client' {
  class NotifyClient {
    constructor(stubAddress?: string, apiKey?: string)

    sendEmail(templateId: string, emailAddress: string, options: NotifyEmailOptions): Promise<NotifyResponse<SenderResponseBody>>;

    sendLetter(templateId: string, options: NotifyLetterOptions): Promise<NotifyResponse<SenderResponseBody>>;

    getNotificationById(notificationId: string): Promise<NotifyResponse<StatusResponseBody>>;
  }

  export interface INotifyClient {
    sendEmail(templateId: string, emailAddress: string, options: NotifyEmailOptions): Promise<NotifyResponse<SenderResponseBody>>;
    sendLetter(templateId: string, options: NotifyLetterOptions): Promise<NotifyResponse<SenderResponseBody>>;
    getNotificationById(notificationId: string): Promise<NotifyResponse<StatusResponseBody>>;
  }

  export interface NotifyLetterOptions {
    // Disabled as we want custom data to be configurable
    // eslint-disable-next-line @typescript-eslint/ban-types
    personalisation: object;
    reference: string;
  }

  export interface NotifyEmailOptions extends NotifyLetterOptions {
    emailReplyToId?: string;
  }

  export interface NotifyResponse<T> {
    body: T;
  }

  export interface SenderResponseBody {
    content: {
      body: string;
      from_email: string;
      subject: string;
    };
    id: string;
    reference: string | null;
    template: {
      id: string;
      uri: string;
      version: string;
    };
    uri: string;
    scheduled_for?: string | null;
  }

  export enum NotificationType {
    SMS = 'sms',
    LETTER = 'letter',
    EMAIL = 'email',
  }

  export interface StatusResponseBody {
    id: string;
    body: string;
    subject?: string;
    reference: string;
    email_address: string;
    phone_number: string;
    line_1: string;
    line_2: string;
    line_3: string;
    line_4: string;
    line_5: string;
    line_6: string;
    postcode: string;
    postage: string;
    type: NotificationType | string;
    status: string;
    template: {
      version: number;
      id: number;
      uri: string;
    };
    created_by_name: string;
    created_at: string;
    sent_at: string;
  }

  export { NotifyClient };
}
