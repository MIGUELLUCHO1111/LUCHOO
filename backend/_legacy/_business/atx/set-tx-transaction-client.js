import Utils from '../../utils/utils.js';
import Config from '../../../config/config.js';
import getMethod from './get-method.js';

// Internal variant of setTxTransaction that uses an existing client (no new transaction)
export default async function setTxTransactionWithClient(client, data) {
  const utils = new Utils();
  const config = new Config();
  const ERROR_CODES = config.ERROR_CODES;

  if (!client || !data || typeof data !== 'object')
    return utils.handleError({
      message: 'Datos inválidos para setTxTransactionWithClient',
      statusCode: ERROR_CODES.BAD_REQUEST,
    });
  const { subsystem, className, method } = data;
  if (!subsystem || !className || !method)
    return utils.handleError({
      message: 'Faltan campos subsystem/className/method',
      statusCode: ERROR_CODES.BAD_REQUEST,
    });
  // Resolve ids
  const sRes = await client.query(
    'SELECT id FROM public."subsystem" WHERE name = $1 LIMIT 1;',
    [subsystem],
  );
  const cRes = await client.query(
    'SELECT id FROM public."class" WHERE name = $1 LIMIT 1;',
    [className],
  );
  const mRes = await client.query(
    'SELECT id FROM public."method" WHERE name = $1 LIMIT 1;',
    [method],
  );
  if (!sRes.rows.length || !cRes.rows.length || !mRes.rows.length)
    return utils.handleError({
      message: 'No se encontraron subsystem/class/method',
      statusCode: ERROR_CODES.NOT_FOUND,
    });
  const subsystemId = sRes.rows[0].id;
  const classId = cRes.rows[0].id;
  const methodId = mRes.rows[0].id;
  // Check existing
  const checkRes = await client.query(
    'SELECT tx, description FROM public."transaction" WHERE id_subsystem = $1 AND id_class = $2 AND id_method = $3 LIMIT 1;',
    [subsystemId, classId, methodId],
  );
  if (checkRes.rows && checkRes.rows.length > 0)
    return { message: 'Transacción ya existente', data: checkRes.rows[0] };
  const descValue = data.description || `${subsystem}.${className}.${method}`;
  try {
    const inserted = await client.query(
      'INSERT INTO public."transaction" (description, id_subsystem, id_class, id_method) VALUES ($1, $2, $3, $4) RETURNING tx;',
      [descValue, subsystemId, classId, methodId],
    );
    if (inserted && inserted.rows && inserted.rows.length > 0) {
      return {
        message: 'Transacción creada correctamente',
        data: { tx: inserted.rows[0].tx, description: descValue },
      };
    }
  } catch (e) {
    // Log error context and try select fallback
    try {
      const _logTxError = await getMethod({
        className: 'helpers',
        method: '_logTxError',
      });
      _logTxError(
        e,
        'INSERT INTO public."transaction" (description, id_subsystem, id_class, id_method) VALUES ($1, $2, $3, $4) RETURNING tx;',
        [descValue, subsystemId, classId, methodId],
        {
          where: 'setTxTransactionWithClient:insert',
          subsystem,
          className,
          method,
        },
      );
    } catch (le) {}
    if (e && (e.code === '23505' || e.code === '42P10')) {
      try {
        const chk = await client.query(
          'SELECT tx, description FROM public."transaction" WHERE id_subsystem = $1 AND id_class = $2 AND id_method = $3 LIMIT 1;',
          [subsystemId, classId, methodId],
        );
        if (chk.rows && chk.rows.length > 0)
          return { message: 'Transacción ya existente', data: chk.rows[0] };
      } catch (se) {
        // fallthrough
      }
    }
    throw e;
  }
  // Fallback select
  const checkResAgain = await client.query(
    'SELECT tx, description FROM public."transaction" WHERE id_subsystem = $1 AND id_class = $2 AND id_method = $3 LIMIT 1;',
    [subsystemId, classId, methodId],
  );
  if (checkResAgain.rows && checkResAgain.rows.length > 0)
    return {
      message: 'Transacción ya existente',
      data: checkResAgain.rows[0],
    };
  return utils.handleError({
    message: 'No se pudo crear o recuperar la transacción (client)',
    statusCode: ERROR_CODES.DB_ERROR,
  });
}
