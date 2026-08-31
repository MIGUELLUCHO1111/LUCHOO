import getMethod from "../atx/get-method.js";

export default async function _forEachJsonMethodTx({
  data,
  filter,
  onEach,
  errorMessage = 'Error en método masivo tx',
}) {
  const _withTransaction = await getMethod({
    className: 'helpers',
    method: '_withTransaction',
  });

  return await _withTransaction(async (client) => {
    const entries = Object.entries(data || {});
    const results = [];
    for (const [key, value] of entries) {
      if (!filter || filter(key, value)) {
        results.push(await onEach({ key, value }, client));
      }
    }
    return { data: results };
  }, errorMessage);
}
