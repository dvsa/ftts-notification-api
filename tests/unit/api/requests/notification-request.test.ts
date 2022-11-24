/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as Factory from 'factory.ts';
import uuid from 'uuid';
import { NotificationRequestBody, SendNotificationHttpRequest } from '../../../../src/interfaces/api';
import { Agency, BookingCategory, Channel, Language, MessageType } from '../../../../src/lib/enums';
import { SchemaValidationError } from '../../../../src/utils/schemaValidationError';
import { globalDate } from '../../../mocks/date.mock';
import NotificationRequest from '../../../../src/api/requests/notification-request';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'traceIdPlaceholder'),
}));

const requestBodyFactory = Factory.makeFactory<NotificationRequestBody>({
  channel: Channel.LETTER,
  agency: Agency.DVSA,
  language: Language.EN,
  category: BookingCategory.STANDARD_BOOKING_CANCELLATION,
  email_address: 'test@email.com',
  postal_address: {
    name: 'John Smith',
    address_line_1: '10 Test Street',
    address_line_2: 'An address line',
    address_line_3: 'Another address line',
    address_line_4: 'Yet another address line',
    address_line_5: 'And another...',
    address_line_6: 'And another',
    postcode: 'T1 EST',
  },
  reference: '3000',
  context_id: '4000',
});

const buildMockRequest = (overrides?): Partial<SendNotificationHttpRequest> => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  body: requestBodyFactory.build(overrides),
});

const mockInvalidRequests = [
  ['empty request', {}, 'data should have required property \'channel\''],
  ['not allowed \'channel\' value', buildMockRequest({ channel: 'letterr' }), 'data.channel should be equal to one of the allowed values'],
  ['not allowed \'agency\' value', buildMockRequest({ agency: 'DV' }), 'data.agency should be equal to one of the allowed values'],
  ['not allowed \'language\' value', buildMockRequest({ language: 'fr' }), 'data.language should be equal to one of the allowed values'],
  ['not allowed \'category\' value', buildMockRequest({ category: 'standard-booking-confirmationn' }), 'data.category should be equal to one of the allowed values'],
  ['null \'email_address\' value', buildMockRequest({ email_address: null }), 'data.email_address should be string'],
  ['null \'postal_address\' value', buildMockRequest({ postal_address: null }), 'data.postal_address should be object'],
  ['numeric \'reference\' value', buildMockRequest({ reference: 1234 }), 'data.reference should be string'],
  ['numeric \'context_id\' value', buildMockRequest({ context_id: 1234 }), 'data.context_id should be string'],
];

