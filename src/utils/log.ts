import { Identifiers } from '../interfaces/api';

export function logIdentifiers(message: Partial<Identifiers>): string {
  return JSON.stringify(getIdentifiers(message));
}

export function getIdentifiers(message: Partial<Identifiers>): Identifiers {
  return {
    context_id: message?.context_id,
    reference: message?.reference,
    trace_id: message?.trace_id,
  };
}
