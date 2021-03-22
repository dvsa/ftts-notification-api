import { mocked } from 'ts-jest/utils';
import { logger } from '../../src/utils/logger';

jest.mock('../../src/utils/logger');

export const mockedLogger = mocked(logger, true);
