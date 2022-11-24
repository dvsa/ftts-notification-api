export const errorBadRequest = {
  response: {
    data: {
      status_code: 400,
      errors: [{
        error: 'Bad request',
        message: 'Can\'t send to this recipient using a team-only API key',
      }],
    },
  },
};

export const errorAuth = {
  response: {
    data: {
      status_code: 403,
      errors: [{
        error: 'AuthError',
        message: 'Invalid token: API key not found',
      }],
    },
  },
};

export const errorRateLimit = {
  response: {
    data: {
      status_code: 429,
      errors: [{
        error: 'RateLimitError',
        message: 'Exceeded rate limit for key type TEAM/TEST/LIVE of 3000 requests per 60 seconds',
      }],
    },
  },
};

export const errorServer = {
  response: {
    data: {
      status_code: 500,
      errors: [{
        error: 'Exception',
        message: 'Internal server error',
      }],
    },
  },
};

export const errorUnknown = {
  response: {
    data: {
      status_code: 999,
      errors: [{
        error: 'Fake error',
        message: 'So fake',
      }],
    },
  },
};