describe('LetterRequest class', () => {
  describe('isValid method', () => {
    describe('if the request is valid', () => {
      test('does not throw an error', () => {
        const mockReq = buildMockRequest();

        const request = new NotificationRequest(mockReq as SendNotificationHttpRequest);

        expect(() => request.validate()).not.toThrow();
      });

      describe('optional properties not required', () => {
        test('does not throw an error when channel letter', () => {
          const mockReq = buildMockRequest();
          delete mockReq.body.email_address;
          delete mockReq.body.reference;
          delete mockReq.body.context_id;

          const request = new NotificationRequest(mockReq as SendNotificationHttpRequest);

          expect(() => request.validate()).not.toThrow();
        });

        test('does not throw an error when channel email', () => {
          const mockReq = buildMockRequest();
          mockReq.body.channel = Channel.EMAIL;
          delete mockReq.body.postal_address;
          delete mockReq.body.reference;
          delete mockReq.body.context_id;

          const request = new NotificationRequest(mockReq as SendNotificationHttpRequest);

          expect(() => request.validate()).not.toThrow();
        });
      });
    });

    describe('if the request is invalid:', () => {
      describe.each(mockInvalidRequests)('%s', (name, mockInvalidReq, expectedMessage) => {
        test('throws an error', () => {
          const request = new NotificationRequest(mockInvalidReq as SendNotificationHttpRequest);

          expect(() => request.validate()).toThrow(new SchemaValidationError(expectedMessage as string));
        });
      });

      describe('missing required property', () => {
        test('throws an error', () => {
          const mockInvalidReq = buildMockRequest();
          delete mockInvalidReq.body.channel;

          const request = new NotificationRequest(mockInvalidReq as SendNotificationHttpRequest);

          expect(() => request.validate()).toThrow(new SchemaValidationError('data should have required property \'channel\''));
        });
      });

      describe('random extraneous property', () => {
        test('throws an error', () => {
          const mockInvalidReq = buildMockRequest();
          mockInvalidReq.body.foo = 'bar';

          const request = new NotificationRequest(mockInvalidReq as SendNotificationHttpRequest);

          expect(() => request.validate()).toThrow(new SchemaValidationError('data should NOT have additional properties'));
        });
      });

      describe('fails extra validation if incorrect properties', () =>{
        test('language cy and agency DVA should throw', () => {
          const mockInvalidReq = buildMockRequest({ language:Language.CY, agency: Agency.DVA });

          const request = new NotificationRequest(mockInvalidReq as SendNotificationHttpRequest);

          expect(() => request.validate()).toThrow(new SchemaValidationError('The language can\'t be cy if the agency is DVA'));
        });

        test('channel email and email address missing should throw', () => {
          const mockInvalidReq = buildMockRequest({ channel: Channel.EMAIL, email_address: undefined });

          const request = new NotificationRequest(mockInvalidReq as SendNotificationHttpRequest);

          expect(() => request.validate()).toThrow(new SchemaValidationError('If the channel is email then the email address can\'t be empty'));
        });

        test('channel letter and postal address missing should throw', () => {
          const mockInvalidReq = buildMockRequest({ channel: Channel.LETTER, postal_address: undefined });

          const request = new NotificationRequest(mockInvalidReq as SendNotificationHttpRequest);

          expect(() => request.validate()).toThrow(new SchemaValidationError('If the channel is letter then the postal_address can\'t be empty'));
        });
      });
    });
  });

  describe('mapToQueueRecord method', () => {
    test('converts the email request to a queue record', () => {
      const mockReq = {
        body: {
          channel: Channel.EMAIL,
          agency: Agency.DVSA,
          language: Language.EN,
          category: BookingCategory.STANDARD_BOOKING_CONFIRMATION,
          email_address: 'fake@email.com',
          name: 'John Smith',
          reference: '1234',
          context_id: '1234',
        },
      };

      const request = new NotificationRequest(mockReq as unknown as SendNotificationHttpRequest);
      const queueRecord = request.mapToQueueRecord();

      expect(queueRecord).toStrictEqual({
        message_type: MessageType.NOTIFICATION,
        no_of_request_retries: 0,
        no_of_retries: 0,
        notification:  {
          agency: 'DVSA',
          category: 'standard-booking-confirmation',
          channel: 'email',
          language: 'en',
          email_address: 'fake@email.com',
        },
        reference: '1234',
        context_id: '1234',
        trace_id: 'traceIdPlaceholder',
        date: globalDate,
      });
    });

    test('converts the letter request to a queue record', () => {
      const mockReq = {
        body: {
          channel: Channel.LETTER,
          agency: Agency.DVSA,
          language: Language.EN,
          postal_address:{
            name: 'John Smith',
            address_line_1: '10 My Street',
            address_line_2: 'My Town',
            address_line_3: 'Another address line',
            address_line_4: undefined,
            address_line_5: undefined,
            address_line_6: undefined,
            postcode: 'T1 3ST',
          },
          category: BookingCategory.STANDARD_BOOKING_CONFIRMATION,
          reference: '1234',
          context_id: '1234',
        },
      };

      const request = new NotificationRequest(mockReq as unknown as SendNotificationHttpRequest);
      const queueRecord = request.mapToQueueRecord();

      expect(queueRecord).toStrictEqual({
        message_type: MessageType.NOTIFICATION,
        no_of_request_retries: 0,
        no_of_retries: 0,
        notification:  {
          agency: 'DVSA',
          category: 'standard-booking-confirmation',
          channel: 'letter',
          language: 'en',
          postal_address:{
            name: 'John Smith',
            address_line_1: '10 My Street',
            address_line_2: 'My Town',
            address_line_3: 'Another address line',
            address_line_4: undefined,
            address_line_5: undefined,
            address_line_6: undefined,
            postcode: 'T1 3ST',
          },
        },
        reference: '1234',
        context_id: '1234',
        trace_id: 'traceIdPlaceholder',
        date: globalDate,
      });
    });

    test('mapped record includes a trace_id', () => {
      const mockReq = buildMockRequest();
      const request = new NotificationRequest(mockReq as unknown as SendNotificationHttpRequest);

      const queueRecord = request.mapToQueueRecord();

      expect(uuid.v4).toHaveBeenCalled();
      expect(queueRecord).toEqual(expect.objectContaining({
        trace_id: 'traceIdPlaceholder',
      }));
    });
  });
});
