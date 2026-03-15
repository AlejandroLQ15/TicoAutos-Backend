# TicoAutos-Frontend

Frontend del proyecto TicoAutos para el curso ISW-711.

## Flujo de acceso actual (primer avance)

- La primera pantalla es el login (`pages/login.html`).
- Si el usuario no tiene cuenta, debe registrarse en `pages/registro.html`.
- Solo después de iniciar sesión se permite entrar a la página principal (`index.html`) y al registro de vehículos (`pages/vehiculos.html`).

## Integración con backend

La aplicación consume endpoints en `http://localhost:3000/api`:

- `POST /users/register`
- `POST /users/login`
- `GET /autos`
- `POST /autos`

## Ejecución

- Levanta el backend en `http://localhost:3000`.
- Abre `pages/login.html` en el navegador para iniciar el flujo.
