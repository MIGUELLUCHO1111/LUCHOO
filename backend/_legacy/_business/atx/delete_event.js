export default async function delete_event(data) {
  const { id } = data; // destructuring de objeto

  if (!id) {
    throw new Error('Faltan datos obligatorios para eliminar el evento.');
  }

  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
    throw new Error('El ID del evento debe ser un número entero positivo.');
  }

  return await this.dbms.executeNamedQuery({
    nameQuery: 'deleteEvent',
    params: [id],
  });
}
