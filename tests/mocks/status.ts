import { StatusResponseBody } from 'notifications-node-client';

export const statusResponse: StatusResponseBody = {
  id: 'notify_id',
  body: 'Hello Foo',
  subject: 'email_subject',
  reference: 'client reference',
  email_address: 'email address',
  phone_number: 'phone number',
  line_1: 'full name of a person or company',
  line_2: '123 The Street',
  line_3: 'Some Area',
  line_4: 'Some Town',
  line_5: 'Some county',
  line_6: 'Something else',
  postcode: 'postcode',
  postage: 'first or second',
  type: 'email',
  status: 'current status',
  template: {
    version: 1,
    id: 1,
    uri: '/template/{id}/{version}',
  },
  created_by_name: 'name of the person who sent the notification if sent manually',
  created_at: 'created at',
  sent_at: 'sent to provider at',
};
