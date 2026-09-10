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

    // Mismo proveedor (Foresight), pero el método que usa el panel web
    // GEvolution (cloud.ve.trackergps.com) para listar la flota -- se
    // autentica distinto (userid/companyid de la cuenta, no wsuser/wspassword)
    // y sí devuelve las ~70 unidades reales, no el subconjunto que ve la
    // cuenta de servicio de abajo. Ver getCurrentUnitsStatus().
    this.platformURL = process.env.FORESIGHT_PLATFORM_API_URL;
    this.userId = process.env.FORESIGHT_USERID;
    this.companyId = process.env.FORESIGHT_COMPANYID;
  }

  credentialsBody() {
    return {
      conncode: this.conncode,
      wsuser: this.wsuser,
      wspassword: this.wspassword,
    };
  }

  async post(body, url = this.baseURL) {
    const response = await axios.post(url, body, {
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

  // usersearchplatform: mismo método que usa el panel web GEvolution para
  // listar la flota completa (confirmado por captura de red real: trae las
  // 70 unidades de la cuenta, con DATA1.total confirmando el conteo). Se
  // autentica con userid/companyid de la cuenta en vez de wsuser/wspassword
  // -- eso es justo lo que veía menos unidades. Los campos de cada fila
  // vienen en minúscula y con nombres distintos a GetCurrentUnitsStatus, así
  // que se traducen aquí mismo a la forma que ya espera el resto del código
  // (PlateNo, Name, Location, yLat, xLong, Ignition, LastTime, ID) para no
  // tener que tocar snapshot.js.
  async getCurrentUnitsStatus() {
    const body = {
      userid: this.userId,
      companyid: Number(this.companyId),
      subfleetid: 0,
      groupid: 0,
      requesttype: 0,
      elements: '',
      parameterfilter: '',
      planids: '',
      tempvalue: '',
      tobjectypeids: '',
      favoritefilterid: '',
      isdeleted: 0,
      name: '^^',
      pageindex: 1,
      pagesize: 200,
      orderby: 'name',
      orderdirection: 'ASC',
      prefix: true,
      conncode: this.conncode,
      method: 'usersearchplatform',
    };

    const data = await this.post(body, this.platformURL);
    if (!Array.isArray(data?.ForesightFlexAPI?.DATA)) {
      throw new Error('Respuesta inesperada de la API de Foresight GPS (sin campo DATA)');
    }
    const rows = this.extractRows(data);

    return rows.map((r) => ({
      ID: r.id != null ? Number(r.id) : null,
      PlateNo: r.plateno,
      Name: r.name,
      Location: r.location,
      yLat: r.ylat != null ? Number(r.ylat) : null,
      xLong: r.xlong != null ? Number(r.xlong) : null,
      Speed: null,
      Ignition: r.ignition === 'true' || r.ignition === true,
      LastTime: r.lasttime,
    }));
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
