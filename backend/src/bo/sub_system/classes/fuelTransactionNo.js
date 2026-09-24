// Genera el Transaction ID de Combustible (Julio, 21/09/2026) -- deja de
// ser un campo libre que llena la persona, se calcula solo:
//   Liviana (gasolina): FP-{AA}GL{MM}{DD}{###}
//   Pesada  (gasoil):   FP-{AA}DS{MM}{DD}{###}
// AA/MM/DD son del día del llenado (filled_at, no "hoy" -- alguien puede
// estar cargando un día atrasado), ### es el consecutivo de esa flota ese
// día empezando en 001. Compartido por Carga y Pesada porque el formato y
// la tabla del contador (fuel_transaction_counter) son los mismos, solo
// cambia el código de flota.
// El front manda filled_at como ISO en UTC (new Date(`${fecha}T${hora}`)
// interpreta fecha+hora como hora LOCAL del navegador y lo convierte a
// UTC) -- un llenado registrado, por ejemplo, a las 9pm en Venezuela
// (UTC-4) llega como las 01:00 UTC del día SIGUIENTE. Sacar el día con
// getUTCDate() directo daría la fecha equivocada; hay que volver a leerlo
// en la zona horaria real de Venezuela, no en UTC ni en la del server.
const VE_TIMEZONE = 'America/Caracas';

function veDateParts(isoString) {
  const date = isoString ? new Date(isoString) : new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: VE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return { yyyy: get('year'), mm: get('month'), dd: get('day') };
}

export async function generateFuelTransactionNo({ dbms, client, filled_at, fleetCode }) {
  const { yyyy, mm, dd } = veDateParts(filled_at);
  const yy = yyyy.slice(-2);
  const fecha = `${yyyy}-${mm}-${dd}`;

  const result = await dbms.executeNamedQuery({
    nameQuery: 'incrementFuelTransactionCounter',
    client,
    params: { fecha, fleet_code: fleetCode },
  });
  const seq = result?.rows?.[0]?.last_seq ?? 1;

  return `FP-${yy}${fleetCode}${mm}${dd}${String(seq).padStart(3, '0')}`;
}
