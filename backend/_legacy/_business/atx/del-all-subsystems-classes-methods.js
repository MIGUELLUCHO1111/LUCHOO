import getMethod from "./get-method.js";

export default async function delAllSubsystemsClassesMethods() {
  const _withTransaction = await getMethod({
    className: 'helpers',
    method: '_withTransaction',
  });

  return await _withTransaction(async (client) => {
    await client.query('DELETE FROM public."class_method";');
    await client.query('DELETE FROM public."subsystem_class";');
    await client.query('DELETE FROM public."method_profile";');
    await client.query('DELETE FROM public."transaction";');
    await client.query('DELETE FROM public."method";');
    await client.query('DELETE FROM public."class";');
    await client.query('DELETE FROM public."subsystem";');
    return {
      message: 'Todos los subsistemas/clases/métodos eliminados correctamente',
    };
  }, 'Error en delAllSubsystemsClassesMethods');
}
