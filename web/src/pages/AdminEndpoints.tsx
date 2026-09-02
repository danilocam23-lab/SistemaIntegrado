import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import client from '../api/client'
import { mensajeError, useLista } from '../api/hooks'
import type { Aplicacion, EndpointAdmin } from '../types'

const HEADER_CONSOLIDADO = { headers: { 'X-Aplicacion': '__todas__' } }

type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface EndpointDoc {
  modulo: string
  metodo: Metodo
  ruta: string
  descripcion: string
  parametros?: string
  cuerpo?: string
  permisos?: string
}

const ENDPOINTS: EndpointDoc[] = [
  { modulo: 'Sistema', metodo: 'GET', ruta: '/api/health', descripcion: 'Verifica disponibilidad de la API.' },
  { modulo: 'Autenticación', metodo: 'POST', ruta: '/api/auth/login', descripcion: 'Autentica usuario y entrega JWT.', cuerpo: 'email, password' },
  { modulo: 'Autenticación', metodo: 'GET', ruta: '/api/auth/me', descripcion: 'Devuelve el usuario autenticado.' },

  { modulo: 'Aplicaciones', metodo: 'GET', ruta: '/api/aplicaciones', descripcion: 'Lista aplicaciones registradas.' },
  { modulo: 'Aplicaciones', metodo: 'POST', ruta: '/api/aplicaciones', descripcion: 'Crea una aplicación.', cuerpo: 'codigo, nombre, descripcion' },
  { modulo: 'Aplicaciones', metodo: 'PUT', ruta: '/api/aplicaciones/{codigo}', descripcion: 'Actualiza una aplicación.' },
  { modulo: 'Aplicaciones', metodo: 'PATCH', ruta: '/api/aplicaciones/{codigo}/estado', descripcion: 'Activa o desactiva una aplicación.', cuerpo: 'activa' },
  { modulo: 'Aplicaciones', metodo: 'GET', ruta: '/api/aplicaciones/{codigo}/usuarios', descripcion: 'Lista usuarios asociados a una aplicación.' },
  { modulo: 'Aplicaciones', metodo: 'POST', ruta: '/api/aplicaciones/{codigo}/usuarios/{usuario_id}', descripcion: 'Asocia un usuario a una aplicación.' },
  { modulo: 'Aplicaciones', metodo: 'DELETE', ruta: '/api/aplicaciones/{codigo}/usuarios/{usuario_id}', descripcion: 'Quita un usuario de una aplicación.' },

  { modulo: 'Usuarios y roles', metodo: 'GET', ruta: '/api/usuarios', descripcion: 'Lista usuarios.' },
  { modulo: 'Usuarios y roles', metodo: 'POST', ruta: '/api/usuarios', descripcion: 'Crea un usuario.', cuerpo: 'nombre, email, password, rol_id, aplicaciones' },
  { modulo: 'Usuarios y roles', metodo: 'PUT', ruta: '/api/usuarios/{usuario_id}', descripcion: 'Actualiza usuario, rol o estado.' },
  { modulo: 'Usuarios y roles', metodo: 'PATCH', ruta: '/api/usuarios/{usuario_id}/password', descripcion: 'Cambia contraseña de usuario.', cuerpo: 'password' },
  { modulo: 'Usuarios y roles', metodo: 'GET', ruta: '/api/roles/catalogo', descripcion: 'Lista permisos disponibles.' },
  { modulo: 'Usuarios y roles', metodo: 'GET', ruta: '/api/roles', descripcion: 'Lista roles.' },
  { modulo: 'Usuarios y roles', metodo: 'POST', ruta: '/api/roles', descripcion: 'Crea rol.', cuerpo: 'nombre, descripcion, permisos' },
  { modulo: 'Usuarios y roles', metodo: 'PUT', ruta: '/api/roles/{rol_id}', descripcion: 'Actualiza rol.' },
  { modulo: 'Usuarios y roles', metodo: 'DELETE', ruta: '/api/roles/{rol_id}', descripcion: 'Elimina rol.' },

  { modulo: 'Requerimientos', metodo: 'GET', ruta: '/api/requerimientos', descripcion: 'Lista requerimientos de la aplicación activa o consolidado.', parametros: 'estado opcional' },
  { modulo: 'Requerimientos', metodo: 'POST', ruta: '/api/requerimientos', descripcion: 'Crea requerimiento.', cuerpo: 'RequerimientoIn', permisos: 'requerimientos.crear' },
  { modulo: 'Requerimientos', metodo: 'GET', ruta: '/api/requerimientos/{codigo_req}', descripcion: 'Obtiene requerimiento por id o código REQ.' },
  { modulo: 'Requerimientos', metodo: 'PUT', ruta: '/api/requerimientos/{codigo_req}', descripcion: 'Actualiza campos del requerimiento.', cuerpo: 'RequerimientoUpdate', permisos: 'requerimientos.editar' },
  { modulo: 'Requerimientos', metodo: 'DELETE', ruta: '/api/requerimientos/{codigo_req}', descripcion: 'Elimina requerimiento y estimaciones asociadas.', permisos: 'requerimientos.eliminar' },
  { modulo: 'Requerimientos', metodo: 'POST', ruta: '/api/requerimientos/ans/calcular', descripcion: 'Calcula resultado ANS entre fechas.', cuerpo: 'fecha_inicio, fecha_fin, umbral_dias_habiles' },
  { modulo: 'Requerimientos', metodo: 'POST', ruta: '/api/requerimientos/{codigo_req}/transicion', descripcion: 'Cambia estado del requerimiento.', cuerpo: 'nuevo_estado, descripcion' },
  { modulo: 'Requerimientos', metodo: 'POST', ruta: '/api/requerimientos/{codigo_req}/entregas', descripcion: 'Agrega o reemplaza una entrega.' },
  { modulo: 'Requerimientos', metodo: 'DELETE', ruta: '/api/requerimientos/{codigo_req}/entregas/{numero}', descripcion: 'Elimina una entrega por número.' },
  { modulo: 'Requerimientos', metodo: 'GET', ruta: '/api/requerimientos/{codigo_req}/liquidacion', descripcion: 'Calcula liquidación del requerimiento.' },
  { modulo: 'Administración', metodo: 'GET', ruta: '/api/requerimientos/{codigo_req}/diagnostico', descripcion: 'Diagnóstico por REQ o SC en modo consolidado.', permisos: 'requerimientos.editar' },
  { modulo: 'Administración', metodo: 'POST', ruta: '/api/requerimientos/{codigo_req}/reasignar-aplicacion', descripcion: 'Reasigna un requerimiento a otra aplicación.', parametros: 'nueva_aplicacion', permisos: 'requerimientos.editar' },

  { modulo: 'Estimaciones', metodo: 'GET', ruta: '/api/estimaciones', descripcion: 'Lista estimaciones.' },
  { modulo: 'Estimaciones', metodo: 'GET', ruta: '/api/estimaciones/por-requerimiento/{requerimiento_id}', descripcion: 'Obtiene estimación y resumen por requerimiento.' },
  { modulo: 'Estimaciones', metodo: 'POST', ruta: '/api/estimaciones/upload/{requerimiento_id}', descripcion: 'Carga estimación desde Excel base64.', permisos: 'requerimientos.editar' },
  { modulo: 'Estimaciones', metodo: 'GET', ruta: '/api/estimaciones/{estimacion_id}', descripcion: 'Obtiene estimación.' },
  { modulo: 'Estimaciones', metodo: 'POST', ruta: '/api/estimaciones', descripcion: 'Crea estimación manual.', permisos: 'requerimientos.editar' },
  { modulo: 'Estimaciones', metodo: 'PUT', ruta: '/api/estimaciones/{estimacion_id}', descripcion: 'Actualiza estimación.', permisos: 'requerimientos.editar' },
  { modulo: 'Estimaciones', metodo: 'DELETE', ruta: '/api/estimaciones/{estimacion_id}', descripcion: 'Elimina estimación.', permisos: 'requerimientos.editar' },
  { modulo: 'Estimaciones', metodo: 'POST', ruta: '/api/estimaciones/{estimacion_id}/crear-tareas-hitss', descripcion: 'Crea Feature/HU/Tasks en Azure DevOps HITSS.', permisos: 'requerimientos.editar' },
  { modulo: 'Estimaciones', metodo: 'POST', ruta: '/api/estimaciones/{estimacion_id}/crear-tareas-epm', descripcion: 'Crea Tasks en Azure DevOps EPM usando HU padre.', permisos: 'requerimientos.editar' },

  { modulo: 'Azure DevOps', metodo: 'GET', ruta: '/api/azdo/config', descripcion: 'Obtiene configuración por target y jerarquía.', parametros: 'target=hitss|epm, squad_id, usuario_id' },
  { modulo: 'Azure DevOps', metodo: 'GET', ruta: '/api/azdo/config/all', descripcion: 'Lista configuraciones AzDO de la aplicación.' },
  { modulo: 'Azure DevOps', metodo: 'PUT', ruta: '/api/azdo/config', descripcion: 'Guarda configuración HITSS o EPM.', cuerpo: 'org_url, pat, default_project, sync_interval, target, squad_id, usuario_id' },
  { modulo: 'Azure DevOps', metodo: 'DELETE', ruta: '/api/azdo/config', descripcion: 'Elimina configuración por squad o usuario.', parametros: 'target=hitss|epm, squad_id, usuario_id' },
  { modulo: 'Azure DevOps', metodo: 'GET', ruta: '/api/azdo/test', descripcion: 'Prueba conexión AzDO.', parametros: 'target=hitss|epm, squad_id, usuario_id' },
  { modulo: 'Azure DevOps', metodo: 'GET', ruta: '/api/azdo/campos-requeridos', descripcion: 'Descubre campos requeridos para Feature, HU/PBI y Task.', parametros: 'target=hitss|epm, squad_id, usuario_id' },
  { modulo: 'Azure DevOps', metodo: 'GET', ruta: '/api/azdo/proyectos', descripcion: 'Lista proyectos AzDO.', parametros: 'target=hitss|epm, squad_id, usuario_id' },
  { modulo: 'Azure DevOps', metodo: 'GET', ruta: '/api/azdo/iteraciones', descripcion: 'Lista iteraciones del proyecto.', parametros: 'proyecto, target=hitss|epm, squad_id, usuario_id' },
  { modulo: 'Azure DevOps', metodo: 'GET', ruta: '/api/azdo/work-items', descripcion: 'Lista work items sincronizados.' },
  { modulo: 'Azure DevOps', metodo: 'GET', ruta: '/api/azdo/sync-log', descripcion: 'Lista histórico de sincronización.' },
  { modulo: 'Azure DevOps', metodo: 'POST', ruta: '/api/azdo/sync', descripcion: 'Sincroniza una iteración.', cuerpo: 'azdo_project, iteration_path, target' },

  { modulo: 'Soporte', metodo: 'GET', ruta: '/api/soporte/solicitudes-fabrica', descripcion: 'Lista solicitudes fábrica importadas.', permisos: 'soporte.solicitudes_fabrica.ver' },
  { modulo: 'Soporte', metodo: 'GET', ruta: '/api/soporte/solicitudes-fabrica/resumen', descripcion: 'Resumen ligero para dashboards.', permisos: 'soporte.solicitudes_fabrica.ver' },
  { modulo: 'Soporte', metodo: 'POST', ruta: '/api/soporte/solicitudes-fabrica/previsualizar', descripcion: 'Previsualiza Excel antes de sincronizar.', cuerpo: 'multipart archivo', permisos: 'soporte.solicitudes_fabrica.actualizar' },
  { modulo: 'Soporte', metodo: 'POST', ruta: '/api/soporte/solicitudes-fabrica/sincronizar', descripcion: 'Sincroniza solicitudes desde Excel.', cuerpo: 'multipart archivo', permisos: 'soporte.solicitudes_fabrica.actualizar' },
  { modulo: 'Soporte', metodo: 'GET', ruta: '/api/soporte/solicitudes-fabrica/sincronizaciones/{sync_id}/errores.csv', descripcion: 'Descarga errores de sincronización en CSV.', permisos: 'soporte.solicitudes_fabrica.ver' },

  { modulo: 'Personas', metodo: 'GET', ruta: '/api/personas/roles', descripcion: 'Lista roles de persona configurados.' },
  { modulo: 'Personas', metodo: 'GET', ruta: '/api/personas/duplicados', descripcion: 'Detecta personas duplicadas.' },
  { modulo: 'Personas', metodo: 'POST', ruta: '/api/personas/deduplicar', descripcion: 'Fusiona duplicados y actualiza referencias.' },
  { modulo: 'Personas', metodo: 'GET', ruta: '/api/personas', descripcion: 'Lista personas.' },
  { modulo: 'Personas', metodo: 'GET', ruta: '/api/personas/{persona_id}', descripcion: 'Obtiene persona.' },
  { modulo: 'Personas', metodo: 'POST', ruta: '/api/personas', descripcion: 'Crea persona.' },
  { modulo: 'Personas', metodo: 'PUT', ruta: '/api/personas/{persona_id}', descripcion: 'Actualiza persona.' },
  { modulo: 'Personas', metodo: 'DELETE', ruta: '/api/personas/{persona_id}', descripcion: 'Elimina persona.' },

  { modulo: 'Carga de trabajo', metodo: 'GET', ruta: '/api/asignaciones', descripcion: 'Lista asignaciones.' },
  { modulo: 'Carga de trabajo', metodo: 'GET', ruta: '/api/asignaciones/{asignacion_id}', descripcion: 'Obtiene asignación.' },
  { modulo: 'Carga de trabajo', metodo: 'POST', ruta: '/api/asignaciones', descripcion: 'Crea asignación.' },
  { modulo: 'Carga de trabajo', metodo: 'PUT', ruta: '/api/asignaciones/{asignacion_id}', descripcion: 'Actualiza asignación.' },
  { modulo: 'Carga de trabajo', metodo: 'PATCH', ruta: '/api/asignaciones/{asignacion_id}/prioridad', descripcion: 'Actualiza prioridad de asignación.' },
  { modulo: 'Carga de trabajo', metodo: 'DELETE', ruta: '/api/asignaciones/{asignacion_id}', descripcion: 'Elimina asignación.' },
  { modulo: 'Carga de trabajo', metodo: 'POST', ruta: '/api/asignaciones/sincronizar/{codigo_req}', descripcion: 'Sincroniza asignación desde requerimiento.' },
  { modulo: 'Carga de trabajo', metodo: 'GET', ruta: '/api/capacidades', descripcion: 'Lista capacidades.', parametros: 'mes opcional' },
  { modulo: 'Carga de trabajo', metodo: 'POST', ruta: '/api/capacidades', descripcion: 'Crea capacidad.' },
  { modulo: 'Carga de trabajo', metodo: 'PUT', ruta: '/api/capacidades/{capacidad_id}', descripcion: 'Actualiza capacidad.' },
  { modulo: 'Carga de trabajo', metodo: 'DELETE', ruta: '/api/capacidades/{capacidad_id}', descripcion: 'Elimina capacidad.' },
  { modulo: 'Carga de trabajo', metodo: 'GET', ruta: '/api/squads', descripcion: 'Lista squads.' },
  { modulo: 'Carga de trabajo', metodo: 'POST', ruta: '/api/squads', descripcion: 'Crea squad.' },
  { modulo: 'Carga de trabajo', metodo: 'PUT', ruta: '/api/squads/{squad_id}', descripcion: 'Actualiza squad.' },
  { modulo: 'Carga de trabajo', metodo: 'DELETE', ruta: '/api/squads/{squad_id}', descripcion: 'Elimina squad.' },

  { modulo: 'Catálogos', metodo: 'GET', ruta: '/api/tarifas', descripcion: 'Lista tarifas.' },
  { modulo: 'Catálogos', metodo: 'POST', ruta: '/api/tarifas', descripcion: 'Crea tarifa.' },
  { modulo: 'Catálogos', metodo: 'PUT', ruta: '/api/tarifas/{tarifa_id}', descripcion: 'Actualiza tarifa.' },
  { modulo: 'Catálogos', metodo: 'DELETE', ruta: '/api/tarifas/{tarifa_id}', descripcion: 'Elimina tarifa.' },
  { modulo: 'Catálogos', metodo: 'GET', ruta: '/api/festivos', descripcion: 'Lista festivos.' },
  { modulo: 'Catálogos', metodo: 'POST', ruta: '/api/festivos', descripcion: 'Crea festivo.' },
  { modulo: 'Catálogos', metodo: 'DELETE', ruta: '/api/festivos/{festivo_id}', descripcion: 'Elimina festivo.' },
  { modulo: 'Catálogos', metodo: 'GET', ruta: '/api/categorias', descripcion: 'Lista categorías.' },
  { modulo: 'Catálogos', metodo: 'POST', ruta: '/api/categorias', descripcion: 'Crea categoría.' },
  { modulo: 'Catálogos', metodo: 'PUT', ruta: '/api/categorias/{categoria_id}', descripcion: 'Actualiza categoría.' },
  { modulo: 'Catálogos', metodo: 'DELETE', ruta: '/api/categorias/{categoria_id}', descripcion: 'Elimina categoría.' },
  { modulo: 'Catálogos', metodo: 'GET', ruta: '/api/actas', descripcion: 'Lista actas.' },
  { modulo: 'Catálogos', metodo: 'POST', ruta: '/api/actas', descripcion: 'Crea acta.' },
  { modulo: 'Catálogos', metodo: 'PUT', ruta: '/api/actas/{acta_id}', descripcion: 'Actualiza acta.' },
  { modulo: 'Catálogos', metodo: 'DELETE', ruta: '/api/actas/{acta_id}', descripcion: 'Elimina acta.' },
  { modulo: 'Configuración', metodo: 'GET', ruta: '/api/configuracion', descripcion: 'Lista parámetros de configuración.' },
  { modulo: 'Configuración', metodo: 'PUT', ruta: '/api/configuracion/{clave}', descripcion: 'Crea o actualiza parámetro.' },
  { modulo: 'Configuración', metodo: 'DELETE', ruta: '/api/configuracion/{clave}', descripcion: 'Elimina parámetro.' },

  { modulo: 'Importación', metodo: 'POST', ruta: '/api/importacion/excel', descripcion: 'Importa datos desde Excel.', cuerpo: 'multipart archivo' },
  { modulo: 'Importación', metodo: 'GET', ruta: '/api/importacion/excel/plantilla', descripcion: 'Descarga plantilla Excel.' },
  { modulo: 'Importación', metodo: 'POST', ruta: '/api/importacion/excel/previsualizar', descripcion: 'Previsualiza importación Excel.', cuerpo: 'multipart archivo' },

  { modulo: 'Dashboards y reportes', metodo: 'GET', ruta: '/api/dashboard/consolidado', descripcion: 'Dashboard consolidado.' },
  { modulo: 'Dashboards y reportes', metodo: 'GET', ruta: '/api/cifras/estado', descripcion: 'Cifras por estado.' },
  { modulo: 'Dashboards y reportes', metodo: 'GET', ruta: '/api/cifras/squad', descripcion: 'Cifras por squad.' },
  { modulo: 'Dashboards y reportes', metodo: 'GET', ruta: '/api/cifras/ans', descripcion: 'Cifras de ANS.' },
  { modulo: 'Dashboards y reportes', metodo: 'GET', ruta: '/api/cifras/liquidacion', descripcion: 'Cifras de liquidación.' },
  { modulo: 'Dashboards y reportes', metodo: 'GET', ruta: '/api/reportes/equipo', descripcion: 'Reporte de equipo.' },
  { modulo: 'Dashboards y reportes', metodo: 'GET', ruta: '/api/reportes/roadmap', descripcion: 'Reporte de roadmap.' },
  { modulo: 'Bitácora', metodo: 'GET', ruta: '/api/bitacora', descripcion: 'Lista eventos de bitácora.', parametros: 'entidad_id opcional' },
  { modulo: 'Bitácora', metodo: 'DELETE', ruta: '/api/bitacora/{evento_id}', descripcion: 'Elimina evento de bitácora.' },

  { modulo: 'Integración externa', metodo: 'GET', ruta: '/api/integracion/entregas', descripcion: 'Entregas pendientes para Power Automate. Auth: X-API-Key.', parametros: 'aplicacion opcional' },
  { modulo: 'Integración externa', metodo: 'GET', ruta: '/api/integracion/requerimientos', descripcion: 'Requerimientos para Power Automate. Auth: X-API-Key independiente.', parametros: 'aplicacion y estado opcionales' },
  { modulo: 'Integración externa', metodo: 'GET', ruta: '/api/integracion/solicitudes', descripcion: 'Fecha y hora de solicitud, Código SC, Código REQ, Squad, Estado, ANS ACTA, fecha real de entrega de estimaciones y horas estimadas. Auth: X-API-Key independiente (API_KEY_SOLICITUDES).', parametros: 'aplicacion opcional' },
  { modulo: 'Integración externa', metodo: 'GET', ruta: '/api/integracion/solicitudes-entregas', descripcion: 'Entregas aplanadas: Código SC, Código REQ, N° Entrega, Horas, F. Comprometida, F. Real, Estado, Mes de aprobación, ANS (de la entrega), Garantía y N° Garantía (fechas sin hora). Auth: X-API-Key independiente (API_KEY_SOLICITUDES).', parametros: 'aplicacion opcional' },
]

