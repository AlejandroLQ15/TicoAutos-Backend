/**
 * Envío del correo de activación de cuenta mediante SendGrid.
 *
 * - Si la configuración no está lista, **no falla** el flujo: devuelve `delivered: false`
 *   y deja trazas en consola (útil en desarrollo).
 * - Si SendGrid rechaza el envío (remitente no verificado, clave inválida, etc.),
 *   devuelve `delivered: false` con `operatorMessage` para logs y un `userHint` genérico.
 *
 * @module services/email/sendgrid
 */

const { readSendGridMailConfig } = require('./sendgridConfig');

/**
 * @typedef {object} ActivationSendResult
 * @property {boolean} delivered  `true` si SendGrid aceptó el envío
 * @property {'live'|'simulated'|'error'} mode
 * @property {string} [userHint]  Texto seguro para mostrar al usuario final (opcional)
 * @property {string} [operatorMessage]  Detalle para logs / soporte
 */

/**
 * Traduce errores frecuentes de SendGrid a mensajes en castellano para quien opera el servidor.
 * @param {unknown} error
 * @param {{ fromEmail?: string|null }} [cfg]
 * @returns {string}
 */
function formatSendGridErrorForOperator(error, cfg = {}) {
  const status = error?.response?.statusCode || error?.code;
  const body = error?.response?.body;
  const first = Array.isArray(body?.errors) ? body.errors[0] : null;
  const detail = first?.message || first?.field || error?.message || 'Sin detalle';
  const from = cfg.fromEmail || '(SENDGRID_FROM_EMAIL)';

  if (status === 401 || status === 403) {
    return `SendGrid rechazó la autenticación (${status}). Revisa que SENDGRID_API_KEY sea la clave correcta y no esté revocada.`;
  }
  if (String(detail).toLowerCase().includes('from') || String(detail).toLowerCase().includes('sender')) {
    return `SendGrid no aceptó el remitente. Verifica que ${from} esté verificado en el panel (Single Sender o dominio). Detalle: ${detail}`;
  }
  return `SendGrid respondió con error (${status || 'n/c'}): ${detail}`;
}

/**
 * Construye el HTML del correo de activación (plantilla simple, compatible con clientes de correo comunes).
 */
function buildActivationHtml({ nombre, activationUrl, ttlHours, logoUrl }) {
  const safeName = String(nombre || 'Usuario').replace(/</g, '');

  return `
      <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
        <div style="text-align:center; padding: 24px 0 8px;">
          <img src="${logoUrl}" alt="TicoAutos" style="max-width:160px; height:auto;">
        </div>
        <div style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:32px;">
          <h2 style="margin:0 0 8px; font-size:1.25rem; color:#1e293b;">
            Bienvenido a TicoAutos, ${safeName}
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
            <span style="color:#0031a0;">${String(activationUrl).replace(/</g, '')}</span>
          </p>
        </div>
        <p style="text-align:center; color:#94a3b8; font-size:0.75rem; padding:16px 0 0;">
          Si no creaste esta cuenta, puedes ignorar este mensaje de forma segura.<br>
          © ${new Date().getFullYear()} TicoAutos
        </p>
      </div>
    `;
}

/**
 * Envía el correo de activación de cuenta.
 * @param {{ to: string, nombre: string, activationUrl: string }} opts
 * @returns {Promise<ActivationSendResult>}
 */
const sendActivationEmail = async ({ to, nombre, activationUrl }) => {
  const cfg = readSendGridMailConfig();
  const ttlHours = process.env.ACTIVATION_TOKEN_TTL_HOURS || 24;

  if (!cfg.isReady) {
    if (!cfg.hasApiKey) {
      console.warn('[SendGrid] SENDGRID_API_KEY no configurada — simulando envío de activación.');
    } else {
      console.warn('[SendGrid] SENDGRID_FROM_EMAIL no configurada o inválida — no se envía el correo.');
    }
    console.log('[SendGrid] (simulado) Para:', to);
    console.log('[SendGrid] (simulado) URL de activación:', activationUrl);
    return {
      delivered: false,
      mode: 'simulated',
      userHint:
        process.env.NODE_ENV === 'production'
          ? 'Tu cuenta quedó creada, pero el envío de correo no está bien configurado en el servidor. Contacta al administrador del sitio.'
          : 'Tu cuenta quedó creada; en desarrollo el correo no se envía. Mira la consola del servidor para copiar el enlace de activación, o configura SendGrid en .env.',
      operatorMessage: 'Configuración SendGrid incompleta (ver .env.example).',
    };
  }

  const sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(cfg.apiKey);

  const msg = {
    to,
    from: { email: cfg.fromEmail, name: cfg.fromName },
    subject: 'Activa tu cuenta en TicoAutos',
    html: buildActivationHtml({
      nombre,
      activationUrl,
      ttlHours,
      logoUrl: cfg.logoUrl,
    }),
    text: `Hola ${nombre},\n\nActiva tu cuenta TicoAutos:\n${activationUrl}\n\nEste enlace vence en ${ttlHours} horas.\n\nSi no creaste esta cuenta, ignora este mensaje.`,
  };

  if (cfg.replyTo) {
    msg.replyTo = cfg.replyTo;
  }

  const sandbox = String(process.env.SENDGRID_SANDBOX_MODE || '').toLowerCase() === 'true';
  if (sandbox) {
    msg.mailSettings = { sandboxMode: { enable: true } };
    console.warn('[SendGrid] SENDGRID_SANDBOX_MODE=true — el correo no se entregará a bandejas reales (modo sandbox de SendGrid).');
  }

  try {
    await sgMail.send(msg);
    console.log(`[SendGrid] Correo de activación enviado a ${to}`);
    return { delivered: true, mode: 'live' };
  } catch (error) {
    const operatorMessage = formatSendGridErrorForOperator(error, cfg);
    console.error('[SendGrid] No se pudo enviar el correo de activación.');
    console.error('[SendGrid]', operatorMessage);
    return {
      delivered: false,
      mode: 'error',
      operatorMessage,
      userHint:
        'Tu cuenta está pendiente, pero no pudimos enviar el correo en este momento. Espera unos minutos y usa «Reenviar correo» desde la pantalla de cuenta pendiente, o revisa la carpeta de spam.',
    };
  }
};

module.exports = { sendActivationEmail, buildActivationHtml };
