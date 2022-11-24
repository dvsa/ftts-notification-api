import { InternalAccessDeniedError } from '@dvsa/egress-filtering';
import { internalAccessDeniedError } from '../../../src/services/egress-filter';
import { logger } from '../../../src/utils/logger';

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    security: jest.fn(),
    event: jest.fn(),
  },
  BusinessTelemetryEvent: {
    NOTIF_NOT_WHITELISTED_URL_CALL: 'NOT_WHITELISTED_URL_CALL',
  },
}));

describe('Egress filter service', () => {
  test('errors are handled', () => {
    const error: InternalAccessDeniedError = {
      name: 'mock egress error',
      host: 'mockhost',
      port: '1234',
      message: 'mock message',
    };

    internalAccessDeniedError(error);

    expect(logger.security).toHaveBeenCalledWith('NOT_WHITELISTED_URL_CALL', {
      host: 'mockhost',
      port: '1234',
      reason: '{"name":"mock egress error","host":"mockhost","port":"1234","message":"mock message"}',
    });
    expect(logger.event).toHaveBeenCalledWith('NOT_WHITELISTED_URL_CALL', 'mock message', {
      host: 'mockhost',
      port: '1234',
      reason: '{"name":"mock egress error","host":"mockhost","port":"1234","message":"mock message"}',
    });
  });
});
