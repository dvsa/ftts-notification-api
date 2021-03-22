// So we can import json files
declare module '*.json' {
  // Generic JSON importer we don't know what we are importing here so can't type it
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value: any;
  export default value;
}
