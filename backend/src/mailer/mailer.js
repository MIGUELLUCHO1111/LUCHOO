import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

export default class Mailer {
  constructor() {
    this.resend = resend;
    this.defaultFrom = process.env.EMAIL || 'onboarding@resend.dev';
  }

  async sendEmail(to, subject, html) {
    if (!this.resend) {
      console.warn('RESEND_API_KEY is not set. Skipping email send.');
      return { skipped: true, reason: 'missing_api_key' };
    }

    try {
      const result = await this.resend.emails.send({
        from: this.defaultFrom,
        to,
        subject,
        html,
      });
      // Resend retorna { id } o { data, error } segun versión.
      // const id = result?.id || result?.data?.id;
      // if (id) console.log('[mailer] email sent:', { to, subject, id });
      if (result?.error) console.error('[mailer] resend error:', result.error);
      return result;
    } catch (error) {
      console.error('[mailer] sendEmail failed:', {
        to,
        subject,
        error: error?.message || error,
      });
      throw error;
    }
  }

  async sendRecoveryEmail({ email, token, origin, username }) {
    const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`;

    return this.sendEmail(
      email,
      'Spectra Suite - Password Recovery',
      `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.4;">
            <h2>Recuperación de contraseña</h2>

            <p>Hola${username ? ` <b>${username}</b>` : ''},</p>

            <p>Recibimos una solicitud para restablecer tu contraseña.</p>

            <p>
              <a
                href="${resetUrl}"
                style="
                  display: inline-block;
                  padding: 10px 14px;
                  background: #3d1b39;
                  color: white;
                  text-decoration: none;
                  border-radius: 6px;
                "
              >
                Restablecer contraseña
              </a>
            </p>

            <p style="color: #666; font-size: 12px; margin-top: 8px;">
              Si el botón no funciona, copia y pega este enlace en tu navegador:
              <br />
              <span style="word-break: break-all;">${resetUrl}</span>
            </p>

            <p style="color: #666; font-size: 12px;">
              Si no fuiste tú, ignora este correo.
            </p>
          </body>
        </html>
      `,
    );
  }
}
