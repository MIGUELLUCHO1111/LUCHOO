import getMethod from "../atx/get-method.js";

export default async function _ensureEntityByUniqueField(
  client,
  table,
  fields
) {
  const _q = await getMethod({ className: 'helpers', method: '_q' });

  // Asumimos campo único 'name' si está presente; si no, usamos primer key
  const keys = Object.keys(fields);
  if (keys.length === 0) return null;
  const tableQ = `public.${_q(table)}`;
  // Decide whether to use composite fields for lookup (useful for menus where id_subsystem/id_parent matter)
  const useComposite =
    keys.includes('id_subsystem') || keys.includes('id_parent');
  if (useComposite) {
    const where = keys.map((k, i) => `${_q(k)} = $${i + 1}`).join(' AND ');
    const sel = `SELECT id FROM ${tableQ} WHERE ${where} LIMIT 1;`;
    const selVals = keys.map((k) => fields[k]);
    const selRes = await client.query(sel, selVals);
    if (selRes.rows && selRes.rows.length > 0) return selRes.rows[0].id;
  } else {
    // fallback: use single unique key 'name' when present, else first key
    const uniqueKey = keys.includes('name') ? 'name' : keys[0];
    const keyQ = _q(uniqueKey);
    const sel = `SELECT id FROM ${tableQ} WHERE ${keyQ} = $1 LIMIT 1;`;
    const selRes = await client.query(sel, [fields[uniqueKey]]);
    if (selRes.rows && selRes.rows.length > 0) return selRes.rows[0].id;
  }
  const cols = keys.map((k) => _q(k)).join(', ');
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  const insVals = keys.map((k) => fields[k]);
  const ins = `INSERT INTO ${tableQ} (${cols}) VALUES (${placeholders}) RETURNING id;`;
  const insRes = await client.query(ins, insVals);
  return insRes.rows[0].id;
}
