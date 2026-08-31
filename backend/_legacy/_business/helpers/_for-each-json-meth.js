export default async function _forEachJsonMethod({
  data,
  filter,
  onEach,
  errorMessage = 'Error en método masivo',
}) {
  try {
    const entries = Object.entries(data || {});
    const results = [];
    for (const [key, value] of entries) {
      if (!filter || filter(key, value)) {
        results.push(await onEach({ key, value }));
      }
    }
    return { data: results };
  } catch (error) {
    const Utils = (await import('../../utils/utils.js')).default;
    const Config = (await import('../../../config/config.js')).default;

    const utils = new Utils();
    const config = new Config();
    const ERROR_CODES = config.ERROR_CODES;

    return utils.handleError({
      message: errorMessage,
      statusCode: ERROR_CODES.DB_ERROR,
      error,
    });
  }
}