const metodoClase: Record<Metodo, string> = {
  GET: 'bg-emerald-100 text-emerald-700',
  POST: 'bg-blue-100 text-blue-700',
  PUT: 'bg-amber-100 text-amber-700',
  PATCH: 'bg-purple-100 text-purple-700',
  DELETE: 'bg-red-100 text-red-700',
}

async function consultarIntegracion(
  ruta: string,
  apiKey: string,
  params?: Record<string, string>,
  nombreClave = "API Key",
): Promise<unknown> {
  const query = new URLSearchParams(params ?? {})
  const queryString = query.toString()
  const url = `${import.meta.env.BASE_URL}api${ruta}${queryString ? `?${queryString}` : ''}`
  const resp = await fetch(url, {
    headers: { 'X-API-Key': apiKey },
  })
  const texto = await resp.text()
  let data: unknown = texto
  if (texto) {
    try {
      data = JSON.parse(texto)
    } catch {
      data = texto
    }
  }
  if (!resp.ok) {
    const detalle = data && typeof data === 'object' && 'detail' in data
      ? String((data as { detail: unknown }).detail)
      : `HTTP ${resp.status}`
    const ayuda = resp.status === 401 ? ` Verifica que estés usando ${nombreClave}.` : ''
    throw new Error(`${detalle}.${ayuda}`)
  }
  return data
}

