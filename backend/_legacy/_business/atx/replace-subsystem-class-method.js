import getMethod from './get-method.js';

export default async function replaceSubsystemClassMethod(data) {
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

  const { subsystem, className, method } = data;
  if (!subsystem || !className || !method) {
    const Utils = (await import('../../utils/utils.js')).default;
    const Config = (await import('../../../config/config.js')).default;
    const utils = new Utils();
    const config = new Config();
    const ERROR_CODES = config.ERROR_CODES;

    return utils.handleError({
      message: 'Datos inválidos o incompletos',
      statusCode: ERROR_CODES.BAD_REQUEST,
    });
  }
  return await _withTransaction(async (client) => {
    await client.query(
      'DELETE FROM public."class_method" WHERE id_class = (SELECT id FROM public."class" WHERE name = $1) AND id_method = (SELECT id FROM public."method" WHERE name = $2);',
      [className, method],
    );
    await client.query(
      'DELETE FROM public."subsystem_class" WHERE id_subsystem = (SELECT id FROM public."subsystem" WHERE name = $1) AND id_class = (SELECT id FROM public."class" WHERE name = $2);',
      [subsystem, className],
    );
    const subsystemId = await _ensureEntityByUniqueField(client, 'subsystem', {
      name: subsystem,
    });
    const classId = await _ensureEntityByUniqueField(client, 'class', {
      name: className,
    });
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
    return { message: 'Subsistema/clase/método reemplazados correctamente' };
  }, 'Error en replaceSubsystemClassMethod');
}
