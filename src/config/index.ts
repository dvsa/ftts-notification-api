export default {
  /**
  * GOV Notify
  */
  notify: {
    gb: {
      apiKey: process.env.GOV_NOTIFY_GB_KEY || '',
      emailTemplate: process.env.GOV_NOTIFY_GB_EMAIL_TEMPLATE || '',
      letterTemplate: process.env.GOV_NOTIFY_GB_LETTER_TEMPLATE || '',
    },
    ni: {
      apiKey: process.env.GOV_NOTIFY_NI_KEY || '',
      emailTemplate: process.env.GOV_NOTIFY_NI_EMAIL_TEMPLATE || '',
      letterTemplate: process.env.GOV_NOTIFY_NI_LETTER_TEMPLATE || '',
    },
  },

  /**
  * Azure
  */
  serviceBus: {
    apiConnectionString: process.env.SERVICE_BUS_CONNECTION_STRING_NTFAPI || '',
    crmConnectionString: process.env.SERVICE_BUS_CONNECTION_STRING_CRM || '',
  },

  /**
  * Queues
  */
  queues: {
    notificationStatus: {
      name: process.env.QUEUE_NOTIFICATION_STATUS_NAME || '',
    },
    notificationRequest: {
      name: process.env.QUEUE_NOTIFICATION_REQUEST_NAME || '',
    },
    crmResult: {
      name: process.env.QUEUE_CRM_RESULT_NAME || '',
    },
    stubCrmResult: {
      name: process.env.QUEUE_CRM_STUB_RESULT_NAME || '',
    },
  },
  /**
   * Error handling parameters
   */
  error: {
    request: {
      retryCount: Number(process.env.MAX_NO_OF_REQUEST_RETRIES),
      retryDelay: Number(process.env.REQUEST_RETRY_DELAY),
    },
    status: {
      retryCount: Number(process.env.MAX_NO_OF_STATUS_RETRIES),
      retryDelay: Number(process.env.STATUS_RETRY_DELAY),
      messageLimit: Number(process.env.STATUS_QUEUE_MESSAGES_LIMIT),
      maxWaitTimeInSeconds: Number(process.env.MAX_WAIT_TIME_IN_SECONDS),
    },
  },
};
