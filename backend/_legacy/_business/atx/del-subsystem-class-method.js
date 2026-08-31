import DBMS from '../../dbms/dbms.js';
import getMethod from './get-method.js';

export default async function delSubsystemClassMethod(data) {
  const _withTransaction = await getMethod({
    className: 'helpers',
    method: '_withTransaction',
  });
  const _requireConfirmJoin = await getMethod({
    className: 'helpers',
    method: '_requireConfirmJoin',
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
  const conf1 = await _requireConfirmJoin(data.confirmDelete, 'class_method');
  if (conf1 !== true) return conf1;
  const conf2 = await _requireConfirmJoin(
    data.confirmDelete2,
    'subsystem_class',
  );
  if (conf2 !== true) return conf2;
  return await _withTransaction(async (client) => {
    await client.query(
      'DELETE FROM public."class_method" WHERE id_class = (SELECT id FROM public."class" WHERE name = $1) AND id_method = (SELECT id FROM public."method" WHERE name = $2);',
      [className, method],
    );
    await client.query(
      'DELETE FROM public."subsystem_class" WHERE id_subsystem = (SELECT id FROM public."subsystem" WHERE name = $1) AND id_class = (SELECT id FROM public."class" WHERE name = $2);',
      [subsystem, className],
    );
    return { message: 'Menús/opciones/perfiles asignados correctamente' };
  }, 'Error en delSubsystemClassMethod');
}
