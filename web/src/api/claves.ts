// Claves de almacenamiento compartidas. Viven aquí (y no en client.ts) para que el registro
// de analítica pueda leerlas sin crear una dependencia circular con el cliente axios.
export const TOKEN_KEY = 'si_token'
export const USUARIO_KEY = 'si_usuario'
export const APP_KEY = 'si_aplicacion'
export const CONSOLIDADO = '__todas__'
