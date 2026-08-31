import getMethod from './get-method.js';

export default async function setMenusOptionsProfiles(data) {
  const _ensureEntityByUniqueField = await getMethod({
    className: 'helpers',
    method: '_ensureEntityByUniqueField',
  });
  const _ensureJoin = await getMethod({
    className: 'helpers',
    method: '_ensureJoin',
  });
  const _ensureOptionWithTx = await getMethod({
    className: 'helpers',
    method: '_ensureOptionWithTx',
  });
  const _resolveTxFromMethodRef = await getMethod({
    className: 'helpers',
    method: '_resolveTxFromMethodRef',
  });
  const _isMenusStructureShape = await getMethod({
    className: 'helpers',
    method: '_isMenusStructureShape',
  });
  const _withTransaction = await getMethod({
    className: 'helpers',
    method: '_withTransaction',
  });

  if (!data || typeof data !== 'object') {
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
    if (_isMenusStructureShape(data)) {
      for (const subsystem of Object.keys(data)) {
        const subsystemId = await _ensureEntityByUniqueField(
          client,
          'subsystem',
          { name: subsystem, description: subsystem },
        );

        const menusLevel1 = Object.keys(data[subsystem] || {});
        for (const menuName of menusLevel1) {
          const menuNode = data[subsystem][menuName];
          const menu1Id = await _ensureEntityByUniqueField(client, 'menu', {
            name: menuName,
            description: menuNode?.description || menuName,
            id_subsystem: subsystemId,
          });

          const traverse = async (parentId, currentMenuName, node) => {
            const submenus = Object.keys(node?.submenus || {});
            for (const submenuName of submenus) {
              const submenuNode = node.submenus[submenuName];
              const submenuId = await _ensureEntityByUniqueField(
                client,
                'menu',
                {
                  name: submenuName,
                  description: submenuNode?.description || submenuName,
                  id_subsystem: subsystemId,
                  id_parent: parentId,
                },
              );

              const options = Object.keys(submenuNode?.options || {});
              for (const optionName of options) {
                const optionNode = submenuNode.options[optionName];
                let txValue = optionNode?.tx;
                if (!txValue && optionNode?.method) {
                  txValue = await _resolveTxFromMethodRef(
                    Object.assign({}, optionNode.method || {}, {
                      __client: client,
                    }),
                    subsystem,
                  );
                }
                const optionId = await _ensureOptionWithTx(client, {
                  name: optionName,
                  description: optionNode?.description || optionName,
                  tx: txValue,
                });
                await _ensureJoin(client, 'option_menu', {
                  id_menu: submenuId,
                  id_option: optionId,
                });
                const allowed = optionNode?.allowedProfiles || [];
                for (const prof of allowed) {
                  const profileId = await _ensureEntityByUniqueField(
                    client,
                    'profile',
                    { name: prof },
                  );
                  await _ensureJoin(client, 'option_profile', {
                    id_option: optionId,
                    id_profile: profileId,
                  });
                }
              }

              await traverse(submenuId, submenuName, submenuNode);
            }

            const optionsHere = Object.keys(node?.options || {});
            for (const optionName of optionsHere) {
              const optionNode = node.options[optionName];
              let txValue = optionNode?.tx;
              if (!txValue && optionNode?.method) {
                txValue = await _resolveTxFromMethodRef(
                  Object.assign({}, optionNode.method || {}, {
                    __client: client,
                  }),
                  subsystem,
                );
              }
              const optionId = await _ensureOptionWithTx(client, {
                name: optionName,
                description: optionNode?.description || optionName,
                tx: txValue,
              });
              await _ensureJoin(client, 'option_menu', {
                id_menu: parentId || menu1Id,
                id_option: optionId,
              });
              const allowed = optionNode?.allowedProfiles || [];
              for (const prof of allowed) {
                const profileId = await _ensureEntityByUniqueField(
                  client,
                  'profile',
                  { name: prof },
                );
                await _ensureJoin(client, 'option_profile', {
                  id_option: optionId,
                  id_profile: profileId,
                });
              }
            }
          };

          await traverse(menu1Id, menuName, menuNode);
        }
      }
      return { message: 'Estructura de menús procesada correctamente' };
    }

    // Default shape (per profile): { profile: { menu: [options] } }
    const profiles = Object.keys(data);
    for (const profile of profiles) {
      const profileData = data[profile];
      if (!profile || !profileData || typeof profileData !== 'object') continue;
      const menus = Object.keys(profileData);
      for (const menu of menus) {
        const arrOptions = profileData[menu];
        if (!menu || !Array.isArray(arrOptions)) continue;
        const menuId = await _ensureEntityByUniqueField(client, 'menu', {
          name: menu,
        });
        for (const option of arrOptions) {
          let optionName = option;
          let txValue = null;
          if (typeof option === 'string' && option.includes('|')) {
            const parts = option.split('|');
            optionName = parts[0];
            const txParsed = parseInt(parts[1], 10);
            if (!isNaN(txParsed)) txValue = txParsed;
          }
          const optionId = await _ensureOptionWithTx(client, {
            name: optionName,
            description: optionName,
            tx: txValue,
          });
          await _ensureJoin(client, 'option_menu', {
            id_menu: menuId,
            id_option: optionId,
          });
          const profileId = await _ensureEntityByUniqueField(
            client,
            'profile',
            { name: profile },
          );
          await _ensureJoin(client, 'option_profile', {
            id_option: optionId,
            id_profile: profileId,
          });
        }
      }
    }
    return { message: 'Menús/opciones/perfiles asignados correctamente' };
  }, 'Error en setMenusOptionsProfiles');
}
