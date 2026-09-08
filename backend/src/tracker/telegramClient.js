import axios from 'axios';
import DBMS from '../dbms/dbms.js';

/**
 * Envío de alertas por bot de Telegram, a todos los suscriptores activos
 * (tracker_telegram_subscriber) más cualquier chat_id fijo en
 * TELEGRAM_CHAT_ID (compatibilidad / garantiza un destinatario admin aunque
 * la tabla esté vacía). Cualquiera que le escriba al bot queda suscrito
 * solo -- ver telegramSubscriberSync.js -- sin tocar código ni .env.
 * Si no hay token configurado, no lanza error: solo loguea y sigue -- el
 * resto del sistema funciona igual.
 */
export default class TelegramClient {
  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN || null;
    this.envChatIds = (process.env.TELEGRAM_CHAT_ID || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
  }

  async getRecipientChatIds() {
    await this.dbmsReady;
    let subscriberIds = [];
    try {
      const result = await this.dbms.executeNamedQuery({ nameQuery: 'getActiveTelegramSubscribers' });
      subscriberIds = (result?.rows || []).map((s) => String(s.chat_id));
    } catch (error) {
      console.error('[Tracker] Error leyendo suscriptores de Telegram:', error.message);
    }
    return [...new Set([...this.envChatIds, ...subscriberIds])];
  }

  async isConfigured() {
    if (!this.token) return false;
    const chatIds = await this.getRecipientChatIds();
    return chatIds.length > 0;
  }

  async sendMessage(text) {
    if (!this.token) {
      console.warn('[Tracker] TELEGRAM_BOT_TOKEN no configurado; alerta no enviada:', text);
      return { sent: false, reason: 'not_configured' };
    }

    const chatIds = await this.getRecipientChatIds();
    if (chatIds.length === 0) {
      console.warn('[Tracker] Sin destinatarios de Telegram (nadie le ha escrito al bot todavía); alerta no enviada:', text);
      return { sent: false, reason: 'no_recipients' };
    }

    const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
    const results = await Promise.all(
      chatIds.map(async (chatId) => {
        try {
          await axios.post(url, { chat_id: chatId, text }, { timeout: 10000 });
          return { chatId, sent: true };
        } catch (error) {
          const reason = error?.response?.data?.description || error.message;
          console.error(`[Tracker] Error enviando alerta por Telegram a ${chatId}:`, reason);
          return { chatId, sent: false, reason };
        }
      }),
    );

    const failed = results.filter((r) => !r.sent);
    return {
      // "enviado" si al menos a una persona le llegó -- no se pierde la
      // notificación completa solo porque un destinatario falló.
      sent: results.some((r) => r.sent),
      reason: failed.length ? failed.map((f) => `${f.chatId}: ${f.reason}`).join('; ') : null,
    };
  }
}
