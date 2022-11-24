import dependencyInjectorLoader from '../../../src/loaders/dependencyinjector';
import loaders from '../../../src/loaders/index';
import { mockedContext } from '../../mocks/context.mock';

jest.mock('../../../src/loaders/dependencyinjector');
jest.mock('../../mocks/logger.mock');

describe('Loaders', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('Ensure dependency injector is loaded', () => {
    loaders(mockedContext);

    expect(dependencyInjectorLoader).toHaveBeenCalled();
  });
});
