import Collector from '../../../src/dlq-collector/dlq-collector';
import { serviceBusQueueTrigger } from '../../../src/dlq-collector/request';
import loaders from '../../../src/loaders/index';
import { emailQueueRecord } from '../../mocks/sender';
import { mockedContext } from '../../mocks/context.mock';
import { buildEmailQueueRecord } from '../../mocks/queue-records';
import { QueueRecord } from '../../../src/interfaces/queue';
import { mockedLogger } from '../../mocks/logger.mock';

jest.mock('typedi');
jest.mock('../../../src/loaders/index');
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/dlq-collector/dlq-collector');

describe('Send DLQ Request Entrypoint', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('Loaders is run', async () => {
    const message: QueueRecord = buildEmailQueueRecord();

    await serviceBusQueueTrigger(mockedContext as any, message);

    expect(loaders).toHaveBeenCalled();
  });

  test('Request is processed via DeadLetterQueueCollector', async () => {
    const message = { ...emailQueueRecord };

    await serviceBusQueueTrigger(mockedContext, message);

    expect(Collector).toHaveBeenCalled();
    expect(Collector.prototype.processMessage).toHaveBeenCalledWith(mockedContext, message);
  });

  test('Undefined message is logged without throwing', async () => {
    const message = null;

    await serviceBusQueueTrigger(mockedContext as any, message);

    expect(mockedLogger.info).toHaveBeenCalledWith(
      'Request DLQ collector - service bus message does not exist',
      expect.objectContaining({}),
    );
  });
});
