import dotenv from 'dotenv';
import { mocked } from 'ts-jest/utils';
import envLoader from '../../../src/loaders/env';

jest.mock('dotenv');

const mockedDotEnv = mocked(dotenv, true);

describe('Environment Loader', () => {
  const originalEnv = process.env;

  afterEach(() => {
    jest.clearAllMocks();
    process.env = originalEnv;
  });

  test('Ensure node env is set to deployment if non exists', () => {
    mockedDotEnv.config.mockImplementationOnce(() => ({}));
    delete process.env.NODE_ENV;

    envLoader();

    expect(process.env.NODE_ENV).toStrictEqual('development');
  });

  test('Ensure an error is thrown if .env file is not present in development', () => {
    process.env.NODE_ENV = 'development';
    mockedDotEnv.config.mockImplementationOnce(() => ({
      error: new Error('error found'),
    }));

    expect(() => envLoader()).toThrow();
  });
});
