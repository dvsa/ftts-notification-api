import StatusQueueProcessor from '../../../src/status/status-queue-processor';
import { statusTimerTrigger } from '../../../src/status/index';
import loaders from '../../../src/loaders/index';
import { emailQueueRecord } from '../../mocks/sender';
import { mockedContext } from '../../mocks/context.mock';

jest.mock('@dvsa/azure-logger');
jest.mock('../../../src/loaders/index');
jest.mock('../../../src/status/status-queue-processor');

describe('Status Checker Entrypoint', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('Loaders is run', async () => {
    await statusTimerTrigger(mockedContext);

    expect(loaders).toHaveBeenCalled();
  });

  test('Request is processed by StatusQueueProcessor', async () => {
    const message = { ...emailQueueRecord };
    await statusTimerTrigger(mockedContext, message);

    expect(StatusQueueProcessor).toHaveBeenCalled();
    expect(StatusQueueProcessor.prototype.processQueue).toHaveBeenCalled();
  });
});
