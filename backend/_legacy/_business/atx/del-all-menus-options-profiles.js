import getMethod from "./get-method.js";

export default async function delAllMenusOptionsProfiles() {
  const _withTransaction = await getMethod({
    className: 'helpers',
    method: '_withTransaction',
  });

  return await _withTransaction(async (client) => {
    await client.query('DELETE FROM public."option_menu";');
    await client.query('DELETE FROM public."option_profile";');
    await client.query('DELETE FROM public."menu";');
    await client.query('DELETE FROM public."option";');
    return {
      message: 'Todos los menús/opciones/perfiles eliminados correctamente',
    };
  }, 'Error en delAllMenusOptionsProfiles');
}
