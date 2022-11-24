import { SendableMessageInfo, ServiceBusClient, Sender } from '@azure/service-bus';
import config from '../config';

export class RequestQueueClient {
  constructor(private sender: Sender) { }

  public async sendMessage(message: SendableMessageInfo): Promise<void> {
    await this.sender.send(message);
  }

  public async scheduleMessage(retryTime: Date, serviceBusMessage: SendableMessageInfo): Promise<void> {
    await this.sender.scheduleMessage(retryTime, serviceBusMessage);
  }
}

const serviceBusClient = ServiceBusClient.createFromConnectionString(config.serviceBus.apiConnectionString);
const queueClient = serviceBusClient.createQueueClient(config.queues.notificationRequest.name);

export default new RequestQueueClient(
  queueClient.createSender(),
);
