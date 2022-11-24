interface NotifyErrorDetail {
  error: string;
  message: string;
}

export interface NotifyError {
  response: {
    data: {
      status_code: number;
      errors: NotifyErrorDetail[];
    },
  };
}
