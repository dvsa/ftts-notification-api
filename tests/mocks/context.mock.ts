/* eslint-disable @typescript-eslint/no-explicit-any */
import { Context } from '@azure/functions';

export const mockedContext: Context = {
  invocationId: '',
  executionContext: {
    invocationId: '',
    functionName: '',
    functionDirectory: '',
  },
  bindings: {},
  bindingData: {},
  traceContext: {
    traceparent: 'traceParent',
    tracestate: null,
    attributes: {},
  },
  bindingDefinitions: [],
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  log: jest.fn() as any,
  done: (err?: Error | string | null): void => console.log(err),
};
