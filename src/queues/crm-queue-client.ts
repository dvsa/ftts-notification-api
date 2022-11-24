import { SendableMessageInfo, ServiceBusClient, Sender } from '@azure/service-bus';
import config from '../config';

export class CRMQueueClient {
  constructor(
    private sender: Sender,
  ) { }

  public async sendMessage(message: SendableMessageInfo): Promise<void> {
    await this.sender.send(message);
  }
}

const crmQueueName = process.env.USE_CRM_STUB === 'true' ? config.queues.stubCrmResult.name : config.queues.crmResult.name;
const crmServiceBusClient = ServiceBusClient.createFromConnectionString(config.serviceBus.crmConnectionString);
const crmQueueClient = crmServiceBusClient.createQueueClient(crmQueueName);

export default new CRMQueueClient(
  crmQueueClient.createSender(),
);
