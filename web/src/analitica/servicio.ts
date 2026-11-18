import {
  buscarControl, buscarPantalla, esFormulario, esOperacionCatalogada, EXPORTACIONES,
} from './catalogo'
import type { IdExportacion, IdFormulario, OperacionCatalogada } from './catalogo'
import type { DecisionConsentimiento } from './consentimiento'
import type { EventoUso } from './registro'

export interface IdentidadAnalitica {
  id_analitico?: string | null
  rol?: string | null
}

type Resultado = 'attempt' | 'success' | 'failure' | 'cancelled'
type TipoError = 'red' | 'autenticacion' | 'autorizacion' | 'validacion' | 'servidor' | 'http' | 'cancelacion'
export const EVENTOS = ['app_page_view', 'app_interaction', 'app_session', 'app_operation',
  'app_error', 'app_form', 'app_screen_engagement', 'app_export'] as const
type Evento = typeof EVENTOS[number]

// Cada push limpia TODOS los campos opcionales para evitar herencia en el modelo GTM.
export const CAMPOS = [
  'environment', 'app_version', 'timestamp_ms', 'user_id', 'user_role', 'role_group',
  'module', 'screen', 'route_template', 'page_location', 'page_referrer',
  'interaction_id', 'interaction_type', 'action_name', 'outcome', 'resource_type',
  'operation_id', 'status_code', 'error_type', 'form_id', 'elapsed_ms', 'export_id',
] as const
type CamposEvento = Partial<Record<typeof CAMPOS[number], string | number | null>>
export type AccionSesion = 'session_start' | 'session_end' | 'session_expired' | 'login_failed'

// Eventos que alimentan también el registro propio (auditoría interna). app_operation y
// app_error quedan fuera: el backend ya audita las operaciones por su cuenta.
const EVENTOS_PROPIOS: readonly string[] = ['app_page_view', 'app_interaction', 'app_screen_engagement',
  'app_session', 'app_export', 'app_form']
const DURACION_MAXIMA_MS = 86_400_000
const VALOR_USO =/^[a-z0-9_.:-]{1,80}$/
const valorUso = (valor: unknown) => typeof valor === 'string' && VALOR_USO.test(valor) ? valor : undefined

// Proyección mínima y saneada del evento para el registro propio: sin URLs, IDs ni valores.
// export_id / form_id viajan como interaction_id (el contrato no tiene campo propio).
export function aEventoUso(datos: Record<string, string | number | null>): EventoUso | null {
  const momento = typeof datos.timestamp_ms === 'number' ? new Date(datos.timestamp_ms) : null
  if (!momento || Number.isNaN(momento.getTime()) || typeof datos.event !== 'string') return null
  const esExport = datos.event === 'app_export'
  const esFormulario = datos.event === 'app_form'
  const interaccion = valorUso(esExport ? datos.export_id : esFormulario ? datos.form_id : datos.interaction_id)
  if (datos.event === 'app_interaction' && !interaccion) return null
  const accion = esExport && datos.outcome === 'failure' ? 'exportar_fallida' : datos.action_name
  const evento: EventoUso = { event: datos.event, ts: momento.toISOString() }
  const pantalla = valorUso(datos.screen)
  const modulo = valorUso(datos.module)
  const nombreAccion = valorUso(accion)
  if (pantalla) evento.screen = pantalla
  if (modulo) evento.module = modulo
  if (interaccion) evento.interaction_id = interaccion
  if (nombreAccion) evento.action_name = nombreAccion
  // La duración de la participación viaja como campo propio, entero y acotado a 24 h.
  if (datos.event === 'app_screen_engagement' && typeof datos.elapsed_ms === 'number' &&
    Number.isFinite(datos.elapsed_ms)) {
    evento.duracion_ms = Math.min(DURACION_MAXIMA_MS, Math.max(0, Math.round(datos.elapsed_ms)))
  }
  return evento
}

// Id corto y único por evento (sin PII), solo alfanumérico y de máximo 32 caracteres.
function idEvento(generar: () => string): string | undefined {
  try {
    const id = generar().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 32)
    return id || undefined
  } catch { return undefined }
}

interface Entorno {
  produccion: boolean
  version: string
  base: string
  origen: string
  referenteInicial: string
  ahora: () => number
  reloj: () => number
  aleatorio: () => string
  visible: () => boolean
  /** Canal de dataLayer/Google: solo con consentimiento y en producción. */
  enviar: (datos: Record<string, string | number | null>) => void
  /** Registro propio (auditoría interna): obligatorio en producción, sin consentimiento. */
  registrar?: (evento: EventoUso) => void
  obtenerIdentidad: () => IdentidadAnalitica | null
}

