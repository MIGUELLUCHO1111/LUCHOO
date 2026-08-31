import getMethod from "../atx/get-method.js";

export default async function _resolveTxFromMethodRef(
  methodRef,
  subsystemFallback = null
) {
  const setTxTransactionWithClient = await getMethod({
    className: 'atx',
    method: 'setTxTransactionWithClient',
  });

  if (!methodRef || typeof methodRef !== 'object') return null;
  if (methodRef.tx) return methodRef.tx; // si ya trae tx numérico
  const subsystemName = methodRef.subsystem || methodRef.subsystemName || null;
  const classNameResolved = methodRef.className || methodRef.class || null;
  const methodName = methodRef.method || null;
  const data = {
    subsystem: subsystemName || subsystemFallback,
    className: classNameResolved,
    method: methodName,
    description: methodName,
  };
  if (!data.subsystem || !data.className || !data.method) return null;
  // If a client was supplied in methodRef (internal callers can pass client to avoid nested transactions)
  if (methodRef.__client) {
    const txRes = await setTxTransactionWithClient(methodRef.__client, data);
    return txRes?.data?.tx || null;
  }
  const txRes = await this.setTxTransaction(data);
  return txRes?.data?.tx || null;
}
