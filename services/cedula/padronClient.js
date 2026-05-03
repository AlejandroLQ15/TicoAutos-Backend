/**
 * Cliente HTTP al servicio de consulta de cédulas (padrón / tercero).
 * Centraliza la URL y el fetch para no duplicar lógica en controladores.
 *
 * @module services/cedula/padronClient
 */

/**
 * Construye la URL final GET para una cédula de 9 dígitos.
 * Soporta:
 * - Base simple: https://host/cedulas + /{cedula}
 * - Plantilla: https://host/cedulas/{numero} o {cedula}
 *
 * @param {string} cedula9
 * @returns {string}
 */
function buildCedulaRequestUrl(cedula9) {
  const raw = (process.env.CEDULA_API_URL || 'https://apis.gometa.org/cedulas').trim();
  if (/\{(cedula|numero)\}/i.test(raw)) {
    return raw.replace(/\{cedula\}/gi, cedula9).replace(/\{numero\}/gi, cedula9);
  }
  return `${raw.replace(/\/$/, '')}/${cedula9}`;
}

/**
 * @param {string} cedula9
 * @returns {Promise<{ status: number, data: object, error?: string }>}
 */
async function fetchPadronByCedula(cedula9) {
  const url = buildCedulaRequestUrl(cedula9);
  try {
    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));
    return { status: response.status, data };
  } catch (err) {
    return { status: 0, data: {}, error: err.message || 'network' };
  }
}

module.exports = { buildCedulaRequestUrl, fetchPadronByCedula };
