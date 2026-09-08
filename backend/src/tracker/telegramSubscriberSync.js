import axios from 'axios';
import DBMS from '../dbms/dbms.js';

/**
 * Revisa periódicamente los mensajes nuevos que le hayan escrito al bot de
 * Telegram y registra a cada persona como suscriptor automáticamente (sin
 * editar .env ni avisar a nadie) -- ver también telegramClient.js, que lee
 * de esta misma tabla para saber a quién mandarle las alertas.
 *
 * Usa polling (getUpdates), no un webhook: no requiere una URL pública ni
 * HTTPS, funciona igual en desarrollo local que en un servidor real.
 */
export default class TelegramSubscriberSync {
  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN || null;
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
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

      await this.dbms.executeNamedQuery({
        nameQuery: 'upsertTelegramSubscriber',
        params: {
          chat_id: String(chat.id),
          username: chat.username || null,
          first_name: chat.first_name || null,
        },
      });
      nuevos += 1;
    }

    return { nuevos };
  };
}
