import Collector from '../../../src/dlq-collector/dlq-collector';
import { serviceBusQueueTrigger } from '../../../src/dlq-collector/request';
import { QueueRecord } from '../../../src/interfaces/queue';
import loaders from '../../../src/loaders/index';
import { mockedContext } from '../../mocks/context.mock';
import { mockedLogger } from '../../mocks/logger.mock';
import { buildEmailQueueRecord } from '../../mocks/queue-records';
import { emailQueueRecord } from '../../mocks/sender';

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

    await serviceBusQueueTrigger(mockedContext, message);

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

    await serviceBusQueueTrigger(mockedContext, message);

    expect(mockedLogger.info).toHaveBeenCalledWith(
      'Notifications Request DLQ Collector::serviceBusQueueTrigger: service bus message does not exist',
      {
        context: mockedContext,
      },
    );
  });
});
