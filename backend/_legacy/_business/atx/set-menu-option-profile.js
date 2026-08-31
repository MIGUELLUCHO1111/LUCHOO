import getMethod from './get-method.js';

export default async function setMenuOptionProfile(data) {
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

  // Two shapes supported:
  // 1) { menu, option, profile }
  // 2) Exported menus const shape from db-structure.js
  if (_isMenusStructureShape(data)) {
    return await _withTransaction(async (client) => {
      for (const subsystem of Object.keys(data)) {
        const subsystemNode = data[subsystem];
        const menusLevel1 = Object.keys(subsystemNode || {});
        for (const menuName of menusLevel1) {
          const menuNode = subsystemNode[menuName];
          const menu1Id = await _ensureEntityByUniqueField(client, 'menu', {
            name: menuName,
            description: menuNode?.description || menuName,
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
                  ...(parentId ? { id_parent: parentId } : {}),
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
      return { message: 'Menús/Opciones/Perfiles procesados correctamente' };
    }, 'Error en setMenuOptionProfile (forma constante)');
  }

  const { menu, option, profile } = data || {};
  if (!menu || !option || !profile) {
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
    // Si se proporciona subsystem, asegurar id_subsystem para el menú si no existe
    let menuFields = { name: menu };
    if (data.subsystem) {
      const subsystemId = await _ensureEntityByUniqueField(
        client,
        'subsystem',
        {
          name: data.subsystem,
          description: data.subsystem,
        },
      );
      menuFields = { ...menuFields, id_subsystem: subsystemId };
    }
    const menuId = await _ensureEntityByUniqueField(client, 'menu', menuFields);
    // Resolver tx si se proporciona directamente o mediante trio subsystem/class/method
    let txValue = data.tx;
    if (!txValue && (data.subsystem || data.className || data.method)) {
      txValue = await _resolveTxFromMethodRef(
        Object.assign(
          {},
          {
            subsystem: data.subsystem,
            className: data.className,
            method: data.method,
            __client: client,
          },
        ),
        data.subsystem,
      );
    }
    const optionId = await _ensureOptionWithTx(client, {
      name: option,
      description: option,
      tx: txValue,
    });
    await _ensureJoin(client, 'option_menu', {
      id_menu: menuId,
      id_option: optionId,
    });
    const profileId = await _ensureEntityByUniqueField(client, 'profile', {
      name: profile,
    });
    await _ensureJoin(client, 'option_profile', {
      id_option: optionId,
      id_profile: profileId,
    });
    return {
      data: [{ id_menu: menuId, id_option: optionId, id_profile: profileId }],
    };
  }, 'Error en setMenuOptionProfile');
}
