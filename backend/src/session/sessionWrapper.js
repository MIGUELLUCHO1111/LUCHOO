import Config from '../../config/config.js';

export default class SessionWrapper {
  constructor() {
    if (SessionWrapper.instance) {
      return SessionWrapper.instance;
    }
    this.config = new Config();
    SessionWrapper.instance = this;
  }

  setSession(req, data = {}) {
    let userData = data || {};
    if (!req?.session?.data) {
      req.session.data = {};
    }
    req.session.data = { ...req.session.data, ...userData };
    return req.session.data;
  }

  sessionExists(req) {
    return Boolean(
      req?.session?.data && Object.keys(req.session.data).length > 0,
    );
  }

  async destroySession(req) {
    if (!this.sessionExists(req))
      return {
        statusCode: this.config.STATUS_CODES.UNAUTHORIZED,
        message: this.config.getMessage(req?.body?.lang, 'session_required'),
      };

    return new Promise((resolve) => {
      req.session.destroy((err) => {
        if (err) {
          return resolve({
            statusCode: this.config.STATUS_CODES.INTERNAL_SERVER_ERROR,
            message: this.config.getMessage(req?.body?.lang, 'server_error'),
          });
        }
        return resolve({
          statusCode: this.config.STATUS_CODES.OK,
          message: this.config.getMessage(
            req?.body?.lang,
            'session_closed_success',
          ),
        });
      });
    });
  }

  getSession(req) {
    return req?.session?.data || null;
  }

  authenticate(req) {
    return Boolean(req?.session?.data?.user);
  }

  getUserId(req) {
    return (
      req?.session?.data?.user?.id ||
      req?.session?.data?.user?.username ||
      req?.session?.data?.user?.user_id
    );
  }
}
