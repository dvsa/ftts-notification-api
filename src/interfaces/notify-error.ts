interface NotifyErrorDetail {
  error: string;
  message: string;
}

export interface NotifyError {
  error: {
    status_code: number;
    errors: NotifyErrorDetail[];
  };
}
