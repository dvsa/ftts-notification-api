/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as Factory from 'factory.ts';
import uuid from 'uuid';
import LetterRequest from '../../../../src/api/requests/letter-request';
import { LetterHttpRequest, LetterRequestBody } from '../../../../src/interfaces/api';
import { MessageType, Target } from '../../../../src/lib/enums';
import { SchemaValidationError } from '../../../../src/utils/schemaValidationError';
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
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  body: requestBodyFactory.build(overrides),
});

const mockInvalidRequests = [
  ['empty request', {}, 'data should have required property \'address_line_1\''],
  ['null \'message_content\' property', buildMockRequest({ message_content: null }), 'data.message_content should be string'],
  ['empty \'address_line_1\' value', buildMockRequest({ address_line_1: '' }), 'data.address_line_1 should pass "notEmpty" keyword validation'],
  ['undefined \'address_line_2\' value', buildMockRequest({ address_line_2: undefined }), 'data should have required property \'address_line_2\''],
  ['numeric \'postcode\' value', buildMockRequest({ postcode: 12345678 }), 'data.postcode should be string'],
  ['object \'name\' value', buildMockRequest({ name: { foo: 'bar' } }), 'data.name should be string'],
  ['null \'target\' value', buildMockRequest({ target: null }), 'data.target should be string'],
  ['numeric \'reference\' value', buildMockRequest({ reference: 1234 }), 'data.reference should be string'],
  ['numeric \'context_id\' value', buildMockRequest({ context_id: 1234 }), 'data.context_id should be string'],
];

describe('LetterRequest class', () => {
  describe('isValid method', () => {
    describe('if the request is valid', () => {
      test('does not throw an error', () => {
        const mockReq = buildMockRequest();

        const request = new LetterRequest(mockReq as LetterHttpRequest);

        expect(() => request.validate()).not.toThrow();
      });

      describe('optional properties not required', () => {
        test('does not throw an error', () => {
          const mockReq = buildMockRequest();
          delete mockReq.body.address_line_3;
          delete mockReq.body.address_line_4;
          delete mockReq.body.address_line_5;
          delete mockReq.body.address_line_6;
          delete mockReq.body.reference;
          delete mockReq.body.context_id;

          const request = new LetterRequest(mockReq as LetterHttpRequest);

          expect(() => request.validate()).not.toThrow();
        });
      });

      describe('target property case insensitive', () => {
        test('does not throw an error', () => {
          const mockReq = buildMockRequest();
          (mockReq.body.target as string) = 'NI';

          const request = new LetterRequest(mockReq as LetterHttpRequest);

          expect(() => request.validate()).not.toThrow();
        });
      });
    });

    describe('if the request is invalid:', () => {
      describe.each(mockInvalidRequests)('%s', (name, mockInvalidReq, expectedMessage) => {
        test('throws an error', () => {
          const request = new LetterRequest(mockInvalidReq as LetterHttpRequest);

          expect(() => request.validate()).toThrow(new SchemaValidationError(expectedMessage as string));
        });
      });

      describe('missing required property', () => {
        test('returns false', () => {
          const mockInvalidReq = buildMockRequest();
          delete mockInvalidReq.body.name;

          const request = new LetterRequest(mockInvalidReq as LetterHttpRequest);

          expect(() => request.validate()).toThrow(new SchemaValidationError('data should have required property \'name\''));
        });
      });

      describe('random extraneous property', () => {
        test('returns false', () => {
          const mockInvalidReq = buildMockRequest();
          mockInvalidReq.body.foo = 'bar';

          const request = new LetterRequest(mockInvalidReq as LetterHttpRequest);

          expect(() => request.validate()).toThrow(new SchemaValidationError('data should NOT have additional properties'));
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

      const request = new LetterRequest(mockReq as LetterHttpRequest);
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
      const request = new LetterRequest(mockReq as LetterHttpRequest);

      const queueRecord = request.mapToQueueRecord();

      expect(uuid.v4).toHaveBeenCalled();
      expect(queueRecord).toEqual(expect.objectContaining({
        trace_id: 'traceIdPlaceholder',
      }));
    });
  });
});
