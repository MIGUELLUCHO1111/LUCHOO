import axios from 'axios';

/**
 * Cliente de la API de Foresight GPS -- el mismo backend que usa el panel web
 * GEvolution (cloud.ve.trackergps.com). Doble autenticación:
 *   1. Basic Auth HTTP (usuario/contraseña de servicio)
 *   2. userid/companyid de la cuenta dentro del cuerpo JSON (identificadores
 *      internos de la plataforma, no secretos -- ver getCurrentUnitsStatus).
 */
export default class ForesightClient {
  constructor() {
    this.basicUser = process.env.FORESIGHT_BASIC_USER;
    this.basicPassword = process.env.FORESIGHT_BASIC_PASSWORD;
    this.conncode = process.env.FORESIGHT_CONNCODE;
    this.platformURL = process.env.FORESIGHT_PLATFORM_API_URL;
    this.userId = process.env.FORESIGHT_USERID;
    this.companyId = process.env.FORESIGHT_COMPANYID;
    this.reportIdComportamiento = process.env.FORESIGHT_REPORT_ID_COMPORTAMIENTO;
  }

  async post(body, url) {
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

  // REPORT_EXECUTE (reportid 134, "Comportamiento del Conductor" guardado en
  // la cuenta): mismo reporte que el panel web genera de un solo golpe para
  // TODAS las unidades con actividad en el rango de fechas -- viajes,
  // distancia, ralentí y también exceso de velocidad/aceleraciones/frenadas/
  // giros bruscos (esto último nunca lo devolvía wsGetTripsSummary_v1 +
  // GetEventsNotifications, el método anterior de una llamada por unidad).
  // Descubierto igual que usersearchplatform: captura de red real del panel
  // GEvolution mientras la usuaria generaba este reporte a mano.
  async getComportamientoDelDia({ startdate, enddate }) {
    const body = {
      method: 'REPORT_EXECUTE',
      conncode: this.conncode,
      reportid: this.reportIdComportamiento,
      userid: this.userId,
      prefix: true,
      parameter: '@LIST_VEHICLE_IDS|@STARTDATEANDTIME|@ENDDATEANDTIME|@UserID|@TIMEGROUP|@IsCompany|@IsSubfleet|@IsGroup',
      value: `-1|${startdate}|${enddate}|${this.userId}|1|${this.companyId}|0|0`,
    };

    const data = await this.post(body, this.platformURL);
    const rows = data?.ForesightFlexAPI?.DATA1;
    if (!Array.isArray(rows)) {
      throw new Error('Respuesta inesperada del reporte de Comportamiento del Conductor (sin campo DATA1)');
    }
    return rows;
  }
}
