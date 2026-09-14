import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import client from '../../api/client'
import { mensajeError, useLista } from '../../api/hooks'
import type { Aplicacion, EndpointAdmin, EndpointCatalogo } from '../../types'
import { consultarIntegracion } from './consultarIntegracion'
import type { Metodo } from './tipos'

const HEADER_CONSOLIDADO = { headers: { 'X-Aplicacion': '__todas__' } }

/**
 * Estado y acciones de la pantalla "Administración de Endpoints": diagnóstico y
 * reasignación de requerimientos, los cuatro formularios de "probar integración",
 * el catálogo administrable de endpoints (notas de negocio) y el catálogo vivo
 * de `GET /api/admin/endpoints/catalogo` (F4.1/F4.5, ADR-0008) que alimenta la
 * documentación y el probador de endpoints.
 */
export function useAdminEndpoints() {
  const { datos: apps } = useLista<Aplicacion>('/aplicaciones')
  const { datos: endpointsAdmin, error: errorEndpointsAdmin, recargar: recargarEndpointsAdmin } =
    useLista<EndpointAdmin>('/admin/endpoints')
  // F4.5 (ADR-0008): catalogo vivo derivado de app.openapi(), reemplaza la lista a mano.
  const { datos: catalogo, error: errorCatalogo, cargando: cargandoCatalogo, recargar: recargarCatalogo } =
    useLista<EndpointCatalogo>('/admin/endpoints/catalogo')
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

  const modulos = useMemo(
    () => ['Todos', ...Array.from(new Set(catalogo.map((e) => e.modulo))).sort()],
    [catalogo],
  )
  const endpointsFiltrados = useMemo(() => {
    const texto = filtro.trim().toLowerCase()
    return catalogo.filter((endpoint) => {
      const coincideModulo = modulo === 'Todos' || endpoint.modulo === modulo
      const coincideTexto = !texto || [
        endpoint.modulo,
        endpoint.metodo,
        endpoint.ruta,
        endpoint.resumen,
        endpoint.permiso,
        endpoint.enriquecimiento?.descripcion,
      ].some((valor) => valor?.toLowerCase().includes(texto))
      return coincideModulo && coincideTexto
    })
  }, [catalogo, filtro, modulo])

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

  return {
    apps,
    endpointsAdmin,
    errorEndpointsAdmin,
    catalogo,
    errorCatalogo,
    cargandoCatalogo,
    recargarCatalogo,
    nuevoModulo,
    setNuevoModulo,
    nuevoMetodo,
    setNuevoMetodo,
    nuevaRuta,
    setNuevaRuta,
    nuevaDescripcion,
    setNuevaDescripcion,
    avisoEndpointsAdmin,
    creandoEndpointAdmin,
    identificador,
    setIdentificador,
    nuevaAplicacion,
    setNuevaAplicacion,
    resultado,
    error,
    ok,
    cargandoDiag,
    cargandoReasig,
    cargandoEntregas,
    filtro,
    setFiltro,
    modulo,
    setModulo,
    modulos,
    endpointsFiltrados,
    apiKeyIntegracion,
    setApiKeyIntegracion,
    aplicacionIntegracion,
    setAplicacionIntegracion,
    cargandoRequerimientosIntegracion,
    apiKeyRequerimientosIntegracion,
    setApiKeyRequerimientosIntegracion,
    aplicacionRequerimientosIntegracion,
    setAplicacionRequerimientosIntegracion,
    estadoRequerimientosIntegracion,
    setEstadoRequerimientosIntegracion,
    cargandoSolicitudesIntegracion,
    apiKeySolicitudesIntegracion,
    setApiKeySolicitudesIntegracion,
    aplicacionSolicitudesIntegracion,
    setAplicacionSolicitudesIntegracion,
    cargandoSolicitudesEntregasIntegracion,
    ejecutarDiagnostico,
    ejecutarReasignacion,
    probarEntregasIntegracion,
    probarRequerimientosIntegracion,
    probarSolicitudesIntegracion,
    probarSolicitudesEntregasIntegracion,
    crearEndpointAdmin,
    eliminarEndpointAdmin,
  }
}

export type EstadoAdminEndpoints = ReturnType<typeof useAdminEndpoints>
