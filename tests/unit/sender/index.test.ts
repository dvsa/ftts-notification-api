import NotifySender from '../../../src/sender/sender';
import { serviceBusQueueTrigger } from '../../../src/sender/index';
import loaders from '../../../src/loaders/index';
import { emailQueueRecord } from '../../mocks/sender';
import { BusinessTelemetryEvent } from '../../../src/utils/logger';
import { mockedContext } from '../../mocks/context.mock';
import { mockedLogger } from '../../mocks/logger.mock';

jest.mock('../../../src/utils/logger');
jest.mock('../../../src/loaders/index');
jest.mock('../../../src/sender/sender');

describe('Sender Entrypoint', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('Loaders is run', async () => {
    await serviceBusQueueTrigger(mockedContext as any);

    expect(loaders).toHaveBeenCalled();
  });

  test('Request is processed by NotifySender', async () => {
    const message = { ...emailQueueRecord };
    await serviceBusQueueTrigger(mockedContext as any, message);

    expect(NotifySender).toHaveBeenCalled();
    expect(NotifySender.prototype.processMessage).toHaveBeenCalledWith(message);
  });

  test('Undefined message is logged without throwing', async () => {
    const message = null;
    await serviceBusQueueTrigger(mockedContext as any, message);

    expect(mockedLogger.logEvent).toHaveBeenCalledWith(mockedContext, BusinessTelemetryEvent.NOTIF_SENDER_FAIL_READ_QUEUE, expect.any(String));
    expect(mockedLogger.info).toHaveBeenCalledWith('Sender:serviceBusQueueTrigger::logger:: Queue message does not exist', expect.objectContaining({}));
  });
});
