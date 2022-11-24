import { Context } from '@azure/functions';
import { InternalAccessDeniedError } from '@dvsa/egress-filtering';
import {
  INotifyClient,
  NotifyResponse, SenderResponseBody, StatusResponseBody,
} from 'notifications-node-client';
import { Container } from 'typedi';
import config from '../../config';
import { NotifyError } from '../../interfaces/notify-error';
import { Email, QueueRecord } from '../../interfaces/queue';
import { MessageType, Target } from '../../lib/enums';
import { NotifySendError } from '../../lib/errors';
import { getIdentifiers } from '../../utils/log';
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
    logger.debug('NotifyController::sendNotification', { message });
    this.validateMessage(message);
    if (message.message_type === MessageType.EMAIL) {
      return this.sendEmail(message, this.getClient(message));
    }
    if (message.message_type === MessageType.LETTER) {
      return this.sendLetter(message, this.getClient(message));
    }
    // In this case we want to log out the raw message type instead of being caught by restricted enums
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    const error = new Error(`NotifyController::sendNotification: ${message.message_type} is an unrecognised message type`);
    this.logger.error(error, 'NotifyController::sendNotification: Message type invalid', { ...(getIdentifiers(message)), context: this.context });
    throw error;
  }

  static async getStatusResponse(target: string, id: string): Promise<StatusResponseBody> {
    const client: INotifyClient = Container.get(`notify:client:${target.toLowerCase()}`);
    const { data } = await client.getNotificationById(id);
    return data;
  }

  private validateMessage(message: QueueRecord): void {
    if (!message.target) {
      const error = new Error('NotifyController::validateMessage: message target not set');
      this.logger.error(
        error,
        'NotifyController::validateMessage: Message missing target',
        {
          ...(getIdentifiers(message)),
          context: this.context,
        },
      );
      throw error;
    }
    if (!message.message_type) {
      const error = new Error('NotifyController::validateMessage: message type not set');
      this.logger.error(
        error,
        'NotifyController::validateMessage: Message missing message_type',
        {
          ...(getIdentifiers(message)),
          context: this.context,
        },
      );
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
    const error = new Error(`NotifyController::getClient: ${message.target.toLowerCase()} is invalid message target`);
    this.logger.error(
      error,
      'NotifyController::getClient: Message target invalid',
      {
        ...(getIdentifiers(message)),
        context: this.context,
      },
    );
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
      const { data }: NotifyResponse<SenderResponseBody> = await client.sendEmail(this.templateKey, emailAddress, {
        personalisation,
        reference: message.reference || '',
      });
      notificationId = data.id;
    } catch (e) {
      logger.error(
        e as Error,
        'NotifyController::sendEmail: Error',
        {
          ...(getIdentifiers(message)),
          context: this.context,
        },
      );
      this.logNotifySendError(e as NotifyError, message);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (e instanceof InternalAccessDeniedError) {
        logger.error(e, `Egress error - ${e?.host}`);
        throw e;
      }
      throw new NotifySendError();
    }

    this.logger.info(
      'NotifyController::sendEmail: Notification sent',
      {
        notificationId,
        ...(getIdentifiers(message)),
        context: this.context,
      },
    );

    return notificationId;
  }

  private async sendLetter(message: QueueRecord, client: INotifyClient): Promise<string> {
    const personalisation = {
      ...message.letter,
      address_line_1: message.letter?.name,
      address_line_2: message.letter?.address_line_1,
      address_line_3: message.letter?.address_line_2,
      address_line_4: message.letter?.address_line_3,
      address_line_5: message.letter?.address_line_4,
      address_line_6: message.letter?.address_line_5,
      address_line_7: message.letter?.address_line_6,
      body: message.message_content,
    };
    let notificationId: string;
    try {
      const { data }: NotifyResponse<SenderResponseBody> = await client.sendLetter(this.templateKey, {
        personalisation,
        reference: message.reference || '',
      });
      notificationId = data.id;
    } catch (e) {
      logger.error(
        e as Error,
        'NotifyController::sendLetter: Error',
        {
          ...(getIdentifiers(message)),
          context: this.context,
        },
      );
      this.logNotifySendError(e as NotifyError, message);
      throw new NotifySendError();
    }

    this.logger.info(
      'NotifyController::sendLetter: Notification sent',
      {
        notificationId,
        ...(getIdentifiers(message)),
        context: this.context,
      },
    );

    return notificationId;
  }

  private logNotifySendError(e: NotifyError, message: QueueRecord): void {
    if (e?.response?.data?.status_code) {
      const { status_code: code, errors } = e.response.data;
      const logMessage = `NotifyController::logNotifySendError: Notify send error: ${code} - ${errors[0].message}`;
      switch (code) {
        case 400:
          this.logger.critical(
            logMessage,
            {
              ...(getIdentifiers(message)),
              context: this.context,
            },
          );
          break;
        case 401:
        case 403:
          this.logger.error(
            {
              name: 'NotifyError',
              ...errors[0],
            },
            logMessage,
            {
              ...(getIdentifiers(message)),
              context: this.context,
            },
          );
          break;
        case 429:
          this.logger.warn(
            logMessage,
            {
              ...(getIdentifiers(message)),
              context: this.context,
            },
          );
          break;
        case 500:
          this.logger.warn(
            logMessage,
            {
              ...(getIdentifiers(message)),
              context: this.context,
            },
          );
          break;
        default:
          this.logger.warn(
            `NotifyController::logNotifySendError: Unrecognised error code ${code} ${errors[0].message}`,
            {
              ...(getIdentifiers(message)),
              context: this.context,
            },
          );
      }
    }
  }
}

export default NotifyController;
