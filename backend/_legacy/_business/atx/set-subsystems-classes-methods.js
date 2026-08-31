import Utils from '../../utils/utils.js';
import Config from '../../../config/config.js';
import DBMS from '../../dbms/dbms.js';
import getMethod from './get-method.js';

export default async function setSubsystemsClassesMethods(data) {
  const utils = new Utils();
  const config = new Config();
  const dbms = new DBMS();
  const ERROR_CODES = config.ERROR_CODES;
  const _withTransaction = await getMethod({
    className: 'helpers',
    method: '_withTransaction',
  });
  const _ensureEntityByUniqueField = await getMethod({
    className: 'helpers',
    method: '_ensureEntityByUniqueField',
  });
  const _ensureJoin = await getMethod({
    className: 'helpers',
    method: '_ensureJoin',
  });
  const _logTxError = await getMethod({
    className: 'helpers',
    method: '_logTxError',
  });

  // Supports two shapes:
  // A) { subsystem: { className: [method, ...] } }
  // B) The exported "subsystems" const from db-structure.js
  const isSubsystemsConstShape = (obj) => {
    if (!obj || typeof obj !== 'object') return false;
    return Object.values(obj).some(
      (s) =>
        s &&
        typeof s === 'object' &&
        s.classes &&
        typeof s.classes === 'object',
    );
  };

  if (!data || Object.keys(data).length === 0) {
    return utils.handleError({
      message: 'Datos inválidos o incompletos',
      statusCode: ERROR_CODES.BAD_REQUEST,
    });
  }

  if (isSubsystemsConstShape(data)) {
    return await _withTransaction(async (client) => {
      for (const subsystem of Object.keys(data)) {
        const subsystemId = await _ensureEntityByUniqueField(
          client,
          'subsystem',
          {
            name: subsystem,
            description: data[subsystem]?.description || subsystem,
          },
        );
        const classes = data[subsystem]?.classes || {};
        for (const className of Object.keys(classes)) {
          const classId = await _ensureEntityByUniqueField(client, 'class', {
            name: className,
            description: classes[className]?.description || className,
          });
          const methodsObj = classes[className]?.methods || {};
          for (const method of Object.keys(methodsObj)) {
            const methodId = await _ensureEntityByUniqueField(
              client,
              'method',
              {
                name: method,
                description: methodsObj[method]?.description || method,
              },
            );
            await _ensureJoin(client, 'class_method', {
              id_class: classId,
              id_method: methodId,
            });
            await _ensureJoin(client, 'subsystem_class', {
              id_subsystem: subsystemId,
              id_class: classId,
            });
            // Ensure transaction exists for (subsystem, class, method)
            const txCheckRes = await client.query(
              'SELECT tx FROM public."transaction" WHERE id_subsystem = $1 AND id_class = $2 AND id_method = $3 LIMIT 1;',
              [subsystemId, classId, methodId],
            );
            if (!txCheckRes.rows || txCheckRes.rows.length === 0) {
              const txKey = `${subsystem}.${className}.${method}`;
              const txDesc = methodsObj[method]?.description || txKey;
              try {
                await client.query(
                  'INSERT INTO public."transaction" (description, id_subsystem, id_class, id_method) VALUES ($1, $2, $3, $4) RETURNING tx;',
                  [txDesc, subsystemId, classId, methodId],
                );
              } catch (err) {
                // Log detailed info when duplicate-key occurs or other DB errors
                if (err && err.code === '23505') {
                  _logTxError(
                    err,
                    'INSERT INTO public."transaction" (description, id_subsystem, id_class, id_method) VALUES ($1, $2, $3, $4) RETURNING tx;',
                    [txDesc, subsystemId, classId, methodId],
                    {
                      where: 'setSubsystemsClassesMethods:isSubsystemsConst',
                      subsystem,
                      className,
                      method,
                    },
                  );
                  // duplicate key - another process inserted it concurrently, ignore
                } else {
                  _logTxError(
                    err,
                    'INSERT INTO public."transaction" (description, id_subsystem, id_class, id_method) VALUES ($1, $2, $3, $4) RETURNING tx;',
                    [txDesc, subsystemId, classId, methodId],
                    {
                      where: 'setSubsystemsClassesMethods:isSubsystemsConst',
                      subsystem,
                      className,
                      method,
                    },
                  );
                  throw err;
                }
              }
            }
            // Ensure method_profile according to allowedProfiles
            const allowed = methodsObj[method]?.allowedProfiles || [];
            if (Array.isArray(allowed) && allowed.length > 0) {
              for (const prof of allowed) {
                const profileName =
                  typeof prof === 'string'
                    ? prof
                    : prof && typeof prof === 'object' && prof.name
                      ? prof.name
                      : String(prof);
                if (!profileName) continue;
                const profileId = await _ensureEntityByUniqueField(
                  client,
                  'profile',
                  { name: profileName, description: profileName },
                );
                await _ensureJoin(client, 'method_profile', {
                  id_method: methodId,
                  id_profile: profileId,
                });
              }
            }
          }
        }
      }
      return {
        message:
          'Estructura de subsistemas/clases/métodos (forma constante) procesada correctamente',
      };
    }, 'Error en setSubsystemsClassesMethods');
  }

  const subs = Object.keys(data);
  for (const subsystem of subs) {
    const classesMethods = data[subsystem];
    const missing =
      !subsystem || !classesMethods || typeof classesMethods !== 'object';
    const empty = Object.keys(classesMethods || {}).length === 0;
    if (missing || empty) {
      utils.handleError({
        message: `Datos inválidos o incompletos on ${subsystem}. So skipping`,
        statusCode: ERROR_CODES.BAD_REQUEST,
      });
      continue;
    }

    await _withTransaction(async (client) => {
      const subsystemId = await _ensureEntityByUniqueField(
        client,
        'subsystem',
        { name: subsystem },
      );
      for (const className of Object.keys(classesMethods)) {
        const methods = classesMethods[className];
        const miss2 = !className || !methods;
        const emp2 = Array.isArray(methods)
          ? methods.length === 0
          : Object.keys(methods || {}).length === 0;
        if (miss2 || emp2) {
          utils.handleError({
            message: `Datos inválidos o incompletos on ${className}. So skipping`,
            statusCode: ERROR_CODES.BAD_REQUEST,
          });
          continue;
        }
        const list = Array.isArray(methods) ? methods : Object.keys(methods);
        const classId = await _ensureEntityByUniqueField(client, 'class', {
          name: className,
        });
        for (const method of list) {
          const methodId = await _ensureEntityByUniqueField(client, 'method', {
            name: method,
          });
          await _ensureJoin(client, 'class_method', {
            id_class: classId,
            id_method: methodId,
          });
          await _ensureJoin(client, 'subsystem_class', {
            id_subsystem: subsystemId,
            id_class: classId,
          });
          // Ensure transaction exists for (subsystem, class, method)
          const txCheckRes = await client.query(
            'SELECT tx FROM public."transaction" WHERE id_subsystem = $1 AND id_class = $2 AND id_method = $3 LIMIT 1;',
            [subsystemId, classId, methodId],
          );
          if (!txCheckRes.rows || txCheckRes.rows.length === 0) {
            const txKey = `${subsystem}.${className}.${method}`;
            try {
              await client.query(
                'INSERT INTO public."transaction" (description, id_subsystem, id_class, id_method) VALUES ($1, $2, $3, $4) RETURNING tx;',
                [txKey, subsystemId, classId, methodId],
              );
            } catch (err) {
              if (err && err.code === '23505') {
                _logTxError(
                  err,
                  'INSERT INTO public."transaction" (description, id_subsystem, id_class, id_method) VALUES ($1, $2, $3, $4) RETURNING tx;',
                  [txKey, subsystemId, classId, methodId],
                  {
                    where: 'setSubsystemsClassesMethods:compact',
                    subsystem,
                    className,
                    method,
                  },
                );
                // duplicate key - another process inserted it concurrently, ignore
              } else {
                _logTxError(
                  err,
                  'INSERT INTO public."transaction" (description, id_subsystem, id_class, id_method) VALUES ($1, $2, $3, $4) RETURNING tx;',
                  [txKey, subsystemId, classId, methodId],
                  {
                    where: 'setSubsystemsClassesMethods:compact',
                    subsystem,
                    className,
                    method,
                  },
                );
                throw err;
              }
            }
          }
        }
      }
      return {
        message: `Clases/métodos del subsistema '${subsystem}' procesados correctamente`,
      };
    }, 'Error en setSubsystemsClassesMethods');
  }
  return { message: 'Todos los subsistemas procesados correctamente' };
}
