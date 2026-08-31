export default async function create_event(data) {
  const [name, descripcion, fecha, hora, costo, capacidad, visibilidad, lugar] =
    data;

  console.log('datos del evento:', data);

  if (typeof costo !== 'number' || !isFinite(costo)) {
    throw new Error('El costo debe ser un número válido.');
  }

  if (
    typeof capacidad !== 'number' ||
    !Number.isInteger(capacidad) ||
    capacidad < 0
  ) {
    throw new Error('La capacidad debe ser un número entero no negativo.');
  }
  if (
    !name ||
    !descripcion ||
    !fecha ||
    !hora ||
    costo === undefined ||
    capacidad === undefined ||
    !visibilidad ||
    !lugar
  ) {
    throw new Error('Faltan datos obligatorios para crear el evento.');
  }

  const nameError = this.validator.validateName(name, 'evento');
  if (nameError) {
    throw new Error(`Nombre inválido: ${nameError}`);
  }
  const descError = this.validator.validateDescription(descripcion, 'evento');
  if (descError) {
    throw new Error(`Descripción inválida: ${descError}`);
  }
  const fechaDate = this.validator.validateDate(fecha);
  if (typeof fechaDate === 'string') {
    throw new Error(`Fecha inválida: ${fechaDate}`);
  }
  const costoError = this.validator.validateFloat(costo, 'costo');
  if (costoError) {
    throw new Error(`Costo inválido: ${costoError}`);
  }

  const lugarError = this.validator.validateName(lugar, 'evento');
  if (lugarError) {
    throw new Error(`Lugar inválido: ${lugarError}`);
  }

  const capacidadError = this.validator.validateInteger(
    capacidad,
    'evento',
    'capacidad'
  );
  if (capacidadError) throw new Error(`Capacidad inválida: ${capacidadError}`);

  return await this.dbms.executeNamedQuery({
    nameQuery: 'createEvento',
    params: [
      name,
      descripcion,
      fecha,
      hora,
      costo,
      capacidad,
      visibilidad,
      lugar,
    ],
  });
}
