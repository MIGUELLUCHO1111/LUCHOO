export default async function list_events() {
  try {
    const res = await this.dbms.executeNamedQuery({
      nameQuery: 'list_event',
      params: [],
    });
    // devuelve array de eventos
    return res.rows;
  } catch (err) {
    console.error('Error en get_events', err);
    throw new Error('No se pudieron obtener los eventos');
  }
}
