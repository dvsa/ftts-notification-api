import { MessagingError } from '@azure/service-bus';
import { mocked } from 'ts-jest/utils';
import { handleError } from '../../../src/utils/handleError';
import { internalAccessDeniedError } from '../../../src/services/egress-filter';
import { SchemaValidationError } from '../../../src/utils/schemaValidationError';
import { mockedContext } from '../../mocks/context.mock';

jest.mock('../../../src/services/egress-filter');
const mockedInternalAccessDeniedError = mocked(internalAccessDeniedError, true);

describe('handleError', () => {
  const functionName = 'fn';

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('for egress related MessagingError it delegates handling to internalAccessDeniedError', () => {
    const error = new MessagingError('Unrecognised address');

    expect(() => handleError(error, mockedContext, functionName)).toThrow(error);
    expect(mockedInternalAccessDeniedError).toHaveBeenCalled();
  });

  test('for SchemaValidationError it builds 400 response', () => {
    const errorMessage = 'yor object is wrong';
    const error = new SchemaValidationError(errorMessage);

    handleError(error, mockedContext, functionName);

    expect(mockedInternalAccessDeniedError).toHaveBeenCalledTimes(0);
    expect(mockedContext.res).toEqual({
      status: 400,
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        description: errorMessage,
      },
    });
  });

  test('for other errors it rethrows', () => {
    const error = new Error('just a normal error, nothing special');

    expect(() => handleError(error, mockedContext, functionName)).toThrow(error);
    expect(mockedInternalAccessDeniedError).toHaveBeenCalledTimes(0);
  });
});
