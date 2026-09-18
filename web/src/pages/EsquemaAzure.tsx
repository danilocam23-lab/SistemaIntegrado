import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client'
import { mensajeError } from '../api/hooks'
import { Aviso, Boton, EncabezadoPagina, Icono, Selector, Tarjeta } from '../components/ui'
import type {
  AzdoIteracion,
  AzdoProyecto,
  NivelJerarquiaAzure,
  RespuestaEsquemaAzure,
  RespuestaPersonasConfigAzure,
  RespuestaTiposAzure,
  TipoWorkItemAzure,
} from '../types'
import { ArbolEsquemaAzure } from './esquema-azure/ArbolEsquemaAzure'
import { FiltrosEsquemaAzure } from './esquema-azure/FiltrosEsquemaAzure'
import { PanelJerarquia } from './esquema-azure/PanelJerarquia'
import { contarPorTipo, filtrarArbol, idsDelArbol, resumenConteo } from './esquema-azure/utilidades'

const TARGET_AZURE = 'hitss'
const LIMITE_ARBOL = 2000
const CLAVE_USUARIO_ESQUEMA = 'azdo-esquema-usuario-id'

function estadoHttp(error: unknown): number | undefined {
  return (error as { response?: { status?: number } }).response?.status
}

function parametrosBase(proyecto: string, usuarioId: string): URLSearchParams {
  const params = new URLSearchParams()
  params.set('target', TARGET_AZURE)
  if (proyecto.trim()) params.set('proyecto', proyecto.trim())
  if (usuarioId) params.set('usuario_id', usuarioId)
  return params
}

function VistaCargando() {
  return (
    <div className="space-y-4">
      <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
      <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
      <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />
    </div>
  )
}

function mensajeArbolVacio(sinNodos: boolean, filtradoPorSquad: boolean): string {
  if (!sinNodos) return 'No hay coincidencias por título o ID en el árbol cargado.'
  if (filtradoPorSquad) {
    return 'El proyecto no devolvió work items con esos filtros. Puede deberse a que las iteraciones configuradas para el squad no contienen work items; revísalas en Administración → Aplicaciones.'
  }
  return 'El proyecto no devolvió work items con esos filtros.'
}

