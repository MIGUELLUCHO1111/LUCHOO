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

  // Geocercas (perimetro permitido, Fase 3): mismas dos llamadas que hace el
  // panel web al abrir "Geocercas" (confirmado por captura de red real,
  // 16/09/2026) -- usersearchplatform con elements:3 en vez de vacio lista
  // las geocercas (no vehiculos), y coordinates_tlist con esos IDs trae el
  // poligono de cada una ("lng,lat|lng,lat|..." que cierra sobre si mismo).
  async getGeocercas() {
    const listBody = {
      userid: this.userId,
      companyid: Number(this.companyId),
      subfleetid: 0,
      groupid: 0,
      requesttype: 0,
      elements: 3,
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
    const listData = await this.post(listBody, this.platformURL);
    const list = this.extractRows(listData);
    const ids = list.map((g) => g.id).filter(Boolean).join(',');
    if (!ids) return [];

    const coordBody = {
      idgeolist: ids,
      userid: this.userId,
      prefix: true,
      conncode: this.conncode,
      method: 'coordinates_tlist',
    };
    const coordData = await this.post(coordBody, this.platformURL);
    const rows = this.extractRows(coordData);

    return rows
      .filter((g) => g.coordinates)
      .map((g) => ({
        externalId: String(g.id),
        name: g.name,
        comments: g.comments ? String(g.comments).trim() || null : null,
        polygon: g.coordinates.split('|').map((pair) => pair.split(',').map(Number)),
      }));
  }

  // Recorridos por vehiculo (Fase 3, pedido de Lguerra 17/09/2026): mismas
  // dos llamadas que hace el "Panel de Monitoreo-Recorridos" del panel web
  // (confirmado por captura de red real, 18/09/2026). TRIPSPOINTS_MOD trae
  // la lista de viajes de una unidad en un rango de fechas (salida, llegada,
  // duracion, distancia, ubicacion); HISTORYSPOINTS trae los puntos GPS
  // segundo a segundo de UN viaje puntual, para dibujar la ruta en el mapa.
  async getRecorridos({ gpsUnitId, startdate, enddate }) {
    const body = {
      userid: this.userId,
      list_vehicle_ids: gpsUnitId,
      startdateandtime: startdate,
      enddateandtime: enddate,
      prefix: true,
      conncode: this.conncode,
      method: 'TRIPSPOINTS_MOD',
    };
    const data = await this.post(body, this.platformURL);
    const rows = this.extractRows(data);

    return rows.map((r) => ({
      beginTime: r.begintruetime,
      endTime: r.endtruetime,
      duration: r.Duration,
      beginLat: r.beginylat != null ? Number(r.beginylat) : null,
      beginLng: r.beginxlong != null ? Number(r.beginxlong) : null,
      endLat: r.endylat != null ? Number(r.endylat) : null,
      endLng: r.endxlong != null ? Number(r.endxlong) : null,
      distanceKm: r.distance_dunit != null ? Number(r.distance_dunit) : null,
      location: r.location || null,
      driver: r.driver || null,
    }));
  }

  async getRutaPuntos({ gpsUnitId, startdate, enddate }) {
    const body = {
      method: 'HISTORYSPOINTS',
      userid: this.userId,
      conncode: this.conncode,
      list_vehicle_ids: gpsUnitId,
      startdateandtime: startdate,
      enddateandtime: enddate,
      prefix: true,
    };
    const data = await this.post(body, this.platformURL);
    const rows = this.extractRows(data);

    return rows.map((r) => ({
      time: r.truetime,
      lat: r.ylat != null ? Number(r.ylat) : null,
      lng: r.xlong != null ? Number(r.xlong) : null,
      speed: r.speed_dunit != null ? Number(r.speed_dunit) : null,
      ignition: r.ignition === 'true' || r.ignition === true,
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
