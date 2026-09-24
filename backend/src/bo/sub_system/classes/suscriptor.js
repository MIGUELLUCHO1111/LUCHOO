import DBMS from '../../../dbms/dbms.js';
import Config from '../../../../config/config.js';
import TelegramClient from '../../../tracker/telegramClient.js';

const config = new Config();
const STATUS_CODES = config.STATUS_CODES;

// Suscriptores del bot de Telegram con aprobacion (pedido de Lguerra,
// 24/09/2026): quien le escribe al bot queda PENDIENTE (ver
// TelegramSubscriberSync) y solo empieza a recibir alertas y reportes cuando
// alguien lo aprueba aqui. "Quitar acceso" lo deja BLOQUEADO: aunque vuelva
// a escribirle al bot no se reactiva solo. Lo que no se puede es impedirle
// abrir el chat del bot ni borrar lo que ya recibio -- solo que no le llegue
// nada nuevo.
class Suscriptor {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
    this.telegram = new TelegramClient();
  }

  listar = async () => {
    await this.dbmsReady;
    const result = await this.dbms.executeNamedQuery({ nameQuery: 'getTelegramSubscribers' });
    return { statusCode: STATUS_CODES.OK, data: result?.rows || [] };
  };

  aprobar = async ({ id } = {}) => {
    const fila = await this.cambiarEstado(id, 'ACTIVO');
    await this.telegram.sendTo(fila.chat_id, '✅ Tu acceso al bot de FullPetro fue aprobado. Desde ahora recibirás las alertas y los reportes de turno de la flota.');
    return { statusCode: STATUS_CODES.OK, data: fila, message: 'Suscriptor aprobado' };
  };

  quitarAcceso = async ({ id } = {}) => {
    const fila = await this.cambiarEstado(id, 'BLOQUEADO');
    return { statusCode: STATUS_CODES.OK, data: fila, message: 'Acceso retirado' };
  };

  cambiarEstado = async (id, status) => {
    await this.dbmsReady;
    if (!id) {
      throw new Error(JSON.stringify({ message: "Campo requerido: 'id'", statusCode: STATUS_CODES.BAD_REQUEST }));
    }
    const result = await this.dbms.executeNamedQuery({
      nameQuery: 'setTelegramSubscriberStatus',
      params: { id: Number(id), status },
    });
    const fila = result?.rows?.[0];
    if (!fila) {
      throw new Error(JSON.stringify({ message: 'Suscriptor no encontrado', statusCode: STATUS_CODES.NOT_FOUND }));
    }
    return fila;
  };
}

export default Suscriptor;
