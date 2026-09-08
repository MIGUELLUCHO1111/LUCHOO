import axios from 'axios';

/**
 * Envío de alertas por bot de Telegram. Si no hay token/chat configurados
 * (todavía no se creó el bot), no lanza error: solo loguea y sigue -- el
 * resto del sistema (sincronización, guardado de alertas) funciona igual.
 */
export default class TelegramClient {
  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN || null;
    this.chatId = process.env.TELEGRAM_CHAT_ID || null;
  }

  isConfigured() {
    return Boolean(this.token && this.chatId);
  }

  async sendMessage(text) {
    if (!this.isConfigured()) {
      console.warn('[Tracker] TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID no configurados; alerta no enviada:', text);
      return { sent: false, reason: 'not_configured' };
    }

    const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
    try {
      await axios.post(url, { chat_id: this.chatId, text }, { timeout: 10000 });
      return { sent: true };
    } catch (error) {
      console.error('[Tracker] Error enviando alerta por Telegram:', error?.response?.data || error.message);
      return { sent: false, reason: error?.response?.data?.description || error.message };
    }
  }
}
