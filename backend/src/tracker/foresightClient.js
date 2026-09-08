import axios from 'axios';

/**
 * Cliente de la API ForesightFlexAPIv3 (plataforma de rastreo GPS).
 * Doble autenticación requerida por la especificación técnica:
 *   1. Basic Auth HTTP (usuario/contraseña de servicio)
 *   2. Credenciales de plataforma dentro del cuerpo JSON (conncode/wsuser/wspassword)
 */
export default class ForesightClient {
  constructor() {
    this.baseURL = process.env.FORESIGHT_API_URL;
    this.basicUser = process.env.FORESIGHT_BASIC_USER;
    this.basicPassword = process.env.FORESIGHT_BASIC_PASSWORD;
    this.conncode = process.env.FORESIGHT_CONNCODE;
    this.wsuser = process.env.FORESIGHT_WSUSER;
    this.wspassword = process.env.FORESIGHT_WSPASSWORD;
  }

  credentialsBody() {
    return {
      conncode: this.conncode,
      wsuser: this.wsuser,
      wspassword: this.wspassword,
    };
  }

  async post(body) {
    const response = await axios.post(this.baseURL, body, {
      auth: { username: this.basicUser, password: this.basicPassword },
      headers: { 'Content-Type': 'application/json' },
      timeout: 20000,
    });
    return response?.data;
  }

  // La API no devuelve un código de error HTTP para el límite de peticiones:
  // responde 200 con { DATA: [{ ErrorMessage: 'Rate limit excedido...' }] }.
  // Sin este chequeo, ese mensaje se contaría como si fuera un evento/viaje real.
  extractRows(data) {
    const rows = data?.ForesightFlexAPI?.DATA;
    if (!Array.isArray(rows)) return [];
    if (rows.length === 1 && rows[0]?.ErrorMessage) {
      const error = new Error(rows[0].ErrorMessage);
      error.isRateLimit = /rate limit/i.test(rows[0].ErrorMessage);
      throw error;
    }
    return rows;
  }

  // GetCurrentUnitsStatus: posición y estado más reciente de la flota.
  // Sin 'plateno' devuelve TODA la flota en una sola llamada (verificado).
  async getCurrentUnitsStatus(plateno = null) {
    const body = { method: 'GetCurrentUnitsStatus', ...this.credentialsBody() };
    if (plateno) body.plateno = plateno;

    const data = await this.post(body);
    if (!Array.isArray(data?.ForesightFlexAPI?.DATA)) {
      throw new Error('Respuesta inesperada de la API de Foresight GPS (sin campo DATA)');
    }
    return this.extractRows(data);
  }

  // wsGetTripsSummary_v1: resumen de viajes de una unidad en un rango de
  // fechas (diurnos/nocturnos/mixtos, horas trabajadas, ralentí, distancia).
  // A diferencia de GetCurrentUnitsStatus, esta operación sí requiere 'plateno'
  // (se confirmó que sin él no devuelve nada) -- se llama una vez por unidad.
  async getTripsSummary({ plateno, startdate, enddate }) {
    const body = { method: 'wsGetTripsSummary_v1', ...this.credentialsBody(), plateno, startdate, enddate };
    const data = await this.post(body);
    return this.extractRows(data);
  }

  // GetEventsNotifications: eventos de la unidad en un rango de fechas
  // (excesos de velocidad, frenadas/giros/aceleraciones bruscas...).
  // NOTA (07/09/2026): algunas placas devuelven vacío para esta cuenta (puede
  // ser normal -- sin eventos ese día -- o el mismo límite de peticiones que
  // extractRows() ahora detecta). El Dashboard de Seguridad de la plataforma
  // sí muestra datos reales del día vía su propio panel (fuera de esta API);
  // ver el anexo de PDF de seguridad como respaldo mientras se confirma el
  // mapeo exacto de campos de tipo de evento con datos reales.
  async getEventsNotifications({ plateno, startdate, enddate }) {
    const body = { method: 'GetEventsNotifications', ...this.credentialsBody(), plateno, startdate, enddate };
    const data = await this.post(body);
    return this.extractRows(data);
  }
}
