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

  // Mensaje a UNA sola persona (no a todos los suscriptores) -- para avisarle
  // a quien pidio acceso que su solicitud quedo pendiente o fue aprobada.
  async sendTo(chatId, text) {
    if (!this.token || !chatId) return { sent: false, reason: 'not_configured' };
    try {
      await axios.post(`https://api.telegram.org/bot${this.token}/sendMessage`, { chat_id: String(chatId), text }, { timeout: 10000 });
      return { sent: true };
    } catch (error) {
      return { sent: false, reason: error?.response?.data?.description || error.message };
    }
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

  /**
   * Igual que sendMessage pero adjunta un archivo (ej. el Excel del reporte
   * de turno) -- Telegram lo muestra como documento descargable dentro del
   * mismo mensaje, con `caption` como el texto que lo acompaña.
   */
  async sendDocument({ buffer, filename, caption }) {
    if (!this.token) {
      console.warn('[Tracker] TELEGRAM_BOT_TOKEN no configurado; documento no enviado:', filename);
      return { sent: false, reason: 'not_configured' };
    }

    const chatIds = await this.getRecipientChatIds();
    if (chatIds.length === 0) {
      console.warn('[Tracker] Sin destinatarios de Telegram (nadie le ha escrito al bot todavía); documento no enviado:', filename);
      return { sent: false, reason: 'no_recipients' };
    }

    const url = `https://api.telegram.org/bot${this.token}/sendDocument`;
    const results = await Promise.all(
      chatIds.map(async (chatId) => {
        try {
          const form = new FormData();
          form.append('chat_id', chatId);
          if (caption) form.append('caption', caption);
          form.append('document', new Blob([buffer]), filename);
          await axios.post(url, form, { timeout: 20000 });
          return { chatId, sent: true };
        } catch (error) {
          const reason = error?.response?.data?.description || error.message;
          console.error(`[Tracker] Error enviando documento por Telegram a ${chatId}:`, reason);
          return { chatId, sent: false, reason };
        }
      }),
    );

    const failed = results.filter((r) => !r.sent);
    return {
      sent: results.some((r) => r.sent),
      reason: failed.length ? failed.map((f) => `${f.chatId}: ${f.reason}`).join('; ') : null,
    };
  }
}
