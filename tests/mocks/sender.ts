import { Target, MessageType } from '../../src/lib/enums';

export const emailQueueRecord = {
  message_content: 'Another test\nnext paragraph',
  message_type: MessageType.EMAIL,
  target: Target.GB,
  email: {
    message_subject: 'Message Subject',
    email_address: 'test@email.com',
  },
  no_of_request_retries: 0,
  no_of_retries: 0,
  reference: '23232323',
  context_id: '45454545',
  trace_id: 'traceIdPlaceholder',
  date: new Date('2000-03-02T22:30:45.979Z').toISOString(),
};
