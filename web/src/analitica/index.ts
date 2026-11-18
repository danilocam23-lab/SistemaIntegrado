import paquete from '../../package.json'
import { gestorConsentimiento } from './gestor'
import { crearServicioAnalitica } from './servicio'
import type { IdentidadAnalitica } from './servicio'
import { instalarDelegacion } from './delegacion'
import { quitarBaseAnalitica } from './catalogo'
import { crearRegistroUso } from './registro'
import { APP_KEY, TOKEN_KEY } from '../api/claves'

// Registro propio de uso (auditoría interna): obligatorio, independiente del consentimiento.
// Usa fetch directo (no axios) para poder enviar con keepalive y no pasar por el interceptor 401.
const URL_EVENTOS_USO = `${import.meta.env.BASE_URL}api/auditoria/eventos-uso`
// Huella FNV-1a (no criptográfica, irreversible a efectos prácticos) para distinguir tokens
// sin conservarlos. Con el id analítico (UUID seudónimo) forma la clave de sesión de la cola.
function huella(texto: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < texto.length; i++) { h ^= texto.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return (h >>> 0).toString(16)
}
function claveSesion(): string | null {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) return null
  return `${identidadActual?.id_analitico ?? ''}.${huella(token)}`
}

const registroUso = crearRegistroUso({
  aplicacionActual: () => localStorage.getItem(APP_KEY) || null,
  sesionActual: claveSesion,
  programar: (accion, ms) => window.setTimeout(accion, ms),
  cancelar: id => window.clearTimeout(id as number),
  enviar: async (eventos, keepalive, aplicacion) => {
    const token = localStorage.getItem(TOKEN_KEY)
    const cabeceras: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) cabeceras.Authorization = `Bearer ${token}`
    if (aplicacion) cabeceras['X-Aplicacion'] = aplicacion
    const respuesta = await fetch(URL_EVENTOS_USO, {
      method: 'POST', headers: cabeceras, body: JSON.stringify({ eventos }), keepalive,
    })
    return respuesta.status
  },
})

/** Envía de inmediato lo pendiente (login, logout, cambio de aplicación, descarga de página)
 * con el token vigente; cada grupo de aplicación va con su propia cabecera X-Aplicacion. */
export function vaciarRegistroUso() { void registroUso.vaciar(true) }

// Solo AuthContext escribe esta identidad procedente de /auth; no leer si_usuario.
let identidadActual: IdentidadAnalitica | null = null
export const analitica = crearServicioAnalitica({
  produccion: import.meta.env.PROD,
  version: paquete.version,
  base: import.meta.env.BASE_URL,
  origen: window.location.origin,
  referenteInicial: document.referrer,
  ahora: () => Date.now(),
  reloj: () => performance.now(),
  aleatorio: () => {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
    // Correlación efímera, también en HTTP; nunca se usa como user_id.
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  },
  visible: () => document.visibilityState === 'visible',
  obtenerIdentidad: () => identidadActual,
  enviar: datos => { window.dataLayer ??= []; window.dataLayer.push(datos) },
  registrar: evento => registroUso.agregar(evento),
})

let delegacion: ReturnType<typeof instalarDelegacion> | null = null
let iniciado = false
let rutaRegistrada = false

export function iniciarAnalitica() {
  if (iniciado || !import.meta.env.PROD) return
  iniciado = true
  // El aviso se monta antes que el router: preparar la ruta antes del bootstrap.
  if (!rutaRegistrada) analitica.navegar(quitarBaseAnalitica(window.location.pathname, import.meta.env.BASE_URL))
  try {
    delegacion = instalarDelegacion(analitica, document, window)
  } catch {
    // Un navegador sin las APIs requeridas no debe impedir usar la aplicación.
    console.error('No se pudo iniciar el seguimiento de interacciones de analítica.')
    delegacion = null
  }
  // Se registra DESPUÉS de la delegación: en pagehide, session_end y la última
  // participación ya están en cola cuando se vacía.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') vaciarRegistroUso()
  })
  window.addEventListener('pagehide', vaciarRegistroUso)
  gestorConsentimiento.suscribir(() => {
    const decision = gestorConsentimiento.obtenerEstado().decision
    if (decision !== 'aceptado') delegacion?.vaciarBusquedas()
    analitica.consentimiento(decision)
  })
  analitica.consentimiento(gestorConsentimiento.obtenerEstado().decision)
  gestorConsentimiento.iniciar()
}

export function establecerIdentidadAnalitica(identidad: IdentidadAnalitica | null) {
  // No retener el DTO completo (contiene PII, aplicaciones y permisos).
  const siguiente = identidad ? { id_analitico: identidad.id_analitico, rol: identidad.rol } : null
  if (!siguiente || siguiente.id_analitico !== identidadActual?.id_analitico || siguiente.rol !== identidadActual?.rol) {
    delegacion?.vaciarBusquedas()
  }
  identidadActual = siguiente
  analitica.actualizarIdentidad(siguiente)
}

export function registrarRutaAnalitica(ruta: string) {
  rutaRegistrada = true
  delegacion?.vaciarBusquedas()
  analitica.navegar(ruta)
  iniciarAnalitica()
}
