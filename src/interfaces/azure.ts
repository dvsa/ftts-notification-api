export interface UserProperties {
  operationId: string;
  parentId: string;
  sendStartDate: Date;
}

export interface CorrelatedBindingData {
  userProperties: UserProperties;
  // Binding data needs to allow generic objects
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}