export default function AdminEndpoints() {
  const { datos: apps } = useLista<Aplicacion>('/aplicaciones')
  const { datos: endpointsAdmin, error: errorEndpointsAdmin, recargar: recargarEndpointsAdmin } =
    useLista<EndpointAdmin>('/admin/endpoints')
  const [nuevoModulo, setNuevoModulo] = useState('')
  const [nuevoMetodo, setNuevoMetodo] = useState<Metodo>('GET')
  const [nuevaRuta, setNuevaRuta] = useState('')
  const [nuevaDescripcion, setNuevaDescripcion] = useState('')
  const [avisoEndpointsAdmin, setAvisoEndpointsAdmin] = useState('')
  const [creandoEndpointAdmin, setCreandoEndpointAdmin] = useState(false)
  const [identificador, setIdentificador] = useState('')
  const [nuevaAplicacion, setNuevaAplicacion] = useState('')
  const [resultado, setResultado] = useState<unknown>(null)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [cargandoDiag, setCargandoDiag] = useState(false)
  const [cargandoReasig, setCargandoReasig] = useState(false)
  const [cargandoEntregas, setCargandoEntregas] = useState(false)
  const [filtro, setFiltro] = useState('')
  const [modulo, setModulo] = useState('Todos')
  const [apiKeyIntegracion, setApiKeyIntegracion] = useState('')
  const [aplicacionIntegracion, setAplicacionIntegracion] = useState('')
  const [cargandoRequerimientosIntegracion, setCargandoRequerimientosIntegracion] = useState(false)
  const [apiKeyRequerimientosIntegracion, setApiKeyRequerimientosIntegracion] = useState('')
  const [aplicacionRequerimientosIntegracion, setAplicacionRequerimientosIntegracion] = useState('')
  const [estadoRequerimientosIntegracion, setEstadoRequerimientosIntegracion] = useState('')
  const [cargandoSolicitudesIntegracion, setCargandoSolicitudesIntegracion] = useState(false)
  const [apiKeySolicitudesIntegracion, setApiKeySolicitudesIntegracion] = useState('')
  const [aplicacionSolicitudesIntegracion, setAplicacionSolicitudesIntegracion] = useState('')
  const [cargandoSolicitudesEntregasIntegracion, setCargandoSolicitudesEntregasIntegracion] = useState(false)

  const modulos = useMemo(() => ['Todos', ...Array.from(new Set(ENDPOINTS.map((e) => e.modulo))).sort()], [])
  const endpointsFiltrados = useMemo(() => {
    const texto = filtro.trim().toLowerCase()
    return ENDPOINTS.filter((endpoint) => {
      const coincideModulo = modulo === 'Todos' || endpoint.modulo === modulo
      const coincideTexto = !texto || [
        endpoint.modulo,
        endpoint.metodo,
        endpoint.ruta,
        endpoint.descripcion,
        endpoint.parametros,
        endpoint.cuerpo,
        endpoint.permisos,
      ].some((valor) => valor?.toLowerCase().includes(texto))
      return coincideModulo && coincideTexto
    })
  }, [filtro, modulo])

  async function ejecutarDiagnostico(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError('')
    setOk('')
    setResultado(null)
    setCargandoDiag(true)
    try {
      const id = identificador.trim()
      const { data } = await client.get(`/requerimientos/${encodeURIComponent(id)}/diagnostico`, HEADER_CONSOLIDADO)
      setResultado(data)
      setOk('Diagnóstico ejecutado correctamente.')
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setCargandoDiag(false)
    }
  }

  async function ejecutarReasignacion(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError('')
    setOk('')
    setResultado(null)
    setCargandoReasig(true)
    try {
      const id = identificador.trim()
      const app = nuevaAplicacion.trim()
      const { data } = await client.post(
        `/requerimientos/${encodeURIComponent(id)}/reasignar-aplicacion`,
        null,
        {
          ...HEADER_CONSOLIDADO,
          params: { nueva_aplicacion: app },
        },
      )
      setResultado(data)
      setOk('Reasignación aplicada correctamente.')
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setCargandoReasig(false)
    }
  }

  async function probarEntregasIntegracion(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError('')
    setOk('')
    setResultado(null)
    setCargandoEntregas(true)
    try {
      const params = aplicacionIntegracion ? { aplicacion: aplicacionIntegracion } : undefined
      const data = await consultarIntegracion(
        '/integracion/entregas',
        apiKeyIntegracion.trim(),
        params,
        'API_KEY',
      )
      setResultado(data)
      const total = Array.isArray(data) ? data.length : 0
      setOk(`Endpoint de entregas ejecutado correctamente. Filas recibidas: ${total}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : mensajeError(err))
    } finally {
      setCargandoEntregas(false)
    }
  }

  async function probarRequerimientosIntegracion(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError('')
    setOk('')
    setResultado(null)
    setCargandoRequerimientosIntegracion(true)
    try {
      const params = {
        ...(aplicacionRequerimientosIntegracion ? { aplicacion: aplicacionRequerimientosIntegracion } : {}),
        ...(estadoRequerimientosIntegracion.trim() ? { estado: estadoRequerimientosIntegracion.trim() } : {}),
      }
      const data = await consultarIntegracion(
        '/integracion/requerimientos',
        apiKeyRequerimientosIntegracion.trim(),
        params,
        'API_KEY_REQUERIMIENTOS, no la API_KEY de entregas',
      )
      setResultado(data)
      const total = Array.isArray(data) ? data.length : 0
      setOk(`Endpoint de requerimientos ejecutado correctamente. Filas recibidas: ${total}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : mensajeError(err))
    } finally {
      setCargandoRequerimientosIntegracion(false)
    }
  }

  async function probarSolicitudesIntegracion(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError('')
    setOk('')
    setResultado(null)
    setCargandoSolicitudesIntegracion(true)
    try {
      const params = aplicacionSolicitudesIntegracion ? { aplicacion: aplicacionSolicitudesIntegracion } : undefined
      const data = await consultarIntegracion(
        '/integracion/solicitudes',
        apiKeySolicitudesIntegracion.trim(),
        params,
        'API_KEY_SOLICITUDES',
      )
      setResultado(data)
      const total = Array.isArray(data) ? data.length : 0
      setOk(`Endpoint de solicitudes ejecutado correctamente. Filas recibidas: ${total}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : mensajeError(err))
    } finally {
      setCargandoSolicitudesIntegracion(false)
    }
  }

  async function probarSolicitudesEntregasIntegracion(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError('')
    setOk('')
    setResultado(null)
    setCargandoSolicitudesEntregasIntegracion(true)
    try {
      const params = aplicacionSolicitudesIntegracion ? { aplicacion: aplicacionSolicitudesIntegracion } : undefined
      const data = await consultarIntegracion(
        '/integracion/solicitudes-entregas',
        apiKeySolicitudesIntegracion.trim(),
        params,
        'API_KEY_SOLICITUDES',
      )
      setResultado(data)
      const total = Array.isArray(data) ? data.length : 0
      setOk(`Endpoint de entregas (solicitudes) ejecutado correctamente. Filas recibidas: ${total}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : mensajeError(err))
    } finally {
      setCargandoSolicitudesEntregasIntegracion(false)
    }
  }

  async function crearEndpointAdmin(e: FormEvent): Promise<void> {
    e.preventDefault()
    setAvisoEndpointsAdmin('')
    setCreandoEndpointAdmin(true)
    try {
      await client.post('/admin/endpoints', {
        modulo: nuevoModulo.trim(),
        metodo: nuevoMetodo,
        ruta: nuevaRuta.trim(),
        descripcion: nuevaDescripcion.trim(),
      })
      setNuevoModulo('')
      setNuevaRuta('')
      setNuevaDescripcion('')
      recargarEndpointsAdmin()
    } catch (err) {
      setAvisoEndpointsAdmin(mensajeError(err))
    } finally {
      setCreandoEndpointAdmin(false)
    }
  }

  async function eliminarEndpointAdmin(endpoint: EndpointAdmin): Promise<void> {
    setAvisoEndpointsAdmin('')
    try {
      await client.delete(`/admin/endpoints/${endpoint.id}`)
      recargarEndpointsAdmin()
    } catch (err) {
      setAvisoEndpointsAdmin(mensajeError(err))
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="titulo-pagina mb-2">Administración de Endpoints</h1>
        <p className="rounded border bg-white p-3 text-sm text-slate-700">
          Panel operativo y documentación de rutas FastAPI. Las acciones administrativas de requerimientos
          envían <code>X-Aplicacion: __todas__</code> para trabajar en modo consolidado.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={ejecutarDiagnostico} className="tarjeta tarjeta-pad">
          <h2 className="titulo-seccion mb-3">Diagnóstico</h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Código REQ o SC</span>
              <input
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                placeholder="Ej: 10813 o REQ-123"
                required
                className="campo min-w-64"
              />
            </label>
            <button
              disabled={cargandoDiag}
              className="btn btn-primario"
            >
              {cargandoDiag ? 'Consultando...' : 'Consultar diagnóstico'}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">GET /api/requerimientos/{'{codigo_req}'}/diagnostico</p>
        </form>

        <form onSubmit={ejecutarReasignacion} className="tarjeta tarjeta-pad">
          <h2 className="titulo-seccion mb-3">Reasignar aplicación</h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Nueva aplicación</span>
              <select
                value={nuevaAplicacion}
                onChange={(e) => setNuevaAplicacion(e.target.value)}
                required
                className="campo min-w-64"
              >
                <option value="">Seleccione una aplicación</option>
                {apps.map((a) => (
                  <option key={a.codigo} value={a.codigo}>
                    {a.nombre} ({a.codigo})
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={cargandoReasig || !identificador.trim()}
              className="btn btn-alerta"
            >
              {cargandoReasig ? 'Reasignando...' : 'Reasignar'}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            POST /api/requerimientos/{'{codigo_req}'}/reasignar-aplicacion?nueva_aplicacion=...
          </p>
        </form>
      </div>

      <form onSubmit={probarEntregasIntegracion} className="tarjeta tarjeta-pad">
        <div className="mb-3">
          <h2 className="titulo-seccion">Probar integración de entregas</h2>
          <p className="text-xs text-slate-500">
            GET /api/integracion/entregas — solo requerimientos en estado ESTIMACION APROBADA ENTREGA PENDIENTE
            y entregas en estado Pendiente.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">X-API-Key</span>
            <input
              type="password"
              value={apiKeyIntegracion}
              onChange={(e) => setApiKeyIntegracion(e.target.value)}
              placeholder="Clave configurada en API_KEY"
              required
              className="campo min-w-72"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Aplicación / squad (opcional)</span>
            <select
              value={aplicacionIntegracion}
              onChange={(e) => setAplicacionIntegracion(e.target.value)}
              className="campo min-w-64"
            >
              <option value="">Todas</option>
              {apps.map((a) => (
                <option key={a.codigo} value={a.codigo}>
                  {a.nombre} ({a.codigo})
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={cargandoEntregas}
            className="btn btn-primario"
          >
            {cargandoEntregas ? 'Probando...' : 'Probar endpoint'}
          </button>
        </div>
        <p className="mt-2 font-mono text-xs text-slate-500">
          /api/integracion/entregas{aplicacionIntegracion ? `?aplicacion=${aplicacionIntegracion}` : ''}
        </p>
      </form>

      <form onSubmit={probarRequerimientosIntegracion} className="tarjeta tarjeta-pad">
        <div className="mb-3">
          <h2 className="titulo-seccion">Probar integración de requerimientos</h2>
          <p className="text-xs text-slate-500">
            GET /api/integracion/requerimientos — requiere API_KEY_REQUERIMIENTOS y permite filtrar por aplicación
            o estado del requerimiento. No usa la API_KEY de entregas.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">X-API-Key requerimientos</span>
            <input
              type="password"
              value={apiKeyRequerimientosIntegracion}
              onChange={(e) => setApiKeyRequerimientosIntegracion(e.target.value)}
              placeholder="Clave configurada en API_KEY_REQUERIMIENTOS"
              required
              className="campo min-w-72"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Aplicación / squad (opcional)</span>
            <select
              value={aplicacionRequerimientosIntegracion}
              onChange={(e) => setAplicacionRequerimientosIntegracion(e.target.value)}
              className="campo min-w-64"
            >
              <option value="">Todas</option>
              {apps.map((a) => (
                <option key={a.codigo} value={a.codigo}>
                  {a.nombre} ({a.codigo})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Estado (opcional)</span>
            <input
              value={estadoRequerimientosIntegracion}
              onChange={(e) => setEstadoRequerimientosIntegracion(e.target.value)}
              placeholder="Ej: ESTIMACION APROBADA ENTREGA PENDIENTE"
              className="campo min-w-80"
            />
          </label>
          <button
            disabled={cargandoRequerimientosIntegracion}
            className="btn btn-primario"
          >
            {cargandoRequerimientosIntegracion ? 'Probando...' : 'Probar endpoint'}
          </button>
        </div>
        <p className="mt-2 font-mono text-xs text-slate-500">
          /api/integracion/requerimientos
          {aplicacionRequerimientosIntegracion || estadoRequerimientosIntegracion.trim() ? '?' : ''}
          {[
            aplicacionRequerimientosIntegracion ? `aplicacion=${aplicacionRequerimientosIntegracion}` : '',
            estadoRequerimientosIntegracion.trim() ? `estado=${estadoRequerimientosIntegracion.trim()}` : '',
          ].filter(Boolean).join('&')}
        </p>
      </form>

      <form onSubmit={probarSolicitudesIntegracion} className="tarjeta tarjeta-pad">
        <div className="mb-3">
          <h2 className="titulo-seccion">Probar integración de solicitudes dashboard</h2>
          <p className="text-xs text-slate-500">
            GET /api/integracion/solicitudes — devuelve fecha y hora de solicitud, Código SC y Código REQ.
            Requiere API_KEY_SOLICITUDES (clave independiente de entregas y requerimientos).
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">X-API-Key solicitudes</span>
            <input
              type="password"
              value={apiKeySolicitudesIntegracion}
              onChange={(e) => setApiKeySolicitudesIntegracion(e.target.value)}
              placeholder="Clave configurada en API_KEY_SOLICITUDES"
              required
              className="campo min-w-72"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Aplicación / squad (opcional)</span>
            <select
              value={aplicacionSolicitudesIntegracion}
              onChange={(e) => setAplicacionSolicitudesIntegracion(e.target.value)}
              className="campo min-w-64"
            >
              <option value="">Todas</option>
              {apps.map((a) => (
                <option key={a.codigo} value={a.codigo}>
                  {a.nombre} ({a.codigo})
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={cargandoSolicitudesIntegracion}
            className="btn btn-primario"
          >
            {cargandoSolicitudesIntegracion ? 'Probando...' : 'Probar endpoint'}
          </button>
        </div>
        <p className="mt-2 font-mono text-xs text-slate-500">
          /api/integracion/solicitudes{aplicacionSolicitudesIntegracion ? `?aplicacion=${aplicacionSolicitudesIntegracion}` : ''}
        </p>
      </form>

      <form onSubmit={probarSolicitudesEntregasIntegracion} className="tarjeta tarjeta-pad">
        <div className="mb-3">
          <h2 className="titulo-seccion">Probar integración de entregas dashboard</h2>
          <p className="text-xs text-slate-500">
            GET /api/integracion/solicitudes-entregas — devuelve Código SC, Código REQ, N° Entrega, Horas,
            F. Comprometida, F. Real, Estado, Mes de aprobación, ANS, Garantía y N° Garantía (fechas sin hora).
            Usa la misma API_KEY_SOLICITUDES.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">X-API-Key solicitudes</span>
            <input
              type="password"
              value={apiKeySolicitudesIntegracion}
              onChange={(e) => setApiKeySolicitudesIntegracion(e.target.value)}
              placeholder="Clave configurada en API_KEY_SOLICITUDES"
              required
              className="campo min-w-72"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Aplicación / squad (opcional)</span>
            <select
              value={aplicacionSolicitudesIntegracion}
              onChange={(e) => setAplicacionSolicitudesIntegracion(e.target.value)}
              className="campo min-w-64"
            >
              <option value="">Todas</option>
              {apps.map((a) => (
                <option key={a.codigo} value={a.codigo}>
                  {a.nombre} ({a.codigo})
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={cargandoSolicitudesEntregasIntegracion}
            className="btn btn-primario"
          >
            {cargandoSolicitudesEntregasIntegracion ? 'Probando...' : 'Probar endpoint'}
          </button>
        </div>
        <p className="mt-2 font-mono text-xs text-slate-500">
          /api/integracion/solicitudes-entregas{aplicacionSolicitudesIntegracion ? `?aplicacion=${aplicacionSolicitudesIntegracion}` : ''}
        </p>
      </form>

      {ok && <div className="aviso aviso-exito">{ok}</div>}
      {error && <div className="aviso aviso-error">{error}</div>}

      <div className="rounded-xl border bg-slate-900 p-4 text-sm text-slate-100">
        <div className="mb-2 font-semibold">Respuesta</div>
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words">
          {resultado ? JSON.stringify(resultado, null, 2) : 'Sin resultados todavía.'}
        </pre>
      </div>

      <section className="tarjeta tarjeta-pad">
        <div className="mb-3">
          <h2 className="titulo-seccion">Catálogo administrable (agente de endpoints)</h2>
          <p className="text-xs text-slate-500">
            Prueba en vivo del agente CRUD de <code>/api/admin/endpoints</code>: agrega, lista y elimina entradas
            reales almacenadas en MongoDB (colección <code>endpoints_admin</code>).
          </p>
        </div>

        <form onSubmit={crearEndpointAdmin} className="mb-3 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Módulo</span>
            <input
              value={nuevoModulo}
              onChange={(e) => setNuevoModulo(e.target.value)}
              placeholder="Ej: Endpoints"
              required
              className="campo min-w-40"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Método</span>
            <select
              value={nuevoMetodo}
              onChange={(e) => setNuevoMetodo(e.target.value as Metodo)}
              className="campo"
            >
              {(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as Metodo[]).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Ruta</span>
            <input
              value={nuevaRuta}
              onChange={(e) => setNuevaRuta(e.target.value)}
              placeholder="/api/admin/endpoints"
              required
              className="campo min-w-64"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Descripción</span>
            <input
              value={nuevaDescripcion}
              onChange={(e) => setNuevaDescripcion(e.target.value)}
              placeholder="Descripción breve"
              className="campo min-w-64"
            />
          </label>
          <button
            disabled={creandoEndpointAdmin}
            className="btn btn-primario"
          >
            {creandoEndpointAdmin ? 'Creando...' : 'Crear endpoint'}
          </button>
        </form>

        {(avisoEndpointsAdmin || errorEndpointsAdmin) && (
          <div className="aviso aviso-error mb-3">
            {avisoEndpointsAdmin || errorEndpointsAdmin}
          </div>
        )}

        <div className="overflow-auto rounded-lg border">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Módulo</th>
                <th className="px-3 py-2">Método</th>
                <th className="px-3 py-2">Ruta</th>
                <th className="px-3 py-2">Descripción</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {endpointsAdmin.map((endpoint) => (
                <tr key={endpoint.id} className="border-t align-top">
                  <td className="px-3 py-2 font-medium text-slate-700">{endpoint.modulo}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-0.5 font-semibold ${metodoClase[endpoint.metodo as Metodo] ?? ''}`}>
                      {endpoint.metodo}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-slate-700">{endpoint.ruta}</td>
                  <td className="px-3 py-2 text-slate-600">{endpoint.descripcion || '—'}</td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => eliminarEndpointAdmin(endpoint)} className="enlace-accion enlace-accion-peligro">
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {endpointsAdmin.length === 0 && (
                <tr><td colSpan={5} className="p-4 text-center text-slate-400">Sin endpoints registrados en el catálogo.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="tarjeta tarjeta-pad">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="titulo-seccion">Documentación de endpoints</h2>
            <p className="text-xs text-slate-500">
              {endpointsFiltrados.length} de {ENDPOINTS.length} rutas documentadas. Todas requieren JWT salvo login y health; los recursos operativos usan <code>X-Aplicacion</code>.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={modulo} onChange={(e) => setModulo(e.target.value)} className="campo">
              {modulos.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <input
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Buscar ruta, permiso o descripción"
              className="campo min-w-72"
            />
          </div>
        </div>

        <div className="overflow-auto rounded-lg border">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Módulo</th>
                <th className="px-3 py-2">Método</th>
                <th className="px-3 py-2">Ruta</th>
                <th className="px-3 py-2">Descripción</th>
                <th className="px-3 py-2">Parámetros / cuerpo</th>
                <th className="px-3 py-2">Permiso</th>
              </tr>
            </thead>
            <tbody>
              {endpointsFiltrados.map((endpoint) => (
                <tr key={`${endpoint.metodo}-${endpoint.ruta}`} className="border-t align-top">
                  <td className="px-3 py-2 font-medium text-slate-700">{endpoint.modulo}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-0.5 font-semibold ${metodoClase[endpoint.metodo]}`}>
                      {endpoint.metodo}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-slate-700">{endpoint.ruta}</td>
                  <td className="px-3 py-2 text-slate-600">{endpoint.descripcion}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {endpoint.parametros && <div><span className="font-semibold">Query:</span> {endpoint.parametros}</div>}
                    {endpoint.cuerpo && <div><span className="font-semibold">Body:</span> {endpoint.cuerpo}</div>}
                    {!endpoint.parametros && !endpoint.cuerpo && <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-slate-600">{endpoint.permisos ?? 'JWT / rol según ruta'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
