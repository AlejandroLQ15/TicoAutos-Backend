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

const defaultTimeoutMs = () =>
  Math.max(3000, parseInt(process.env.CEDULA_API_TIMEOUT_MS || '12000', 10));

/**
 * @param {string} cedula9
 * @returns {Promise<{ status: number, data: object, error?: string }>}
 */
async function fetchPadronByCedula(cedula9) {
  const url = buildCedulaRequestUrl(cedula9);
  const ms = defaultTimeoutMs();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'TicoAutos-Backend/1.0' },
    });
    const data = await response.json().catch(() => ({}));
    return { status: response.status, data };
  } catch (err) {
    const aborted = err.name === 'AbortError';
    return {
      status: 0,
      data: {},
      error: aborted ? `timeout_after_${ms}ms` : err.message || 'network',
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { buildCedulaRequestUrl, fetchPadronByCedula };
