import paquete from '../../package.json'
import { gestorConsentimiento } from './gestor'
import { crearServicioAnalitica } from './servicio'
import type { IdentidadAnalitica } from './servicio'
import { instalarDelegacion } from './delegacion'
import { quitarBaseAnalitica } from './catalogo'

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
