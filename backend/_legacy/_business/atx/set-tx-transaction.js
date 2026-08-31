import Utils from '../../utils/utils.js';
import Config from '../../../config/config.js';
import getMethod from './get-method.js';

export default async function setTxTransaction(data) {
  const utils = new Utils();
  const config = new Config();
  const ERROR_CODES = config.ERROR_CODES;
  const _ensureEntityByUniqueField = await getMethod({
    className: 'helpers',
    method: '_ensureEntityByUniqueField',
  });
  const _ensureJoin = await getMethod({
    className: 'helpers',
    method: '_ensureJoin',
  });
  const _withTransaction = await getMethod({
    className: 'helpers',
    method: '_withTransaction',
  });
  const _logTxError = await getMethod({
    className: 'helpers',
    method: '_logTxError',
  });

  const { subsystem, className, method } = data || {};
  if (!subsystem || !className || !method)
    return utils.handleError({
      message:
        'Datos inválidos o incompletos (subsystem, className, method requeridos)',
      statusCode: ERROR_CODES.BAD_REQUEST,
    });

  return await _withTransaction(async (client) => {
    // Asegurar entidades base
    const subsystemId = await _ensureEntityByUniqueField(client, 'subsystem', {
      name: subsystem,
      description: subsystem,
    });
    const classId = await _ensureEntityByUniqueField(client, 'class', {
      name: className,
      description: className,
    });
    const methodId = await _ensureEntityByUniqueField(client, 'method', {
      name: method,
      description: method,
    });
    // Asegurar joins
    await _ensureJoin(client, 'class_method', {
      id_class: classId,
      id_method: methodId,
    });
    await _ensureJoin(client, 'subsystem_class', {
      id_subsystem: subsystemId,
      id_class: classId,
    });

    // Revisar si ya existe transaction (tabla transaction con PK serial en columna tx)
    // Debug: log the resolved ids before checking/creating transaction
    try {
      // suppressed tx-resolution debug
    } catch (e) {}
    const checkRes = await client.query(
      'SELECT tx, description FROM public."transaction" WHERE id_subsystem = $1 AND id_class = $2 AND id_method = $3 LIMIT 1;',
      [subsystemId, classId, methodId],
    );
    if (checkRes.rows && checkRes.rows.length > 0) {
      return { message: 'Transacción ya existente', data: checkRes.rows[0] };
    }
    const descValue = data.description || `${subsystem}.${className}.${method}`;
    // Intentar insertar la transacción con ON CONFLICT para evitar excepciones por race
    let inserted;
    try {
      inserted = await client.query(
        'INSERT INTO public."transaction" (description, id_subsystem, id_class, id_method) VALUES ($1, $2, $3, $4) RETURNING tx;',
        [descValue, subsystemId, classId, methodId],
      );
    } catch (e) {
      // If INSERT fails due to concurrency (duplicate key) try to SELECT the existing row
      if (e && (e.code === '23505' || e.code === '42P10')) {
        // Log the initial insert failure with full context so we can trace race conditions
        try {
          _logTxError(
            e,
            'INSERT INTO public."transaction" (description, id_subsystem, id_class, id_method) VALUES ($1, $2, $3, $4) RETURNING tx;',
            [descValue, subsystemId, classId, methodId],
            {
              where: 'setTxTransaction:insert',
              subsystem,
              className,
              method,
            },
          );
        } catch (logErr) {}
        try {
          const chk = await client.query(
            'SELECT tx, description FROM public."transaction" WHERE id_subsystem = $1 AND id_class = $2 AND id_method = $3 LIMIT 1;',
            [subsystemId, classId, methodId],
          );
          if (chk.rows && chk.rows.length > 0)
            return { message: 'Transacción ya existente', data: chk.rows[0] };
        } catch (se) {
          // fallthrough to rethrow original error if select also fails
        }
      }
      // log unexpected insert failure and rethrow
      try {
        _logTxError(
          e,
          'INSERT INTO public."transaction" (description, id_subsystem, id_class, id_method) VALUES ($1, $2, $3, $4) RETURNING tx;',
          [descValue, subsystemId, classId, methodId],
          {
            where: 'setTxTransaction:insert:unexpected',
            subsystem,
            className,
            method,
          },
        );
      } catch (ee) {}
      throw e;
    }
    if (inserted && inserted.rows && inserted.rows.length > 0) {
      return {
        message: 'Transacción creada correctamente',
        data: { tx: inserted.rows[0].tx, description: descValue },
      };
    }
    // Si no se insertó (conflict), recuperar la fila existente
    const checkResAgain = await client.query(
      'SELECT tx, description FROM public."transaction" WHERE id_subsystem = $1 AND id_class = $2 AND id_method = $3 LIMIT 1;',
      [subsystemId, classId, methodId],
    );
    if (checkResAgain.rows && checkResAgain.rows.length > 0) {
      return {
        message: 'Transacción ya existente',
        data: checkResAgain.rows[0],
      };
    }
    // Fallback: devolver error si no se pudo recuperar
    return utils.handleError({
      message: 'No se pudo crear o recuperar la transacción',
      statusCode: ERROR_CODES.DB_ERROR,
    });
  }, 'Error en setTxTransaction');
}
