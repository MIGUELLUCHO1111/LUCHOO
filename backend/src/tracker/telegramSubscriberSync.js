import axios from 'axios';
import DBMS from '../dbms/dbms.js';
import TelegramClient from './telegramClient.js';

/**
 * Revisa periódicamente los mensajes nuevos que le hayan escrito al bot de
 * Telegram y registra a cada persona como suscriptor PENDIENTE (desde el
 * 24/09/2026 hace falta aprobarlo en la app, ver Suscriptor) -- ver también
 * telegramClient.js, que lee de esta misma tabla (solo los activos) para
 * saber a quién mandarle las alertas.
 *
 * Usa polling (getUpdates), no un webhook: no requiere una URL pública ni
 * HTTPS, funciona igual en desarrollo local que en un servidor real.
 */
export default class TelegramSubscriberSync {
  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN || null;
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
    this.telegram = new TelegramClient();
    this.lastUpdateId = 0;
  }

  pollForNewSubscribers = async () => {
    if (!this.token) return { nuevos: 0 };
    await this.dbmsReady;

    const url = `https://api.telegram.org/bot${this.token}/getUpdates`;
    const params = { timeout: 0, allowed_updates: JSON.stringify(['message']) };
    if (this.lastUpdateId) params.offset = this.lastUpdateId + 1;

    const { data } = await axios.get(url, { params, timeout: 15000 });
    const updates = data?.result || [];

    let nuevos = 0;
    for (const update of updates) {
      this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id);

      const chat = update.message?.chat;
      if (!chat || chat.type !== 'private') continue;

      const result = await this.dbms.executeNamedQuery({
        nameQuery: 'upsertTelegramSubscriber',
        params: {
          chat_id: String(chat.id),
          username: chat.username || null,
          first_name: chat.first_name || null,
        },
      });

      // Con aprobacion (24/09/2026): quien escribe por primera vez queda
      // PENDIENTE y no recibe nada hasta que lo aprueben en la app. Se le
      // avisa a el y a los suscriptores activos UNA sola vez (al registrarse),
      // no cada vez que vuelva a escribir.
      const fila = result?.rows?.[0];
      if (fila?.nuevo) {
        nuevos += 1;
        const nombre = [chat.first_name, chat.username ? `(@${chat.username})` : null].filter(Boolean).join(' ') || `chat ${chat.id}`;
        await this.telegram.sendTo(chat.id, '⏳ Tu solicitud de acceso al bot de FullPetro quedó pendiente de aprobación. Te avisaremos por aquí cuando sea aprobada.');
        await this.telegram.sendMessage(
          `🔔 Nueva solicitud de acceso al bot: ${nombre}\n` +
          `No recibe nada hasta que la apruebes en Tracker GPS → Notificaciones → Suscriptores de Telegram.`,
        );
      }
    }

    return { nuevos };
  };
}
