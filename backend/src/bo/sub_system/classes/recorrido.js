import Config from '../../../../config/config.js';
import ForesightClient from '../../../tracker/foresightClient.js';

const config = new Config();
const STATUS_CODES = config.STATUS_CODES;

const veDateISO = (date = new Date()) => date.toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });

// Convierte un timestamp (ej. tracker_alert.triggered_at, con offset UTC)
// a la hora de pared de Venezuela sin offset ("YYYY-MM-DDTHH:mm:ss"), que es
// el formato que espera TRIPSPOINTS_MOD -- 'sv-SE' da "YYYY-MM-DD HH:mm:ss"
// de entrada, solo hace falta cambiar el espacio por la "T".
const veDateTimeISO = (isoWithOffset) =>
  new Date(isoWithOffset).toLocaleString('sv-SE', { timeZone: 'America/Caracas' }).replace(' ', 'T');

// Horas transcurridas entre dos ISO -- se usa para sumar distancia/duracion
// de los viajes del dia (mismo criterio que Duration del proveedor, pero
// calculado aca para no depender de que el texto "H:MM" siempre venga bien
// formado).
const hoursBetween = (isoStart, isoEnd) => {
  if (!isoStart || !isoEnd) return 0;
  const ms = new Date(isoEnd).getTime() - new Date(isoStart).getTime();
  return Number.isFinite(ms) && ms > 0 ? ms / (1000 * 60 * 60) : 0;
};

// Recorridos por vehiculo (Fase 3, pedido de Lguerra 17-18/09/2026): lista
// de viajes de una unidad en un dia (Mapa en Vivo -> clic en una unidad o
// selector aparte), con los totales que se ven en las capturas de
// referencia -- numero de recorridos, primera salida, ultima llegada,
// kilometros y tiempo en movimiento/estacionado.
class Recorrido {
  constructor() {
    this.client = new ForesightClient();
  }

  // `desde` (opcional, ISO con offset -- ej. tracker_alert.triggered_at):
  // acota el inicio de la ventana a partir de ese momento en vez del inicio
  // del dia. Pedido de Lguerra, 18/09/2026: al abrir Recorridos desde una
  // alerta, solo interesa lo que hizo la unidad DESPUES de que se disparo
  // (ej. fuera de horario, a partir de las 8pm), no el dia completo.
  listar = async ({ gps_unit_id, fecha, desde } = {}) => {
    if (!gps_unit_id) {
      throw new Error(JSON.stringify({ message: "Falta 'gps_unit_id' para consultar los recorridos", statusCode: STATUS_CODES.BAD_REQUEST }));
    }
    const resolvedFecha = fecha || veDateISO();
    const startdate = desde ? veDateTimeISO(desde) : `${resolvedFecha}T00:00:00`;
    const enddate = `${resolvedFecha}T23:59:59`;

    const viajes = await this.client.getRecorridos({ gpsUnitId: gps_unit_id, startdate, enddate });
    const ordenados = viajes.slice().sort((a, b) => new Date(a.beginTime || 0) - new Date(b.beginTime || 0));

    const kmTotales = ordenados.reduce((s, v) => s + (v.distanceKm || 0), 0);
    const horasMovimiento = ordenados.reduce((s, v) => s + hoursBetween(v.beginTime, v.endTime), 0);

    const primeraSalida = ordenados[0]?.beginTime || null;
    const ultimaLlegada = ordenados.length ? ordenados[ordenados.length - 1].endTime : null;
    // "Tiempo estacionado" dentro de la ventana operativa del dia (entre la
    // primera salida y la ultima llegada) -- fuera de esa ventana la unidad
    // ni siquiera habia empezado o ya habia terminado el dia, no cuenta como
    // "estacionada esperando".
    const ventanaOperativaHoras = hoursBetween(primeraSalida, ultimaLlegada);
    const horasEstacionado = Math.max(ventanaOperativaHoras - horasMovimiento, 0);

    return {
      statusCode: STATUS_CODES.OK,
      data: {
        fecha: resolvedFecha,
        desde_aplicado: desde || null,
        total_recorridos: ordenados.length,
        primera_salida: primeraSalida,
        ultima_llegada: ultimaLlegada,
        km_totales: Number(kmTotales.toFixed(2)),
        horas_en_movimiento: Number(horasMovimiento.toFixed(2)),
        horas_estacionado: Number(horasEstacionado.toFixed(2)),
        viajes: ordenados,
      },
    };
  };

  ruta = async ({ gps_unit_id, startdate, enddate } = {}) => {
    if (!gps_unit_id || !startdate || !enddate) {
      throw new Error(JSON.stringify({
        message: "Faltan datos ('gps_unit_id', 'startdate', 'enddate') para trazar la ruta",
        statusCode: STATUS_CODES.BAD_REQUEST,
      }));
    }
    const puntos = await this.client.getRutaPuntos({ gpsUnitId: gps_unit_id, startdate, enddate });
    return { statusCode: STATUS_CODES.OK, data: puntos };
  };
}

export default Recorrido;
