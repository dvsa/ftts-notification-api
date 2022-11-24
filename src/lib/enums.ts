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
  PERMANENT_FAILURE = 'PERMANENT_FAILURE',
}

export enum MessageType {
  EMAIL = 'email',
  LETTER = 'letter',
  NOTIFICATION = 'notification',
}

export enum Target {
  GB = 'gb',
  NI = 'ni',
}

export enum Channel {
  LETTER = 'letter',
  EMAIL = 'email',
}

export enum Agency {
  DVSA = 'DVSA',
  DVA = 'DVA',
}

export enum Language {
  EN = 'en',
  CY = 'cy',
}

export enum BookingCategory {
  STANDARD_BOOKING_CONFIRMATION =  'standard-booking-confirmation',
  STANDARD_BOOKING_CANCELLATION = 'standard-booking-cancellation',
  STANDARD_BOOKING_RESCHEDULED = 'standard-booking-rescheduled',
  STANDARD_REFUND_REQUEST = 'standard-refund-request',
  STANDARD_EVIDENCE_REQUIRED = 'standard-evidence-required',
  STANDARD_EVIDENCE_NOT_REQUIRED = 'standard-evidence-not-required',
  STANDARD_EVIDENCE_MAY_BE_REQUIRED = 'standard-evidence-may-be-required',
  STANDARD_RETURNING_CANDIDATE = 'standard-returning-candidate',
  STANDARD_CANDIDATE_BOOKING_CANCELLATION = 'standard-candidate-booking-cancellation',
  STANDARD_TRAINER_BOOKER_BOOKING_CANCELLATION = 'standard-trainer-booker-booking-cancellation',
}
