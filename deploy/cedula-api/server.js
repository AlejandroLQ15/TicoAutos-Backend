/**
 * API mínima de consulta de cédulas para ejecutar en tu propio servidor.
 *
 * Contrato (compatible con TicoAutos y con apis.gometa.org/cedulas):
 *   GET /cedulas/:cedula   → JSON del padrón upstream
 *
 * Por defecto reenvía a un origen configurable (CEDULA_UPSTREAM_BASE).
 * Así el backend de TicoAutos solo habla con tu host (CEDULA_API_URL) y no
 * depende del DNS público en tiempo de ejecución; más adelante puedes
 * sustituir la lógica interna por tu propia base de datos legalmente obtenida.
 */

const express = require('express');

const PORT = parseInt(process.env.PORT || '8787', 10);
const UPSTREAM = (process.env.CEDULA_UPSTREAM_BASE || 'https://apis.gometa.org/cedulas').replace(/\/$/, '');
const UPSTREAM_TIMEOUT_MS = parseInt(process.env.CEDULA_UPSTREAM_TIMEOUT_MS || '12000', 10);

const app = express();

app.disable('x-powered-by');

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'ticoautos-cedula-api', upstream: UPSTREAM });
});

app.get('/cedulas/:cedula', async (req, res) => {
  const raw = String(req.params.cedula || '').replace(/\D/g, '');
  const cedula = raw.length >= 9 ? raw.slice(0, 9) : raw;
  if (!/^\d{9}$/.test(cedula)) {
    return res.status(400).json({ success: false, message: 'La cédula debe tener 9 dígitos.', resultcount: 0 });
  }

  const url = `${UPSTREAM}/${cedula}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'TicoAutos-Cedula-API/1.0' },
    });
    const body = await upstream.text();
    const ct = upstream.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      res.status(upstream.status).type('application/json').send(body);
    } else {
      res.status(502).json({
        success: false,
        message: 'El origen no devolvió JSON válido.',
        resultcount: 0,
      });
    }
  } catch (e) {
    const aborted = e.name === 'AbortError';
    console.error('[cedula-api]', aborted ? 'timeout' : e.message);
    res.status(503).json({
      success: false,
      message: aborted ? 'Tiempo de espera agotado al consultar el padrón.' : 'No se pudo contactar el origen de datos.',
      resultcount: 0,
    });
  } finally {
    clearTimeout(timer);
  }
});

app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Not found' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[cedula-api] escuchando en :${PORT} → upstream ${UPSTREAM}/:cedula`);
});
