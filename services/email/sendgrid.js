/**
 * Servicio de envío de correo electrónico via SendGrid.
 * Si SENDGRID_API_KEY no está configurada, el envío se simula en consola (modo desarrollo).
 *
 * Variables de entorno requeridas:
 *   SENDGRID_API_KEY    - Clave de API de SendGrid
 *   SENDGRID_FROM_EMAIL - Dirección remitente verificada en SendGrid (ej: noreply@ticoautos.com)
 */

const SENDGRID_FROM = (process.env.SENDGRID_FROM_EMAIL || '').trim();

/**
 * Envía el correo de activación de cuenta.
 * @param {{ to: string, nombre: string, activationUrl: string }} opts
 */
const sendActivationEmail = async ({ to, nombre, activationUrl }) => {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('[SendGrid] SENDGRID_API_KEY no configurada — simulando envío de activación.');
    console.log('[SendGrid] Para:', to);
    console.log('[SendGrid] URL de activación:', activationUrl);
    return;
  }

  if (!SENDGRID_FROM) {
    console.warn('[SendGrid] SENDGRID_FROM_EMAIL no configurada — no se puede enviar el correo de activación.');
    return;
  }

  // Importación dinámica para no requerir el módulo si no hay credenciales
  const sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  const ttlHours = process.env.ACTIVATION_TOKEN_TTL_HOURS || 24;

  try {
    await sgMail.send({
      to,
      from: SENDGRID_FROM,
      subject: 'Activa tu cuenta en TicoAutos',
      html: `
      <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
        <div style="text-align:center; padding: 24px 0 8px;">
          <img src="https://ticoautos-frontend.vercel.app/assets/TicoAutos_Logo.png"
               alt="TicoAutos" style="max-width:160px; height:auto;">
        </div>
        <div style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:32px;">
          <h2 style="margin:0 0 8px; font-size:1.25rem; color:#1e293b;">
            Bienvenido a TicoAutos, ${nombre}
          </h2>
          <p style="margin:0 0 20px; color:#475569; font-size:0.9375rem;">
            Haz clic en el botón de abajo para activar tu cuenta. El enlace es válido por ${ttlHours} horas.
          </p>
          <div style="text-align:center; margin-bottom:24px;">
            <a href="${activationUrl}"
               style="display:inline-block; background:#ed1c24; color:#fff; padding:12px 28px;
                      border-radius:8px; text-decoration:none; font-weight:600; font-size:0.9375rem;">
              Activar mi cuenta
            </a>
          </div>
          <p style="margin:0; color:#64748b; font-size:0.8125rem; word-break:break-all;">
            O copia y pega este enlace en tu navegador:<br>
            <span style="color:#0031a0;">${activationUrl}</span>
          </p>
        </div>
        <p style="text-align:center; color:#94a3b8; font-size:0.75rem; padding:16px 0 0;">
          Si no creaste esta cuenta, puedes ignorar este mensaje de forma segura.<br>
          © ${new Date().getFullYear()} TicoAutos
        </p>
      </div>
    `,
      text: `Hola ${nombre},\n\nActiva tu cuenta TicoAutos:\n${activationUrl}\n\nEste enlace vence en ${ttlHours} horas.\n\nSi no creaste esta cuenta, ignora este mensaje.`
    });
  } catch (error) {
    const status = error?.response?.statusCode || error?.code || 'UNKNOWN';
    const details = error?.response?.body?.errors
      ? JSON.stringify(error.response.body.errors)
      : (error?.message || 'Sin detalles');
    console.error(`[SendGrid] Error enviando correo de activación (status: ${status})`);
    console.error('[SendGrid] Detalle:', details);
    throw error;
  }
};

module.exports = { sendActivationEmail };
