# API de cédulas (sidecar)

Servicio HTTP mínimo con el mismo contrato que `https://apis.gometa.org/cedulas/:cedula`, pensado para **correr en tu infraestructura**. El backend TicoAutos solo necesita apuntar `CEDULA_API_URL` aquí.

## Qué hace hoy

- `GET /cedulas/:numero` reenvía la petición a `CEDULA_UPSTREAM_BASE` (por defecto gometa) y devuelve el mismo JSON.
- Así centralizas timeouts, logs y, si más adelante sustituyes el upstream por **tu propia base** (con datos que puedas usar legalmente), el resto de TicoAutos no cambia.

## Docker (recomendado)

Desde la carpeta `TicoAutos-Backend-main`:

```bash
docker compose -f docker-compose.cedula.yml up -d --build
```

En el `.env` del backend:

```env
CEDULA_API_URL=http://127.0.0.1:8787/cedulas
```

## Sin Docker

```bash
cd deploy/cedula-api
cp .env.example .env   # opcional: ajusta PORT o CEDULA_UPSTREAM_BASE
npm install
npm start
```

## Variables

| Variable | Descripción |
|----------|-------------|
| `PORT` | Puerto local (default `8787`) |
| `CEDULA_UPSTREAM_BASE` | URL base del JSON compatible (sin `/` final) |
| `CEDULA_UPSTREAM_TIMEOUT_MS` | Timeout al origen (default `12000`) |

## Salud

`GET /health` devuelve `ok` y la URL de upstream configurada.
