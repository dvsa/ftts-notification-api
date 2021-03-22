import dependencyInjectorLoader from '../../../src/loaders/dependencyinjector';
import envLoader from '../../../src/loaders/env';
import loaders from '../../../src/loaders/index';
import { mockedContext } from '../../mocks/context.mock';

jest.mock('../../../src/loaders/dependencyinjector');
jest.mock('../../../src/loaders/env');
jest.mock('../../mocks/logger.mock');

describe('Loaders', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('Ensure env is loaded', () => {
    loaders(mockedContext);

    expect(envLoader).toHaveBeenCalled();
  });

  test('Ensure dependency injector is loaded', () => {
    loaders(mockedContext);

    expect(dependencyInjectorLoader).toHaveBeenCalled();
  });
});
