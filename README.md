# TicoAutos — Backend (REST)

Este servidor es el “cerebro” que guarda usuarios, autos y mensajes en **MongoDB** y responde a la web por **`http://localhost:3000/api`** (si no cambiás el puerto).

## Qué resuelve por vos

- **Cuentas:** registro, activación por correo (si configurás SendGrid), login y opción de **código por SMS** (Twilio).
- **Identidad:** validación de cédula contra el padrón y reglas de edad que aplicaron en el curso.
- **Autos:** publicar, listar y editar vehículos con fotos y datos.
- **Chat entre comprador y vendedor:** preguntas privadas por auto; el sistema intenta evitar teléfonos, correos o enlaces para que coordinar siga dentro del sitio.
- **Login con Google:** si cargás las credenciales en el `.env`.

Twilio, SendGrid y Google son **opcionales**: el servidor puede arrancar igual; en desarrollo el correo a veces se simula y ves el enlace en consola.

## Antes de arrancar

- **Node** 18+ (mejor 20 LTS).
- **MongoDB** local o Atlas (anotá la URI para el `.env`).

## Puesta en marcha rápida

```bash
cp .env.example .env
npm install
npm start
```

Revisá el `.env` al menos en:

| Variable | Qué cambia |
|----------|------------|
| `JWT_SECRET` o `SECRET_KEY` | Firma los tokens de sesión; tiene que ser **la misma** que uses en GraphQL si probás los dos. |
| `MONGO_URI` / `MONGODB_URI` | Dónde vive la base. |
| `FRONTEND_URL` | URL donde abrís las páginas (ej. Live Server); sirve para el **link del correo** y el **volver desde Google**. |

El resto de claves (SendGrid, Twilio, Google, OpenAI) están explicadas en comentarios dentro de `.env.example`.

## Cédulas en Docker (opcional)

Si querés el API de cédulas **corriendo en tu máquina** en lugar del público por defecto:

```bash
docker compose -f docker-compose.cedula.yml up -d --build
```

Y en `.env`: `CEDULA_API_URL=http://127.0.0.1:8787/cedulas`  
Detalle extra: `deploy/cedula-api/README.md`.

## Referencias útiles

- Diagramas y material general: carpeta **`docs/`** en la raíz del repo (un nivel arriba de esta carpeta).
- Dudas de variables: mirá los comentarios en `.env.example`.
