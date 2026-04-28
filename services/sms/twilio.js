/**
 * Servicio de envío de SMS via Twilio.
 * Si las credenciales no están configuradas, el código se simula en consola (modo desarrollo).
 *
 * Variables de entorno requeridas:
 *   TWILIO_ACCOUNT_SID  - SID de la cuenta Twilio
 *   TWILIO_AUTH_TOKEN   - Token de autenticación Twilio
 *   TWILIO_FROM_NUMBER  - Número de teléfono Twilio en formato E.164 (ej: +15005550006)
 *   MFA_CODE_TTL_MINUTES - Minutos de validez del código OTP (default 10)
 */

/**
 * Envía un código OTP por SMS.
 * @param {{ to: string, code: string }} opts - `to` en formato E.164 (ej: +50688001234)
 */
const sendSMSCode = async ({ to, code }) => {
  const ttl = process.env.MFA_CODE_TTL_MINUTES || 10;

  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.warn('[Twilio] Credenciales no configuradas — simulando envío SMS 2FA.');
    console.log('[Twilio] Para:', to);
    console.log('[Twilio] Código OTP:', code, `(válido ${ttl} min)`);
    return;
  }

  // Importación dinámica para no requerir el módulo si no hay credenciales
  const twilio = require('twilio')(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  await twilio.messages.create({
    body: `Tu código de verificación TicoAutos es: ${code}. Válido por ${ttl} minutos. No lo compartas.`,
    from: process.env.TWILIO_FROM_NUMBER,
    to
  });
};

module.exports = { sendSMSCode };
