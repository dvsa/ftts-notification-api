import {
  ReceiveMode, SendableMessageInfo, ServiceBusClient, Receiver, Sender,
} from '@azure/service-bus';
import config from '../config';
import { StatusServiceBusMessage } from '../interfaces/queue';

export class StatusQueueClient {
  constructor(
    private sender: Sender,
    private receiver: Receiver,
  ) { }

  public async sendMessage(message: SendableMessageInfo): Promise<void> {
    await this.sender.send(message);
  }

  public async scheduleMessage(retryTime: Date, serviceBusMessage: SendableMessageInfo): Promise<void> {
    await this.sender.scheduleMessage(retryTime, serviceBusMessage);
  }

  public async receiveMessages(): Promise<StatusServiceBusMessage[]> {
    return this.receiver.receiveMessages(config.error.status.messageLimit, config.error.status.maxWaitTimeInSeconds);
  }
}

const serviceBusClient = ServiceBusClient.createFromConnectionString(config.serviceBus.apiConnectionString);
const queueClient = serviceBusClient.createQueueClient(config.queues.notificationStatus.name);

export default new StatusQueueClient(
  queueClient.createSender(),
  queueClient.createReceiver(ReceiveMode.peekLock),
);