export default function EsquemaAzure() {
  const [proyectos, setProyectos] = useState<AzdoProyecto[]>([])
  const [iteraciones, setIteraciones] = useState<AzdoIteracion[]>([])
  const [tipos, setTipos] = useState<TipoWorkItemAzure[]>([])
  const [jerarquia, setJerarquia] = useState<NivelJerarquiaAzure[]>([])
  const [respuesta, setRespuesta] = useState<RespuestaEsquemaAzure | null>(null)
  const [proyecto, setProyecto] = useState('')
  const [tiposSeleccionados, setTiposSeleccionados] = useState<string[]>([])
  const [areaPath, setAreaPath] = useState('')
  const [iteracionPath, setIteracionPath] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [sinConfigurar, setSinConfigurar] = useState(false)
  const [error, setError] = useState('')
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set())
  const [configPersonas, setConfigPersonas] = useState<RespuestaPersonasConfigAzure | null>(null)
  const [usuarioId, setUsuarioId] = useState<string>(
    () => window.localStorage.getItem(CLAVE_USUARIO_ESQUEMA) ?? '',
  )

  const puedeElegir = configPersonas?.puede_elegir_cualquiera ?? false
  const personasConConfig = configPersonas?.personas.filter((p) => p.tiene_config) ?? []
  const personaSeleccionada = personasConConfig.find((p) => p.id === usuarioId) ?? null

  const nodos = respuesta?.nodos ?? []
  const nodosFiltrados = useMemo(() => filtrarArbol(nodos, busqueda), [nodos, busqueda])
  const conteo = useMemo(() => contarPorTipo(nodos), [nodos])
  const resumen = useMemo(() => resumenConteo(conteo), [conteo])
  const proyectoMostrado = respuesta?.proyecto || proyecto || 'Proyecto Azure DevOps'
  const totalIteracionesAplicadas = respuesta?.iteraciones_aplicadas.length ?? 0
  const detalleIteracionesAplicadas = respuesta?.iteraciones_aplicadas.join('\n') || undefined

  useEffect(() => {
    let cancelado = false
    client
      .get<RespuestaPersonasConfigAzure>(`/azdo/personas-config?target=${TARGET_AZURE}`)
      .then(({ data }) => {
        if (cancelado) return
        setConfigPersonas(data)
        const guardado = window.localStorage.getItem(CLAVE_USUARIO_ESQUEMA)
        if (guardado && !data.personas.some((p) => p.tiene_config && p.id === guardado)) {
          window.localStorage.removeItem(CLAVE_USUARIO_ESQUEMA)
          setUsuarioId('')
        }
      })
      .catch(() => {
        if (!cancelado) setConfigPersonas(null)
      })
    return () => {
      cancelado = true
    }
  }, [])

  function cambiarUsuario(valor: string) {
    setUsuarioId(valor)
    if (valor) window.localStorage.setItem(CLAVE_USUARIO_ESQUEMA, valor)
    else window.localStorage.removeItem(CLAVE_USUARIO_ESQUEMA)
  }

  const cargarDatos = useCallback(async () => {
    setCargando(true)
    setError('')
    setSinConfigurar(false)

    const paramsTipos = parametrosBase(proyecto, usuarioId)
    const paramsArbol = parametrosBase(proyecto, usuarioId)
    paramsArbol.set('limite', String(LIMITE_ARBOL))
    if (tiposSeleccionados.length > 0) paramsArbol.set('tipos', tiposSeleccionados.join(','))
    if (areaPath.trim()) paramsArbol.set('area_path', areaPath.trim())
    if (iteracionPath) paramsArbol.set('iteration_path', iteracionPath)

    const paramsProyectos = new URLSearchParams()
    paramsProyectos.set('target', TARGET_AZURE)
    if (usuarioId) paramsProyectos.set('usuario_id', usuarioId)

    try {
      const [respProyectos, respTipos, respArbol] = await Promise.allSettled([
        client.get<AzdoProyecto[]>(`/azdo/proyectos?${paramsProyectos.toString()}`),
        client.get<RespuestaTiposAzure>(`/azdo/esquema/tipos?${paramsTipos.toString()}`),
        client.get<RespuestaEsquemaAzure>(`/azdo/esquema/arbol?${paramsArbol.toString()}`),
      ])

      // Un 400 de configuración global afecta a las tres llamadas: mostramos el aviso
      // de "integración no configurada" y no seguimos procesando el resto.
      const rechazos = [respProyectos, respTipos, respArbol]
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map((r) => r.reason)
      const errorConfig = rechazos.find(
        (err) =>
          estadoHttp(err) === 400 &&
          /organizaci[oó]n|pat|proyecto|configur/i.test(mensajeError(err)),
      )
      if (errorConfig) {
        setSinConfigurar(true)
        setRespuesta(null)
        setProyectos([])
        setTipos([])
        setJerarquia([])
        return
      }

      // 1) Proyectos: si resuelve, rellena siempre el desplegable aunque el resto falle.
      if (respProyectos.status === 'fulfilled') {
        setProyectos(respProyectos.value.data)
      }

      // 2) Tipos y jerarquía: si resuelve, se rellenan; si falla, quedan vacíos sin bloquear la vista.
      if (respTipos.status === 'fulfilled') {
        setTipos(respTipos.value.data.tipos)
        setJerarquia(respTipos.value.data.jerarquia)
      } else {
        setTipos([])
        setJerarquia([])
      }

      // 3) Árbol: si falla, mostramos el mensaje del backend tal cual, dejando el
      //    desplegable de proyectos operativo para que el usuario elija otro y reintente.
      if (respArbol.status === 'fulfilled') {
        setRespuesta(respArbol.value.data)
        setExpandidos(new Set(respArbol.value.data.nodos.map((nodo) => nodo.azdo_id)))

        const proyectoApi =
          respArbol.value.data.proyecto ||
          (respTipos.status === 'fulfilled' ? respTipos.value.data.proyecto : '')
        if (!proyecto && proyectoApi) setProyecto(proyectoApi)
      } else {
        setRespuesta(null)
        setError(mensajeError(respArbol.reason))
      }
    } finally {
      setCargando(false)
    }
  }, [areaPath, iteracionPath, proyecto, tiposSeleccionados, usuarioId])

  useEffect(() => {
    const temporizador = window.setTimeout(() => {
      void cargarDatos()
    }, 300)
    return () => window.clearTimeout(temporizador)
  }, [cargarDatos])

  useEffect(() => {
    if (!proyecto) {
      setIteraciones([])
      return
    }

    const params = parametrosBase(proyecto, usuarioId)
    client
      .get<AzdoIteracion[]>(`/azdo/iteraciones?${params.toString()}`)
      .then((resp) => setIteraciones(resp.data))
      .catch(() => setIteraciones([]))
  }, [proyecto, usuarioId])

  useEffect(() => {
    if (busqueda.trim()) setExpandidos(new Set(idsDelArbol(nodosFiltrados)))
  }, [busqueda, nodosFiltrados])

  function cambiarProyecto(valor: string) {
    setProyecto(valor)
    setTiposSeleccionados([])
    setIteracionPath('')
  }

  function alternarNodo(id: number) {
    setExpandidos((actual) => {
      const siguiente = new Set(actual)
      if (siguiente.has(id)) siguiente.delete(id)
      else siguiente.add(id)
      return siguiente
    })
  }

  function expandirTodo() {
    setExpandidos(new Set(idsDelArbol(nodosFiltrados)))
  }

  function colapsarTodo() {
    setExpandidos(new Set())
  }

  return (
    <div className="space-y-5">
      <EncabezadoPagina
        icono={<Icono nombre="nube" />}
        titulo="Esquema de Azure"
        descripcion={`${proyectoMostrado} · ${resumen}${personaSeleccionada ? ` · Usando la configuración de ${personaSeleccionada.nombre}` : ''}`}
        acciones={(
          <Boton variante="secundario" onClick={() => void cargarDatos()} disabled={cargando} icono={<Icono nombre="recargar" />}>
            {cargando ? 'Cargando…' : 'Recargar'}
          </Boton>
        )}
      />

      <div className="mx-auto max-w-[1600px] space-y-5 px-4 sm:px-6">
        {puedeElegir && (
          <div className="flex items-end gap-3">
            <Selector
              etiqueta="Configuración (PAT)"
              value={usuarioId}
              onChange={(evento) => cambiarUsuario(evento.target.value)}
              disabled={personasConConfig.length === 0}
              className="min-w-64"
              compacto
            >
              {personasConConfig.length === 0 ? (
                <option value="">Sin configuraciones personales</option>
              ) : (
                <>
                  <option value="">Configuración global</option>
                  {personasConConfig.map((persona) => (
                    <option key={persona.id} value={persona.id}>
                      {persona.nombre}{persona.email ? ` (${persona.email})` : ''}
                    </option>
                  ))}
                </>
              )}
            </Selector>
            {personaSeleccionada && (
              <span className="pb-2 text-xs font-medium text-marca">
                Usando la configuración de {personaSeleccionada.nombre}
              </span>
            )}
          </div>
        )}

        <FiltrosEsquemaAzure
          proyectos={proyectos}
          proyecto={proyecto}
          tipos={tipos}
          tiposSeleccionados={tiposSeleccionados}
          areaPath={areaPath}
          iteraciones={iteraciones}
          iteracionPath={iteracionPath}
          busqueda={busqueda}
          cargando={cargando}
          onProyecto={cambiarProyecto}
          onTipos={setTiposSeleccionados}
          onAreaPath={setAreaPath}
          onIteracionPath={setIteracionPath}
          onBusqueda={setBusqueda}
          onRecargar={() => void cargarDatos()}
        />

        {sinConfigurar && (
          <Aviso tono="alerta">
            La integración HITSS de Azure DevOps no está configurada. Revisa organización, PAT y proyecto en{' '}
            <Link to="/azure-devops" className="font-semibold underline">Azure DevOps</Link>.
          </Aviso>
        )}

        {error && (
          <Aviso tono="error" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {error}
              {proyectos.length > 0 && (
                <span className="mt-1 block text-sm font-normal">Selecciona otro proyecto para reintentar.</span>
              )}
            </span>
            <Boton variante="peligro-suave" tamano="sm" onClick={() => void cargarDatos()}>Reintentar</Boton>
          </Aviso>
        )}

        {respuesta?.truncado && (
          <Aviso tono="alerta">
            Se alcanzó el límite de {LIMITE_ARBOL} work items. Afina los filtros para confirmar que ves todo el esquema.
          </Aviso>
        )}

        {cargando && !respuesta && !sinConfigurar && !error && <VistaCargando />}

        {!cargando && !sinConfigurar && !error && respuesta && (
          <>
            <PanelJerarquia jerarquia={jerarquia} />

            {respuesta.filtrado_por_squad && (
              <Aviso tono="info" className="text-sm">
                <span title={detalleIteracionesAplicadas}>
                  Vista limitada a las iteraciones configuradas para el squad: {totalIteracionesAplicadas}{' '}
                  {totalIteracionesAplicadas === 1 ? 'ruta aplicada' : 'rutas aplicadas'}.
                </span>
              </Aviso>
            )}

            {nodosFiltrados.length === 0 ? (
              <Tarjeta>
                <div className="py-10 text-center text-sm text-slate-500">
                  {mensajeArbolVacio(nodos.length === 0, respuesta.filtrado_por_squad)}
                </div>
              </Tarjeta>
            ) : (
              <ArbolEsquemaAzure
                nodos={nodosFiltrados}
                tipos={tipos}
                expandidos={expandidos}
                onAlternar={alternarNodo}
                onExpandirTodo={expandirTodo}
                onColapsarTodo={colapsarTodo}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
