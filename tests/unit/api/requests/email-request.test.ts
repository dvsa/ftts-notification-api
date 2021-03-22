import * as Factory from 'factory.ts';
import uuid from 'uuid';
import { Target, MessageType } from '../../../../src/lib/enums';
import { EmailHttpRequest, EmailRequestBody } from '../../../../src/interfaces/api';

import EmailRequest from '../../../../src/api/requests/email-request';
import { globalDate } from '../../../mocks/date.mock';

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
  body: requestBodyFactory.build(overrides),
});

const mockInvalidRequests = [
  ['empty request', {}],
  ['empty \'message_content\' value', buildMockRequest({ message_content: '' })],
  ['whitespace \'message_content\' value', buildMockRequest({ message_content: '  ' })],
  ['null \'message_subject\' value', buildMockRequest({ message_subject: null })],
  ['undefined \'email_address\' value', buildMockRequest({ email_address: undefined })],
  ['invalid \'target\' value', buildMockRequest({ target: 'DE' })],
  ['numeric \'reference\' value', buildMockRequest({ reference: 1234 })],
  ['numeric \'context_id\' value', buildMockRequest({ reference: 1234 })],
];

describe('EmailRequest class', () => {
  describe('isValid method', () => {
    describe('if the request is valid', () => {
      test('returns true', () => {
        const mockReq = buildMockRequest();

        const request = new EmailRequest(mockReq as any);
        const isValid = request.isValid();

        expect(isValid).toEqual(true);
      });

      describe('optional properties not required', () => {
        test('returns true', () => {
          const mockReq = buildMockRequest();
          delete mockReq.body.reference;
          delete mockReq.body.context_id;

          const request = new EmailRequest(mockReq as any);
          const isValid = request.isValid();

          expect(isValid).toEqual(true);
        });
      });

      describe('target property case insensitive', () => {
        test('returns true', () => {
          const mockReq = buildMockRequest();
          (mockReq.body.target as string) = 'GB';

          const request = new EmailRequest(mockReq as any);
          const isValid = request.isValid();

          expect(isValid).toEqual(true);
        });
      });
    });

    describe('if the request is invalid:', () => {
      describe.each(mockInvalidRequests)('%s', (name, mockInvalidReq) => {
        test('returns false', () => {
          const request = new EmailRequest(mockInvalidReq as any);
          const isValid = request.isValid();

          expect(isValid).toEqual(false);
        });
      });

      describe('missing required property', () => {
        test('returns false', () => {
          const mockInvalidReq = buildMockRequest();
          delete mockInvalidReq.body.target;

          const request = new EmailRequest(mockInvalidReq as any);
          const isValid = request.isValid();

          expect(isValid).toEqual(false);
        });
      });

      describe('random extraneous property', () => {
        test('returns false', () => {
          const mockInvalidReq = buildMockRequest();
          mockInvalidReq.body.foo = 'bar';

          const request = new EmailRequest(mockInvalidReq);
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
          message_subject: 'messageSubject',
          target: 'GB',
          email_address: 'test@email.com',
          reference: '1234',
          context_id: '1234',
        },
      };

      const request = new EmailRequest(mockReq as any);
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
      const request = new EmailRequest(mockReq as any);

      const queueRecord = request.mapToQueueRecord();

      expect(uuid.v4).toBeCalled();
      expect(queueRecord).toEqual(expect.objectContaining({
        trace_id: 'traceIdPlaceholder',
      }));
    });
  });
});
