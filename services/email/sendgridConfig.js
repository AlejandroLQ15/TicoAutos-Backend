/**
 * Configuración de correo transaccional (SendGrid) para TicoAutos.
 *
 * Aquí solo leemos variables de entorno y describimos el estado.
 * El envío real vive en `sendgrid.js`.
 *
 * Checklist producción (resumen):
 * 1. Crea una API Key en SendGrid (solo permiso “Mail Send” si puedes).
 * 2. Verifica un remitente: “Single Sender” o dominio completo (recomendado en producción).
 * 3. Copia `SENDGRID_API_KEY` y `SENDGRID_FROM_EMAIL` al `.env` del servidor.
 * 4. Reinicia el backend y haz un registro de prueba; revisa también la carpeta spam.
 *
 * @module services/email/sendgridConfig
 */

/**
 * @typedef {object} SendGridMailConfig
 * @property {string|null} apiKey
 * @property {string|null} fromEmail
 * @property {string} fromName  Nombre visible junto al remitente
 * @property {string|null} replyTo  Opcional
 * @property {string|null} logoUrl  Imagen opcional en el HTML del correo
 * @property {boolean} hasApiKey
 * @property {boolean} hasFromEmail
 * @property {boolean} isReady  Listo para envío real (no simulado)
 */

/**
 * Lee y normaliza la configuración SendGrid desde `process.env`.
 * @returns {SendGridMailConfig}
 */
function readSendGridMailConfig() {
  const apiKey = (process.env.SENDGRID_API_KEY || '').trim();
  const fromEmail = (process.env.SENDGRID_FROM_EMAIL || '').trim();
  const fromName = (process.env.SENDGRID_FROM_NAME || 'TicoAutos').trim();
  const replyTo = (process.env.SENDGRID_REPLY_TO || '').trim() || null;
  const logoUrl =
    (process.env.SENDGRID_MAIL_LOGO_URL || '').trim() ||
    'https://ticoautos-frontend.vercel.app/assets/TicoAutos_Logo.png';

  const hasApiKey = apiKey.length > 0;
  const hasFromEmail = fromEmail.includes('@');

  return {
    apiKey: hasApiKey ? apiKey : null,
    fromEmail: hasFromEmail ? fromEmail : null,
    fromName,
    replyTo: replyTo && replyTo.includes('@') ? replyTo : null,
    logoUrl,
    hasApiKey,
    hasFromEmail,
    isReady: hasApiKey && hasFromEmail,
  };
}

/**
 * Mensaje legible para consola (operadores / desarrollo).
 * @returns {string[]}
 */
function sendGridStartupLines() {
  const c = readSendGridMailConfig();
  if (c.isReady) {
    return [
      '[Correo] SendGrid listo: se enviarán activaciones reales.',
      `           Remitente: "${c.fromName}" <${c.fromEmail}>`,
    ];
  }
  const lines = ['[Correo] SendGrid no está completo — el correo de activación se simula (solo logs).'];
  if (!c.hasApiKey) lines.push('           → Falta SENDGRID_API_KEY (SendGrid → Settings → API Keys).');
  if (!c.hasFromEmail) {
    lines.push('           → Falta SENDGRID_FROM_EMAIL verificado (Single Sender o dominio).');
  }
  lines.push('           Ver comentarios en .env.example sección SendGrid.');
  return lines;
}

function logSendGridStartup() {
  sendGridStartupLines().forEach((line) => console.log(line));
}

module.exports = {
  readSendGridMailConfig,
  sendGridStartupLines,
  logSendGridStartup,
};
