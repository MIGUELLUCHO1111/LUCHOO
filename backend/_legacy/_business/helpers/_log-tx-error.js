// Helper to log transaction-related query errors with stack and context
export default function _logTxError(err, query, params, context = {}) {
  try {
    const info = {
      where: context.where || null,
      subsystem: context.subsystem || null,
      className: context.className || null,
      method: context.method || null,
      ids: context.ids || null,
      code: err && err.code,
      detail: err && err.detail,
      message: err && err.message,
      query: typeof query === 'string' ? query : String(query),
      params: Array.isArray(params) ? params : params,
      stack: new Error().stack,
    };
    // suppressed debug output in normal runs
  } catch (e) {
    // swallow logging errors
    try {
      // suppressed debug fallback
    } catch (ee) {}
  }
}