interface FormularioActivo {
  id: IdFormulario
  inicio: number
}
interface OperacionActiva {
  catalogo: OperacionCatalogada
  inicio: number
  generacion: number
  contexto: CamposEvento
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function sanitizarIdentidad(identidad: IdentidadAnalitica | null): CamposEvento {
  const rol = identidad?.rol
  const id = identidad?.id_analitico
  const seguro = rol === 'superadmin' || rol === 'admin_app' || rol === 'viewer'
  return {
    user_id: typeof id === 'string' && UUID.test(id) ? id.toLowerCase() : null,
    user_role: identidad ? (seguro ? rol : 'personalizada') : null,
    role_group: identidad ? (rol === 'superadmin' || rol === 'admin_app' ? 'administracion' : rol === 'viewer' ? 'consulta' : 'personalizado') : null,
  }
}

export function categorizarError(estado?: number, cancelado = false): TipoError {
  if (cancelado) return 'cancelacion'
  if (!estado) return 'red'
  if (estado === 401) return 'autenticacion'
  if (estado === 403) return 'autorizacion'
  if (estado === 400 || estado === 422) return 'validacion'
  return estado >= 500 ? 'servidor' : 'http'
}

// Fábrica pura e inyectable: pruebas sin Google, React, almacenamiento ni reloj real.
export function crearServicioAnalitica(entorno: Entorno) {
  let permitido = false
  let sesionActiva = false
  // El registro propio no depende del consentimiento; solo existe en producción.
  const propio = entorno.produccion && typeof entorno.registrar === 'function'
  const activo = () => permitido || propio
  let rutaActual = ''
  let rutaVista = ''
  let identidad: CamposEvento = {}
  let generacion = 0
  let tiempoActivo = 0
  let inicioVisible: number | null = null
  let referente = ''
  const formularios = new Map<object, FormularioActivo>()
  const operaciones = new Map<string, OperacionActiva>()
  const base = `/${entorno.base.split('/').filter(Boolean).join('/')}${entorno.base === '/' ? '' : '/'}`
  // Solo el origen del referente inicial. Nunca ruta, usuario URL, query o hash.
  try {
    const url = new URL(entorno.referenteInicial)
    if (url.protocol === 'https:' || url.protocol === 'http:') referente = url.origin
  } catch { /* Referente ausente o inválido. */ }

  const pantallaActual = () => rutaActual === '' ? undefined : buscarPantalla(rutaActual)

  function contexto(): CamposEvento {
    const pantalla = pantallaActual()
    return pantalla ? {
      module: pantalla[2], screen: pantalla[1], route_template: pantalla[0],
      page_location: `${entorno.origen}${base}${pantalla[0].slice(1)}`,
      page_referrer: referente,
    } : {}
  }

  function pantallaMedible() {
    const pantalla = pantallaActual()
    return pantalla && (pantalla[2] === 'sesion' || typeof identidad.user_role === 'string')
  }

  function emitir(evento: Evento, campos: CamposEvento = {}, soloDataLayer = false) {
    if (!activo() || !pantallaMedible()) return
    const datos: Record<string, string | number | null> = { event: evento }
    for (const campo of CAMPOS) datos[campo] = null
    const seleccionados = { ...contexto(), ...identidad,
      environment: 'production', app_version: entorno.version, timestamp_ms: entorno.ahora(),
      ...campos,
    }
    for (const campo of CAMPOS) datos[campo] = seleccionados[campo] ?? null
    // La analítica no puede romper una operación de la aplicación.
    if (permitido) {
      try { entorno.enviar(datos) } catch {
        console.error('No se pudo registrar el evento de analítica; la operación del sistema continúa.')
      }
    }
    // Solo sesiones autenticadas: el backend atribuye el evento al usuario del token.
    if (propio && !soloDataLayer && EVENTOS_PROPIOS.includes(evento) && typeof identidad.user_role === 'string') {
      try {
        const registro = aEventoUso(datos)
        if (registro) {
          const id = idEvento(entorno.aleatorio)
          entorno.registrar?.(id ? { id, ...registro } : registro)
        }
      } catch {
        console.error('No se pudo registrar el evento de uso; la operación del sistema continúa.')
      }
    }
  }

  function limpiarDatos(contextoIdentidad: CamposEvento = {}) {
    const datos: Record<string, string | number | null> = {}
    for (const campo of CAMPOS) datos[campo] = null
    datos.user_id = contextoIdentidad.user_id ?? null
    datos.user_role = contextoIdentidad.user_role ?? null
    datos.role_group = contextoIdentidad.role_group ?? null
    try { entorno.enviar(datos) } catch {
      console.error('No se pudo actualizar el contexto de analítica.')
    }
  }

  function reiniciarMediciones() {
    generacion++
    operaciones.clear()
    formularios.clear()
    tiempoActivo = 0
    inicioVisible = activo() && entorno.visible() ? entorno.reloj() : null
  }

  function asegurarVista() {
    if (!activo() || rutaVista === rutaActual || !pantallaMedible()) return
    rutaVista = rutaActual
    emitir('app_page_view')
    tiempoActivo = 0
    inicioVisible = entorno.visible() ? entorno.reloj() : null
  }

  function acumular() {
    if (inicioVisible !== null) tiempoActivo += Math.max(0, entorno.reloj() - inicioVisible)
    inicioVisible = null
  }

  function cerrarPantalla() {
    acumular()
    if (tiempoActivo > 0) {
      emitir('app_screen_engagement', { elapsed_ms: Math.round(tiempoActivo) })
      tiempoActivo = 0
    }
    for (const [elemento] of formularios) finalizarFormulario(elemento, 'abandoned')
  }

  function actualizarIdentidad(actual: IdentidadAnalitica | null) {
    const siguiente = sanitizarIdentidad(actual)
    if (siguiente.user_id === identidad.user_id && siguiente.user_role === identidad.user_role &&
      siguiente.role_group === identidad.role_group) return
    // No contar cambio de objeto / polling como login o nueva vista.
    reiniciarMediciones()
    sesionActiva = false
    identidad = activo() ? siguiente : {}
    if (activo()) {
      if (permitido) limpiarDatos(identidad)
      asegurarVista()
    }
  }

  function consentimiento(decision: DecisionConsentimiento | null) {
    const siguiente = entorno.produccion && decision === 'aceptado'
    if (siguiente === permitido) return
    permitido = siguiente
    if (propio) {
      // El registro propio sigue su curso sin reiniciar mediciones: solo se (des)activa dataLayer.
      if (siguiente) {
        limpiarDatos(identidad)
        emitir('app_page_view', {}, true)
      } else limpiarDatos()
      return
    }
    identidad = siguiente ? sanitizarIdentidad(entorno.obtenerIdentidad()) : {}
    reiniciarMediciones()
    rutaVista = ''
    if (siguiente) asegurarVista()
    else limpiarDatos()
  }

  function navegar(ruta: string) {
    const limpia = ruta.split(/[?#]/, 1)[0]
    if (limpia === rutaActual) { asegurarVista(); return }
    const ubicacionAnterior = String(contexto().page_location ?? '')
    cerrarPantalla()
    referente = ubicacionAnterior || referente
    rutaActual = limpia
    rutaVista = ''
    asegurarVista()
  }

  function interaccion(id: string, tipoEvento: 'click' | 'change' | 'input') {
    const control = buscarControl(id)
    if (!control) return
    const esCambio = control[1] === 'filtro'
    const esBusqueda = control[1] === 'busqueda'
    const cambioEnCampo = esCambio && !['abrir', 'seleccionar_todos', 'limpiar'].includes(control[0])
    if ((esBusqueda && tipoEvento !== 'input') || (cambioEnCampo && tipoEvento !== 'change') ||
      (esCambio && !cambioEnCampo && tipoEvento !== 'click') ||
      (!esBusqueda && !esCambio && tipoEvento !== 'click')) return
    asegurarVista()
    emitir('app_interaction', { interaction_id: id, action_name: control[0], interaction_type: control[1] })
  }

  function iniciarOperacion(catalogo: OperacionCatalogada): string | null {
    if (!permitido || !pantallaMedible() || !esOperacionCatalogada(catalogo)) return null
    asegurarVista()
    let id: string
    try { id = entorno.aleatorio() } catch {
      console.error('No se pudo iniciar la correlación analítica de la operación.')
      return null
    }
    operaciones.set(id, { catalogo, inicio: entorno.reloj(), generacion, contexto: contexto() })
    emitir('app_operation', { ...catalogo, outcome: 'attempt', operation_id: id })
    return id
  }

  function terminarOperacion(id: string | null, estado?: number, cancelado = false) {
    if (!id) return
    const operacion = operaciones.get(id)
    operaciones.delete(id)
    if (!operacion || !permitido || operacion.generacion !== generacion) return
    const estadoSeguro = estado !== undefined && Number.isInteger(estado) && estado >= 100 && estado <= 599 ? estado : null
    const resultado: Resultado = cancelado ? 'cancelled' : estadoSeguro !== null && estadoSeguro >= 200 && estadoSeguro < 300 ? 'success' : 'failure'
    const campos = { ...operacion.contexto, ...operacion.catalogo, operation_id: id,
      outcome: resultado, status_code: estadoSeguro, elapsed_ms: Math.round(Math.max(0, entorno.reloj() - operacion.inicio)) }
    emitir('app_operation', campos)
    if (resultado === 'failure' || resultado === 'cancelled') {
      emitir('app_error', { ...campos, error_type: categorizarError(estadoSeguro ?? undefined, cancelado) })
    }
  }

  function iniciarFormulario(elemento: object, id: string) {
    if (!activo() || !pantallaMedible() || !esFormulario(id) || formularios.has(elemento)) return
    asegurarVista()
    formularios.set(elemento, { id, inicio: entorno.reloj() })
    emitir('app_form', { form_id: id, action_name: 'start' })
  }

  function finalizarFormulario(elemento: object, accion: 'submitted' | 'abandoned' | 'cancelled') {
    const formulario = formularios.get(elemento)
    formularios.delete(elemento)
    if (!formulario) return
    emitir('app_form', { form_id: formulario.id, action_name: accion,
      elapsed_ms: Math.round(Math.max(0, entorno.reloj() - formulario.inicio)) })
  }

  function prepararEnvioFormulario(id: IdFormulario) {
    const generacionEnvio = generacion
    const actuales = Array.from(formularios).filter(([, formulario]) => formulario.id === id)
    return () => {
      if (generacion !== generacionEnvio) return
      for (const [elemento, formulario] of actuales) {
        if (formularios.get(elemento) === formulario) finalizarFormulario(elemento, 'submitted')
      }

    }
  }

  function abandonarFormulario(id: IdFormulario) {
    for (const [elemento, formulario] of formularios) {
      if (formulario.id === id) finalizarFormulario(elemento, 'abandoned')
    }
  }

  function exportacion(id: IdExportacion, resultado: 'success' | 'failure' = 'success') {
    if (!EXPORTACIONES.includes(id)) return
    asegurarVista()
    emitir('app_export', { export_id: id, action_name: 'exportar', outcome: resultado })
  }

  function salir() {
    cerrarPantalla()
    if (!sesionActiva) return
    sesionActiva = false
    emitir('app_session', { action_name: 'session_end', outcome: 'success' })
  }

  return {
    consentimiento, navegar, actualizarIdentidad, interaccion, iniciarOperacion, terminarOperacion,
    habilitado: activo,
    iniciarFormulario, finalizarFormulario, prepararEnvioFormulario, abandonarFormulario,
    formulariosActivos: () => Array.from(formularios.keys()),
    // session_start es idempotente por identidad (login y restauración tras recargar);
    // session_end / session_expired solo cuentan si había una sesión iniciada.
    sesion(accion: AccionSesion) {
      const cierra = accion === 'session_end' || accion === 'session_expired'
      if (accion === 'session_start') {
        if (sesionActiva) return
        sesionActiva = true
      } else if (cierra) {
        if (!sesionActiva) return
        sesionActiva = false
      }
      asegurarVista()
      emitir('app_session', { action_name: accion,
        outcome: accion === 'session_start' || accion === 'session_end' ? 'success' : 'failure' })
      if (cierra) {
        identidad = {}
        reiniciarMediciones()
        if (permitido) limpiarDatos()
      }
    },
    exportacion,
    // Ejecuta la descarga y registra su resultado real; relanza el error original.
    exportar<T>(id: IdExportacion, descarga: () => T): T {
      let resultado: T
      try { resultado = descarga() } catch (error) {
        exportacion(id, 'failure')
        throw error
      }
      exportacion(id, 'success')
      return resultado
    },
    visibilidad() {
      if (!activo()) return
      acumular()
      if (entorno.visible()) inicioVisible = entorno.reloj()
    },
    salir,
  }
}

export type ServicioAnalitica = ReturnType<typeof crearServicioAnalitica>
