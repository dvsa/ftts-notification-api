import fakerGB from 'faker/locale/en_GB';

import { MessageType, Target, Status } from '../../src/lib/enums';
import { QueueRecord } from '../../src/interfaces/queue';

const QUEUE_SIZE = 50;

export function buildRequestQueueRecord(): QueueRecord {
  const messageType = fakerGB.random.arrayElement([MessageType.EMAIL, MessageType.LETTER]);

  if (messageType === MessageType.LETTER) {
    return buildLetterQueueRecord();
  }

  return buildEmailQueueRecord();
}

export function buildStatusQueueRecord(): QueueRecord {
  const record = buildRequestQueueRecord();
  const id = fakerGB.random.uuid();
  const dateObj = new Date();
  const date = dateObj.toISOString();
  const status = fakerGB.random.arrayElement([
    Status.CREATED,
    Status.DELIVERED,
    Status.PERMANENT_FAILURE,
    Status.SENDING,
    Status.TECHNICAL_FAILURE,
    Status.TEMPORARY_FAILURE,
  ]);

  return {
    ...record,
    id,
    date,
    status,
  };
}

export function buildLetterQueueRecord(): QueueRecord {
  const addressLine1 = fakerGB.address.streetAddress();
  const addressLine2 = fakerGB.address.secondaryAddress();
  const postcode = fakerGB.address.zipCode();
  const contextId = fakerGB.random.uuid();
  const date = fakerGB.date.recent().toISOString();
  const messageContent = fakerGB.lorem.paragraphs();
  const messageType = MessageType.LETTER;
  const name = fakerGB.name.findName();
  const reference = fakerGB.random.uuid();
  const target = fakerGB.random.arrayElement([Target.GB, Target.NI]);
  const noOfRetries = 0;
  const traceId = fakerGB.random.uuid();
  const noOfRequestRetries = 0;

  const letter = {
    name,
    address_line_1: addressLine1,
    address_line_2: addressLine2,
    postcode,
  };

  return {
    message_content: messageContent,
    message_type: messageType,
    target,
    no_of_retries: noOfRetries,
    no_of_request_retries: noOfRequestRetries,
    reference,
    context_id: contextId,
    letter,
    trace_id: traceId,
    date,
  };
}

export function buildEmailQueueRecord(): QueueRecord {
  const emailAddress = fakerGB.internet.email();
  const contextId = fakerGB.random.uuid();
  const traceId = fakerGB.random.uuid();
  const date = fakerGB.date.recent().toISOString();
  const messageContent = fakerGB.lorem.paragraphs();
  const messageSubject = fakerGB.company.catchPhrase();
  const messageType = MessageType.EMAIL;
  const reference = fakerGB.random.uuid();
  const target = fakerGB.random.arrayElement([Target.GB, Target.NI]);
  const noOfRetries = 0;
  const noOfRequestRetries = 0;

  const email = { message_subject: messageSubject, email_address: emailAddress };

  return {
    message_content: messageContent,
    message_type: messageType,
    target,
    email,
    no_of_retries: noOfRetries,
    no_of_request_retries: noOfRequestRetries,
    reference,
    context_id: contextId,
    trace_id: traceId,
    date,
  };
}

export const requestQueueRecords = [...Array.from(Array(QUEUE_SIZE).keys()).map((num: number) => `${num}`).map(() => buildRequestQueueRecord())];
export const statusQueueRecords = [...Array.from(Array(QUEUE_SIZE).keys()).map((num: number) => `${num}`).map(() => buildStatusQueueRecord())];

export const queueRecords = [...requestQueueRecords, ...statusQueueRecords];
