import DBMS from '../../../dbms/dbms.js';
import Config from '../../../../config/config.js';
import ForesightClient from '../../../tracker/foresightClient.js';

const config = new Config();
const STATUS_CODES = config.STATUS_CODES;

// Perimetro permitido de la operacion (Fase 3, pedido de Lguerra 16/09/2026):
// las geocercas se dibujan y editan en el panel GEvolution, no aqui -- esta
// clase solo las copia a nuestra base para poder evaluar la alerta de "fuera
// de geocerca" sin depender de la API del proveedor en cada sincronizacion
// de posiciones (cada 10 minutos seria demasiadas llamadas).
class Geocerca {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
    this.client = new ForesightClient();
  }

  sincronizar = async () => {
    await this.dbmsReady;
    const geocercas = await this.client.getGeocercas();

    let guardadas = 0;
    for (const g of geocercas) {
      await this.dbms.executeNamedQuery({
        nameQuery: 'upsertTrackerGeofence',
        params: {
          external_id: g.externalId,
          name: g.name,
          comments: g.comments,
          polygon: JSON.stringify(g.polygon),
        },
      });
      guardadas += 1;
    }

    return { statusCode: STATUS_CODES.OK, data: { total: geocercas.length, guardadas } };
  };

  listar = async () => {
    await this.dbmsReady;
    const result = await this.dbms.executeNamedQuery({ nameQuery: 'getTrackerGeofences' });
    return { statusCode: STATUS_CODES.OK, data: result?.rows || [] };
  };
}

export default Geocerca;
