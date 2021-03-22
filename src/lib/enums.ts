export enum Status {
  ACCEPTED = 'accepted',
  CREATED = 'created',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  TECHNICAL_FAILURE = 'technical-failure',
  TEMPORARY_FAILURE = 'temporary-failure',
  PERMANENT_FAILURE = 'permanent-failure',
  RECEIVED = 'received',
  SENDING = 'sending',
}

export enum CRMStatus {
  ACCEPTED = 'ACCEPTED',
  DELIVERED = 'DELIVERED',
  NOTIFY_FAILURE = 'NOTIFY_FAILURE',
  DELIVERY_FAILURE = 'DELIVERY_FAILURE',
  PERMANENT_FAILURE = 'PERMANENT_FAILURE'
}

export enum MessageType {
  EMAIL = 'email',
  LETTER = 'letter',
}

export enum Target {
  GB = 'gb',
  NI = 'ni',
}
