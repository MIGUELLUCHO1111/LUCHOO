import executeMethod from "../atx/execute-method.js";

export default async function _ensureJoin(client, table, fields) {
  const _q = await executeMethod({ className: 'helpers', method: '_q' });

  const keys = Object.keys(fields);
  const tableQ = `public.${_q(table)}`;
  const where = keys.map((k, i) => `${_q(k)} = $${i + 1}`).join(' AND ');
  const sel = `SELECT 1 FROM ${tableQ} WHERE ${where} LIMIT 1;`;
  const vals = keys.map((k) => fields[k]);
  const selRes = await client.query(sel, vals);
  if (!selRes.rows || selRes.rows.length === 0) {
    // Dev debug: log join insertions for troubleshooting menu/option/profile mapping
    try {
      // suppressed join-insert debug
    } catch (e) {}
    const cols = keys.map((k) => _q(k)).join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const ins = `INSERT INTO ${tableQ} (${cols}) VALUES (${placeholders});`;
    await client.query(ins, vals);
  }
}
