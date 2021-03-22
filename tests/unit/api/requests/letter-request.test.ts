import * as Factory from 'factory.ts';
import uuid from 'uuid';
import { Target, MessageType } from '../../../../src/lib/enums';
import { LetterHttpRequest, LetterRequestBody } from '../../../../src/interfaces/api';

import LetterRequest from '../../../../src/api/requests/letter-request';
import { globalDate } from '../../../mocks/date.mock';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'traceIdPlaceholder'),
}));

const requestBodyFactory = Factory.makeFactory<LetterRequestBody>({
  message_content: 'messageContent',
  target: Factory.each((i) => (i % 2 === 0 ? Target.GB : Target.NI)),
  name: 'John Smith',
  address_line_1: '10 Test Street',
  address_line_2: 'An address line',
  address_line_3: 'Another address line',
  address_line_4: 'Yet another address line',
  address_line_5: 'And another...',
  address_line_6: 'And another',
  postcode: 'T1 EST',
  reference: Factory.each((i) => String(i + 3000)),
  context_id: Factory.each((i) => String(i + 4000)),
});

const buildMockRequest = (overrides?): Partial<LetterHttpRequest> => ({
  body: requestBodyFactory.build(overrides),
});

const mockInvalidRequests = [
  ['empty request', {}],
  ['null \'message_content\' property', buildMockRequest({ message_content: null })],
  ['empty \'address_line_1\' value', buildMockRequest({ address_line_1: '' })],
  ['undefined \'address_line_2\' value', buildMockRequest({ address_line_2: undefined })],
  ['numeric \'postcode\' value', buildMockRequest({ postcode: 12345678 })],
  ['object \'name\' value', buildMockRequest({ name: { foo: 'bar' } })],
  ['null \'target\' value', buildMockRequest({ target: null })],
  ['numeric \'reference\' value', buildMockRequest({ reference: 1234 })],
  ['numeric \'context_id\' value', buildMockRequest({ reference: 1234 })],
];

describe('LetterRequest class', () => {
  describe('isValid method', () => {
    describe('if the request is valid', () => {
      test('returns true', () => {
        const mockReq = buildMockRequest();

        const request = new LetterRequest(mockReq as any);
        const isValid = request.isValid();

        expect(isValid).toEqual(true);
      });

      describe('optional properties not required', () => {
        test('returns true', () => {
          const mockReq = buildMockRequest();
          delete mockReq.body.address_line_3;
          delete mockReq.body.address_line_4;
          delete mockReq.body.address_line_5;
          delete mockReq.body.address_line_6;
          delete mockReq.body.reference;
          delete mockReq.body.context_id;

          const request = new LetterRequest(mockReq as any);
          const isValid = request.isValid();

          expect(isValid).toEqual(true);
        });
      });

      describe('target property case insensitive', () => {
        test('returns true', () => {
          const mockReq = buildMockRequest();
          (mockReq.body.target as string) = 'NI';

          const request = new LetterRequest(mockReq as any);
          const isValid = request.isValid();

          expect(isValid).toEqual(true);
        });
      });
    });

    describe('if the request is invalid:', () => {
      describe.each(mockInvalidRequests)('%s', (name, mockInvalidReq) => {
        test('returns false', () => {
          const request = new LetterRequest(mockInvalidReq as any);
          const isValid = request.isValid();

          expect(isValid).toEqual(false);
        });
      });

      describe('missing required property', () => {
        test('returns false', () => {
          const mockInvalidReq = buildMockRequest();
          delete mockInvalidReq.body.name;

          const request = new LetterRequest(mockInvalidReq as any);
          const isValid = request.isValid();

          expect(isValid).toEqual(false);
        });
      });

      describe('random extraneous property', () => {
        test('returns false', () => {
          const mockInvalidReq = buildMockRequest();
          mockInvalidReq.body.foo = 'bar';

          const request = new LetterRequest(mockInvalidReq);
          const isValid = request.isValid();

          expect(isValid).toEqual(false);
        });
      });
    });
  });

  describe('mapToQueueRecord method', () => {
    test('converts the request to a queue record', () => {
      const mockReq = {
        body: {
          message_content: 'messageContent',
          target: 'GB',
          name: 'John Smith',
          address_line_1: '10 My Street',
          address_line_2: 'My Town',
          address_line_3: 'Another address line',
          postcode: 'T1 3ST',
          reference: '1234',
          context_id: '1234',
        },
      };

      const request = new LetterRequest(mockReq as any);
      const queueRecord = request.mapToQueueRecord();

      expect(queueRecord).toStrictEqual({
        message_type: MessageType.LETTER,
        no_of_request_retries: 0,
        no_of_retries: 0,
        message_content: 'messageContent',
        target: 'GB',
        letter: {
          name: 'John Smith',
          address_line_1: '10 My Street',
          address_line_2: 'My Town',
          address_line_3: 'Another address line',
          address_line_4: undefined,
          address_line_5: undefined,
          address_line_6: undefined,
          postcode: 'T1 3ST',
        },
        reference: '1234',
        context_id: '1234',
        trace_id: 'traceIdPlaceholder',
        date: globalDate,
      });
    });

    test('mapped record includes a trace_id', () => {
      const mockReq = buildMockRequest();
      const request = new LetterRequest(mockReq as any);

      const queueRecord = request.mapToQueueRecord();

      expect(uuid.v4).toBeCalled();
      expect(queueRecord).toEqual(expect.objectContaining({
        trace_id: 'traceIdPlaceholder',
      }));
    });
  });
});
