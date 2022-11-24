/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import Ajv from 'ajv';
import { SchemaValidationError } from './schemaValidationError';

export function validateAgainstSchema(validationSchema: any, validatedObject: any): void {
  const ajv = createAjv();
  // Validation schema needs to be loaded in
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const validationResult = ajv.validate(validationSchema, validatedObject);
  if (!validationResult) {
    const message = ajv.errorsText(ajv.errors);
    throw new SchemaValidationError(message);
  }
}

export function createAjv(): Ajv.Ajv {
  const ajv = new Ajv();

  ajv.addKeyword('notEmpty', {
    type: 'string',
    // Any used to match validators type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validate(schema: any, data: any) {
      const isValid = typeof data === 'string' && data.trim() !== '';
      return isValid;
    },
  });

  return ajv;
}
