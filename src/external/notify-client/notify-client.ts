import { Context } from '@azure/functions';
import {
  INotifyClient,
  SenderResponseBody,
  NotifyResponse,
} from 'notifications-node-client';
import { Container } from 'typedi';

import config from '../../config';
import { Target, MessageType, Status } from '../../lib/enums';
import { QueueRecord, Email } from '../../interfaces/queue';
import { NotifySendError } from '../../lib/errors';
import { logIdentifiers } from '../../utils/log';
import { NotifyError } from '../../interfaces/notify-error';
import { logger, Logger } from '../../utils/logger';

class NotifyController {
  private niClient: INotifyClient;

  private gbClient: INotifyClient;

  private templateKey: string;

  private logger: Logger;

  constructor(private context: Context) {
    this.niClient = Container.get('notify:client:ni');
    this.gbClient = Container.get('notify:client:gb');
    this.logger = Container.get<Logger>('logger');
    this.templateKey = '';
  }

  async sendNotification(message: QueueRecord): Promise<string> {
    this.validateMessage(message);
    if (message.message_type === MessageType.EMAIL) {
      return this.sendEmail(message, this.getClient(message));
    }
    if (message.message_type === MessageType.LETTER) {
      return this.sendLetter(message, this.getClient(message));
    }
    // In this case we want to log out the raw message type instead of being caught by restricted enums
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    const error = new Error(`Notify:: ${message.message_type} is an unrecognised message type`);
    this.logger.error(error, `Notify-client:send:: Message type invalid ${logIdentifiers(message)}`, { context: this.context });
    throw error;
  }

  static async getStatus(target: string, id: string): Promise<Status> {
    const client: INotifyClient = Container.get(`notify:client:${target.toLowerCase()}`);
    const { body } = await client.getNotificationById(id);
    return body.status as Status;
  }

  private validateMessage(message: QueueRecord): void {
    if (!message.target) {
      const error = new Error('message target not set');
      this.logger.error(error, `Notify-client:validateMessage:: Message missing target ${logIdentifiers(message)}`, { context: this.context });
      throw error;
    }
    if (!message.message_type) {
      const error = new Error('message type not set');
      this.logger.error(error, `Notify-client:validateMessage:: Message missing message_type ${logIdentifiers(message)}`, { context: this.context });
      throw error;
    }
  }

  private getClient(message: QueueRecord): INotifyClient {
    if (message.target.toLowerCase() === Target.GB) {
      if (message.message_type === MessageType.EMAIL) {
        this.templateKey = config.notify.gb.emailTemplate;
      }
      if (message.message_type === MessageType.LETTER) {
        this.templateKey = config.notify.gb.letterTemplate;
      }
      return this.gbClient;
    }
    if (message.target.toLowerCase() === Target.NI) {
      if (message.message_type === MessageType.EMAIL) {
        this.templateKey = config.notify.ni.emailTemplate;
      }
      if (message.message_type === MessageType.LETTER) {
        this.templateKey = config.notify.ni.letterTemplate;
      }
      return this.niClient;
    }
    const error = new Error(`Notify:: ${message.target.toLowerCase()} is invalid message target`);
    this.logger.error(error, `Notify-client:setClient:: Message target invalid ${logIdentifiers(message)}`, { context: this.context });
    throw error;
  }

  private async sendEmail(message: QueueRecord, client: INotifyClient): Promise<string> {
    const personalisation = {
      subject: message.email?.message_subject,
      content: message.message_content,
    };

    let notificationId: string;
    try {
      // after schema validation we know the message will have a valid email object so it's safe to cast
      const emailAddress = (message.email as Email).email_address;
      const { body }: NotifyResponse<SenderResponseBody> = await client.sendEmail(this.templateKey, emailAddress, {
        personalisation,
        reference: message.reference || '',
      });
      notificationId = body.id;
    } catch (e) {
      logger.error(e, `notify-client sendEmail Error ${logIdentifiers(message)}`, { context: this.context });
      this.logNotifySendError(e, message);
      throw new NotifySendError();
    }

    this.logger.log(`Notify-client:sendEmail:: Notification sent, notify id: ${notificationId} ${logIdentifiers(message)}`, { context: this.context });

    return notificationId;
  }

  private async sendLetter(message: QueueRecord, client: INotifyClient): Promise<string> {
    // @Todo: fix this when the placeholder fields for letter template are finalised
    const personalisation = {
      ...message.letter,
      body: message.message_content,
    };
    let notificationId: string;
    try {
      const { body }: NotifyResponse<SenderResponseBody> = await client.sendLetter(this.templateKey, {
        personalisation,
        reference: message.reference || '',
      });
      notificationId = body.id;
    } catch (e) {
      logger.error(e, `notify-client sendLetter Error ${logIdentifiers(message)}`, { context: this.context });
      this.logNotifySendError(e, message);
      throw new NotifySendError();
    }

    this.logger.log(`Notify-client:sendLetter:: Notification sent, notify id: ${notificationId} ${logIdentifiers(message)}`, { context: this.context });

    return notificationId;
  }

  private logNotifySendError(e: NotifyError, message: QueueRecord): void {
    if (e?.error?.status_code) {
      const { status_code: code, errors } = e.error;
      const logMessage = `Notify send error: ${code} - ${errors[0].message} ${logIdentifiers(message)}`;
      this.logger.error({ name: 'NotifyError', ...errors[0] }, logMessage, { context: this.context });
      switch (code) {
        case 400:
          this.logger.critical(logMessage, { context: this.context });
          break;
        case 403:
        case 429:
          this.logger.error({ name: 'NotifyError', ...errors[0] }, logMessage, { context: this.context });
          break;
        case 500:
          this.logger.warn(logMessage, { context: this.context });
          break;
        default:
          this.logger.warn(`Unrecognised error code ${code} ${errors[0].message} ${logIdentifiers(message)}`, { context: this.context });
      }
    }
  }
}

export default NotifyController;
