import getMethod from './get-method.js';

export default async function setClassMethod(data) {
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

  const { className, method } = data;
  if (!className || !method) {
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
    return { data: [{ id_class: classId, id_method: methodId }] };
  }, 'Error en setClassMethod');
}
