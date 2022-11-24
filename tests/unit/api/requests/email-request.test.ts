/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as Factory from 'factory.ts';
import uuid from 'uuid';
import { Target, MessageType } from '../../../../src/lib/enums';
import { EmailHttpRequest, EmailRequestBody } from '../../../../src/interfaces/api';

import EmailRequest from '../../../../src/api/requests/email-request';
import { globalDate } from '../../../mocks/date.mock';
import { SchemaValidationError } from '../../../../src/utils/schemaValidationError';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'traceIdPlaceholder'),
}));

const requestBodyFactory = Factory.makeFactory<EmailRequestBody>({
  message_content: 'messageContent',
  message_subject: 'messageSubject',
  target: Factory.each((i) => (i % 2 === 0 ? Target.GB : Target.NI)),
  email_address: 'test@email.com',
  reference: Factory.each((i) => String(i + 1000)),
  context_id: Factory.each((i) => String(i + 2000)),
});

const buildMockRequest = (overrides?): Partial<EmailHttpRequest> => ({
  // disabled as we are trying to test input that deviates from the type
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  body: requestBodyFactory.build(overrides),
});

const mockInvalidRequests = [
  ['empty request', {}, 'data should have required property \'email_address\''],
  ['empty \'message_content\' value', buildMockRequest({ message_content: '' }), 'data.message_content should pass "notEmpty" keyword validation'],
  ['whitespace \'message_content\' value', buildMockRequest({ message_content: '  ' }), 'data.message_content should pass "notEmpty" keyword validation'],
  ['null \'message_subject\' value', buildMockRequest({ message_subject: null }), 'data.message_subject should be string'],
  ['undefined \'email_address\' value', buildMockRequest({ email_address: undefined }), 'data should have required property \'email_address\''],
  ['invalid \'target\' value', buildMockRequest({ target: 'DE' }), 'data.target should be equal to one of the allowed values'],
  ['numeric \'reference\' value', buildMockRequest({ reference: 1234 }), 'data.reference should be string'],
  ['numeric \'context_id\' value', buildMockRequest({ context_id: 1234 }), 'data.context_id should be string'],
];

describe('EmailRequest class', () => {
  describe('validate', () => {
    describe('if the request is valid', () => {
      test('does not throw an error', () => {
        const mockReq = buildMockRequest();

        const request = new EmailRequest(mockReq as EmailHttpRequest);

        expect(() => request.validate()).not.toThrow();
      });

      describe('optional properties not required', () => {
        test('does not throw an error', () => {
          const mockReq = buildMockRequest();
          delete mockReq.body.reference;
          delete mockReq.body.context_id;

          const request = new EmailRequest(mockReq as EmailHttpRequest);

          expect(() => request.validate()).not.toThrow();
        });
      });

      describe('target property case insensitive', () => {
        test('does not throw an error', () => {
          const mockReq = buildMockRequest();
          (mockReq.body.target as string) = 'GB';

          const request = new EmailRequest(mockReq as EmailHttpRequest);

          expect(() => request.validate()).not.toThrow();
        });
      });
    });

    describe('if the request is invalid:', () => {
      describe.each(mockInvalidRequests)('%s', (name, mockInvalidReq, expectedMessage) => {
        test('throws an error', () => {
          const request = new EmailRequest(mockInvalidReq as EmailHttpRequest);

          expect(() => request.validate()).toThrow(new SchemaValidationError(expectedMessage as string));
        });
      });

      describe('missing required property', () => {
        test('throws an error', () => {
          const mockInvalidReq = buildMockRequest();
          delete mockInvalidReq.body.target;

          const request = new EmailRequest(mockInvalidReq as EmailHttpRequest);

          expect(() => request.validate()).toThrow(new SchemaValidationError('data should have required property \'target\''));
        });
      });

      describe('random extraneous property', () => {
        test('throws an error', () => {
          const mockInvalidReq = buildMockRequest();
          mockInvalidReq.body.foo = 'bar';

          const request = new EmailRequest(mockInvalidReq as EmailHttpRequest);

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
          message_subject: 'messageSubject',
          target: 'GB',
          email_address: 'test@email.com',
          reference: '1234',
          context_id: '1234',
        },
      };

      const request = new EmailRequest(mockReq as EmailHttpRequest);
      const queueRecord = request.mapToQueueRecord();

      expect(queueRecord).toStrictEqual({
        message_type: MessageType.EMAIL,
        no_of_request_retries: 0,
        no_of_retries: 0,
        message_content: 'messageContent',
        target: 'GB',
        email: {
          message_subject: 'messageSubject',
          email_address: 'test@email.com',
        },
        reference: '1234',
        context_id: '1234',
        trace_id: 'traceIdPlaceholder',
        date: globalDate,
      });
    });

    test('mapped record includes a trace_id', () => {
      const mockReq = buildMockRequest();
      const request = new EmailRequest(mockReq as EmailHttpRequest);

      const queueRecord = request.mapToQueueRecord();

      expect(uuid.v4).toHaveBeenCalled();
      expect(queueRecord).toEqual(expect.objectContaining({
        trace_id: 'traceIdPlaceholder',
      }));
    });
  });
});
