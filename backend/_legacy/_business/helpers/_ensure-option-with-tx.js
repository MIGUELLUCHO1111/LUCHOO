export default async function _ensureOptionWithTx(
  client,
  { name, description, tx }
) {
  if (!name) return null;
  // No reutilizar opción únicamente por tx: las opciones son entidades por nombre
  // y pueden compartir la misma transacción (tx) si llaman al mismo método.
  // Buscar por nombre primero y actualizar su tx si es necesario.
  const sel = 'SELECT id, tx FROM public."option" WHERE name = $1 LIMIT 1;';
  const selRes = await client.query(sel, [name]);
  if (selRes.rows && selRes.rows.length > 0) {
    const row = selRes.rows[0];
    if (tx && row.tx != tx) {
      await client.query('UPDATE public."option" SET tx = $1 WHERE id = $2;', [
        tx,
        row.id,
      ]);
    }
    return row.id;
  }
  const ins =
    'INSERT INTO public."option" (name, description, tx) VALUES ($1, $2, $3) RETURNING id;';
  const insRes = await client.query(ins, [
    name,
    description || name,
    tx || null,
  ]);
  return insRes.rows[0].id;
}
