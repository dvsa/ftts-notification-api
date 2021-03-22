import Collector from '../../../src/dlq-collector/dlq-collector';
import { serviceBusQueueTrigger } from '../../../src/dlq-collector/status';
import loaders from '../../../src/loaders/index';
import { emailQueueRecord } from '../../mocks/sender';
import { mockedContext } from '../../mocks/context.mock';
import { mockedLogger } from '../../mocks/logger.mock';

jest.mock('typedi');
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/loaders/index');
jest.mock('../../../src/dlq-collector/dlq-collector');

describe('Send DLQ Status Entrypoint', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('Loaders is run', async () => {
    await serviceBusQueueTrigger(mockedContext as any);

    expect(loaders).toHaveBeenCalled();
  });

  test('Status is processed via DeadLetterQueueCollector', async () => {
    const message = { ...emailQueueRecord };

    await serviceBusQueueTrigger(mockedContext, message);

    expect(Collector).toHaveBeenCalled();
    expect(Collector.prototype.processMessage).toHaveBeenCalledWith(mockedContext, message);
  });

  test('Undefined message is logged without throwing', async () => {
    const message = null;

    await serviceBusQueueTrigger(mockedContext as any, message);

    expect(mockedLogger.info).toHaveBeenCalledWith(
      'Status DLQ collector - service bus message does not exist',
      expect.objectContaining({}),
    );
  });
});
