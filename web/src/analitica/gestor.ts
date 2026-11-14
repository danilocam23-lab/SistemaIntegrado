import { crearGestorConsentimiento } from './consentimiento'

// Compartido entre UI y servicio, sin importar componentes React.
export const gestorConsentimiento = crearGestorConsentimiento({
  produccion: import.meta.env.PROD,
  obtenerAlmacenamiento: () => window.localStorage,
  ventana: window,
  documento: document,
  recargar: () => window.location.reload(),
  registrarError: mensaje => console.error(mensaje),
})
