import DBMS from '../../dbms/dbms.js';
import Utils from '../../utils/utils.js';
import Config from '../../../config/config.js';

export default async function parseMOP({ profile }) {
  const dbms = new DBMS();
  try {
    const result = await dbms.executeNamedQuery({
      nameQuery:
        profile === '' ? 'getMenusOptionsProfiles' : 'getMenusOptionsProfile',
      params: {
        profile_name: profile,
      },
    });

    // Build map of rows and menu info
    const menus = {}; // { subsystemName: { menuName: node } }
    const rowsData = Array.isArray(result && result.rows) ? result.rows : [];

    // map of menu id -> node (object reference in `menus` tree) to allow attaching children
    const idToNode = {};

    // Preload menu metadata (including id_subsystem and subsystem name)
    const menuIds = [
      ...new Set(rowsData.map((r) => r.menu_id).filter(Boolean)),
    ];
    const menuInfo = {};
    if (menuIds.length > 0) {
      try {
        const q = `SELECT m.id, m.name, m.id_parent, m.description, m.id_subsystem, s.name AS subsystem_name FROM public."menu" m LEFT JOIN public."subsystem" s ON m.id_subsystem = s.id WHERE m.id = ANY($1::int[]);`;
        const resMenus = await dbms.query({ query: q, params: [menuIds] });
        for (const m of resMenus.rows || []) menuInfo[m.id] = m;
      } catch (e) {
        // ignore, fallback to per-row queries
      }
    }
    // Preload transaction -> method/class/subsystem mapping from DB using option.tx
    const txIds = [...new Set(rowsData.map((r) => r.tx).filter(Boolean))];
    const txInfo = {};
    if (txIds.length > 0) {
      try {
        const q2 = `SELECT t.tx, m.name AS method_name, c.name AS class_name, s.name AS subsystem_name
          FROM public."transaction" t
          JOIN public."method" m ON t.id_method = m.id
          JOIN public."class" c ON t.id_class = c.id
          JOIN public."subsystem" s ON t.id_subsystem = s.id
          WHERE t.tx = ANY($1::int[]);`;
        const resTx = await dbms.query({ query: q2, params: [txIds] });
        for (const t of resTx.rows || []) {
          txInfo[t.tx] = t;
        }
      } catch (e) {
        // ignore if transaction details can't be loaded
      }
    }

    // Separate top-level and children rows
    const children = [];
    for (const r of rowsData) {
      const mInfo = menuInfo[r.menu_id] || null;
      const subsystemName = mInfo
        ? mInfo.subsystem_name || 'unknown'
        : 'unknown';
      if (!menus[subsystemName]) menus[subsystemName] = {};

      if (r.id_parent === null) {
        const key = r.menu_name;
        if (!menus[subsystemName][key]) {
          menus[subsystemName][key] = {
            description: mInfo?.description || r.menu_name || '',
            id: r.menu_id,
          };
        }
        idToNode[r.menu_id] = menus[subsystemName][key];

        if (r.option_name) {
          if (!menus[subsystemName][key].options)
            menus[subsystemName][key].options = {};
          const finalDesc = r.description || '';
          const tx = r.tx || null;
          menus[subsystemName][key].options[r.option_name] = {
            description: finalDesc,
            id: r.option_id,
            tx,
          };
        }
      } else {
        children.push(r);
      }
    }

    // iterative attachment of children
    let progress = true;
    let pending = children;
    while (pending.length > 0 && progress) {
      progress = false;
      const remaining = [];
      for (const c of pending) {
        let parentNode = idToNode[c.id_parent];
        if (!parentNode) {
          try {
            const res = await dbms.query({
              query:
                'SELECT id, name, id_parent, description, id_subsystem FROM public."menu" WHERE id = $1 LIMIT 1;',
              params: [c.id_parent],
            });
            const prow = res?.rows?.[0];
            if (prow) {
              const pnode = {
                description: prow.description || prow.name || '',
                id: prow.id,
              };
              // determine subsystem
              let subsystemName = 'unknown';
              if (prow.id_subsystem) {
                try {
                  const sres = await dbms.query({
                    query:
                      'SELECT name FROM public."subsystem" WHERE id = $1 LIMIT 1;',
                    params: [prow.id_subsystem],
                  });
                  subsystemName = sres?.rows?.[0]?.name || 'unknown';
                } catch (e) {
                  subsystemName = 'unknown';
                }
              }
              if (prow.id_parent === null) {
                if (!menus[subsystemName]) menus[subsystemName] = {};
                if (!menus[subsystemName][prow.name])
                  menus[subsystemName][prow.name] = pnode;
                idToNode[prow.id] = menus[subsystemName][prow.name];
              } else {
                idToNode[prow.id] = pnode;
              }
              parentNode = idToNode[c.id_parent];
            }
          } catch (e) {
            // ignore and postpone
          }
        }

        if (!parentNode) {
          remaining.push(c);
          continue;
        }

        if (!parentNode.submenus) parentNode.submenus = {};
        const submenuKey = c.menu_name;
        if (!parentNode.submenus[submenuKey]) {
          const submenuInfo = menuInfo[c.menu_id] || null;
          parentNode.submenus[submenuKey] = {
            description: submenuInfo?.description || c.menu_name || '',
            id: c.menu_id,
          };
          idToNode[c.menu_id] = parentNode.submenus[submenuKey];
        }

        if (!parentNode.submenus[submenuKey].options)
          parentNode.submenus[submenuKey].options = {};
        if (c.option_name) {
          const finalDesc = c.description || '';
          const tx = c.tx || null;
          parentNode.submenus[submenuKey].options[c.option_name] = {
            description: finalDesc,
            id: c.option_id,
            tx,
          };
        }

        progress = true;
      }
      pending = remaining;
    }

    if (pending.length > 0) {
      const missingParents = [...new Set(pending.map((c) => c.id_parent))];
      console.warn('parseMOP: unresolved menu parents after parsing passes', {
        missingParents,
        unresolvedChildren: pending,
      });
      return { menus, unresolved: pending };
    }

    return menus;
  } catch (error) {
    const utils = new Utils();
    const config = new Config();
    const ERROR_CODES = config.ERROR_CODES;

    utils.handleError({
      message: 'Error parsing MOP',
      statusCode: ERROR_CODES.INTERNAL_SERVER_ERROR,
      error,
    });
  }
}
