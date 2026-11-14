// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

export const CLAVE_CONSENTIMIENTO = 'hitss.consentimiento-analitica'
const VERSION_CONSENTIMIENTO = 1
const ID_CONTENEDOR = 'GTM-W86DRFZ3'

/*
 * Integración GTM (documentación junto al bootstrap: no existe README en web).
 * Solo builds de producción, incluido npm run preview del build; nunca npm run dev.
 * Bootstrap clásico soportado por Google, adaptado a consentimiento previo.
 * El snippet actual de Google con gtag('js', ...) también es válido; no aporta
 * por sí solo un G-ID ni acredita la configuración de una propiedad GA4.
 *
 * Contenedor confirmado: GTM-W86DRFZ3. Publicación constatada por el operador
 * con tags=[] y rules=[]; G-ID y configuración GA4 pendientes fuera del repo.
 * Antes de publicar para este sistema interno, el administrador debe:
 * - Revisar las etiquetas existentes; si falta GA4, obtener el G-ID real del flujo
 *   web en GA4 y configurar la etiqueta de Google/GA4 dentro de GTM, no en React.
 * - No enviar datos personales, financieros, identidad, aplicación ni campos o
 *   contenido de negocio. Anonimizar page_location, page_referrer y las rutas
 *   dinámicas (incluidos IDs, query y hash) ANTES de cualquier envío de etiquetas.
 * - Desactivar/revisar la recogida automática de formularios y clics.
 * - React es el único emisor SPA: app_page_view se mapea a page_view en GTM.
 *   Desactivar vistas iniciales/automáticas, History Change y medición automática
 *   de clics/formularios. No añadir gtag config ni un segundo bootstrap.
 * - Validar consentimiento y etiquetas con Tag Assistant y DebugView. Pendiente:
 *   requiere acceso del usuario a Google; las pruebas locales interceptan el script.
 *
 * Decisión versionada en localStorage, sin selección por defecto. Solo aceptar
 * permite cargar; fallo de almacenamiento no concede permiso. Tras aceptar o
 * rechazar, el aviso ofrece cambiar preferencias. Retirar guarda el rechazo y
 * recarga la URL actual: quitar un script no apaga etiquetas ya ejecutadas.
 * No hay consent mode avanzado, pings previos ni iframe/noscript de GTM.
 * Las cookies GA4 existentes NO se borran automáticamente. No puede garantizarse
 * la privacidad de etiquetas administradas externamente ni visitas registradas.
 * referrerPolicy protege solo la descarga del bootstrap, no las etiquetas.
 *
 * Verificación local desde web (sin paquetes nuevos):
 * npx tsc --noEmit
 * npm run build
 * node scripts/probar-consentimiento.mjs
 */

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>
  }
}

export type DecisionConsentimiento = 'aceptado' | 'rechazado'
export interface EstadoConsentimiento {
  decision: DecisionConsentimiento | null
  carga: 'sin-cargar' | 'cargando' | 'cargado' | 'error'
  error: string | null
}

interface EntornoConsentimiento {
  produccion: boolean
  obtenerAlmacenamiento: () => Pick<Storage, 'getItem' | 'setItem'>
  ventana: Pick<Window, 'dataLayer'>
  documento: Pick<Document, 'createElement' | 'head'>
  recargar: () => void
  registrarError: (mensaje: string) => void
}

// Una instancia por documento, independiente de efectos/remontajes de React.
export function crearGestorConsentimiento(entorno: EntornoConsentimiento) {
  let iniciado = false
  let intentoCarga = false
  let estado: EstadoConsentimiento = {
    decision: null,
    carga: 'sin-cargar',
    error: null,
  }
  const oyentes = new Set<() => void>()

  function actualizar(cambios: Partial<EstadoConsentimiento>) {
    estado = { ...estado, ...cambios }
    oyentes.forEach(oyente => oyente())
  }

  function informarError(mensaje: string) {
    entorno.registrarError(mensaje)
    actualizar({ error: mensaje })
  }

  function cargar() {
    if (!entorno.produccion || estado.decision !== 'aceptado' || intentoCarga) return
    intentoCarga = true
    actualizar({ carga: 'cargando' })
    try {
      entorno.ventana.dataLayer ??= []
      entorno.ventana.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' })
      const script = entorno.documento.createElement('script')
      script.async = true
      script.referrerPolicy = 'no-referrer'
      script.src = `https://www.googletagmanager.com/gtm.js?id=${ID_CONTENEDOR}`
      script.onload = () => actualizar({ carga: 'cargado' })
      script.onerror = () => {
        actualizar({ carga: 'error' })
        informarError('No se pudo cargar Google Tag Manager. Puede seguir usando el sistema.')
      }
      entorno.documento.head.appendChild(script)
    } catch {
      actualizar({ carga: 'error' })
      informarError('No se pudo iniciar Google Tag Manager. Puede seguir usando el sistema.')
    }
  }

  function iniciar() {
    if (iniciado || !entorno.produccion) return
    iniciado = true
    try {
      const guardado = entorno.obtenerAlmacenamiento().getItem(CLAVE_CONSENTIMIENTO)
      if (guardado !== null) {
        const datos: unknown = JSON.parse(guardado)
        if (
          typeof datos !== 'object' || datos === null ||
          !('version' in datos) || datos.version !== VERSION_CONSENTIMIENTO ||
          !('decision' in datos) ||
          (datos.decision !== 'aceptado' && datos.decision !== 'rechazado')
        ) {
          informarError('La preferencia guardada no es válida o ha caducado. Elija de nuevo; no se ha cargado Google Tag Manager.')
          return
        }
        actualizar({ decision: datos.decision })
      }
    } catch {
      informarError('No se pudo leer la preferencia de analítica. No se ha cargado Google Tag Manager; puede seguir usando el sistema.')
      return
    }
    cargar()
  }

  function decidir(decision: DecisionConsentimiento): boolean {
    if (!entorno.produccion) return false
    try {
      entorno.obtenerAlmacenamiento().setItem(
        CLAVE_CONSENTIMIENTO,
        JSON.stringify({ version: VERSION_CONSENTIMIENTO, decision }),
      )
    } catch {
      informarError(
        intentoCarga
          ? 'No se pudo guardar la preferencia. Las etiquetas ya iniciadas pueden seguir activas; para detener esta sesión cierre esta página.'
          : 'No se pudo guardar la preferencia. No se ha cargado Google Tag Manager; puede seguir usando el sistema.',
      )
      return false
    }
    actualizar({ decision, error: estado.carga === 'error' ? estado.error : null })
    if (decision === 'rechazado' && intentoCarga) {
      // Quitar el script no detiene las etiquetas que ya se ejecutaron.
      try {
        entorno.recargar()
      } catch {
        informarError('Preferencia de rechazo guardada, pero no se pudo recargar. Recargue o cierre esta página para detener las etiquetas ya iniciadas.')
      }
    } else {
      cargar()
    }
    return true
  }

  return {
    iniciar,
    decidir,
    obtenerEstado: () => estado,
    suscribir(oyente: () => void) {
      oyentes.add(oyente)
      return () => { oyentes.delete(oyente) }
    },
  }
}
