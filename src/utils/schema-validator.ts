import Ajv from 'ajv';

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
