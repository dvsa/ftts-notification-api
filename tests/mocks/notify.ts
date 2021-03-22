export const errorBadRequest = {
  error: {
    status_code: 400,
    errors: [{
      error: 'Bad request',
      message: 'Can\'t send to this recipient using a team-only API key',
    }],
  },
};

export const errorAuth = {
  error: {
    status_code: 403,
    errors: [{
      error: 'AuthError',
      message: 'Invalid token: API key not found',
    }],
  },
};

export const errorRateLimit = {
  error: {
    status_code: 429,
    errors: [{
      error: 'RateLimitError',
      message: 'Exceeded rate limit for key type TEAM/TEST/LIVE of 3000 requests per 60 seconds',
    }],
  },
};

export const errorServer = {
  error: {
    status_code: 500,
    errors: [{
      error: 'Exception',
      message: 'Internal server error',
    }],
  },
};

export const errorUnknown = {
  error: {
    status_code: 999,
    errors: [{
      error: 'Fake error',
      message: 'So fake',
    }],
  },
};
