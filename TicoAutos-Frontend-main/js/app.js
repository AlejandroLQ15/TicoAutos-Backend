// Envía un POST JSON a http://localhost:3000/api/users
// Retorna el cuerpo de la respuesta o lanza un error si algo falla.

//Función para registrar un nuevo usuario, recibe el nombre de usuario, contraseña y nombre completo.
export async function registrarUsuario(usuario, contrasena, nombre) {
  const url = 'http://localhost:3000/api/users/register';
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: usuario, password: contrasena, nombre }),
    });

    //Si la respuesta no es exitosa, intenta extraer el mensaje de error del cuerpo o usa el statusText
    if (!resp.ok) {
      const errData = await resp.json().catch(() => null);
      const msg = errData?.message || resp.statusText;
      throw new Error(`Registro fallido: ${msg}`);
    }

    //Manejo de excepciones al intentr registrar un usuario, despliega error
    return await resp.json().catch(() => null);
  } catch (er) {
    console.error('Error registrarUsuario:', er);
    throw er;
  }
}