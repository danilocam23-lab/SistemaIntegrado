import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client'
import { mensajeError } from '../api/hooks'
import { Aviso, Boton, EncabezadoPagina, Icono, Tarjeta } from '../components/ui'
import type {
  AzdoIteracion,
  AzdoProyecto,
  NivelJerarquiaAzure,
  RespuestaEsquemaAzure,
  RespuestaTiposAzure,
  TipoWorkItemAzure,
} from '../types'
import { ArbolEsquemaAzure } from './esquema-azure/ArbolEsquemaAzure'
import { FiltrosEsquemaAzure } from './esquema-azure/FiltrosEsquemaAzure'
import { PanelJerarquia } from './esquema-azure/PanelJerarquia'
import { contarPorTipo, filtrarArbol, idsDelArbol, resumenConteo } from './esquema-azure/utilidades'

const TARGET_AZURE = 'hitss'
const LIMITE_ARBOL = 2000

function estadoHttp(error: unknown): number | undefined {
  return (error as { response?: { status?: number } }).response?.status
}

function parametrosBase(proyecto: string): URLSearchParams {
  const params = new URLSearchParams()
  params.set('target', TARGET_AZURE)
  if (proyecto.trim()) params.set('proyecto', proyecto.trim())
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

  const nodos = respuesta?.nodos ?? []
  const nodosFiltrados = useMemo(() => filtrarArbol(nodos, busqueda), [nodos, busqueda])
  const conteo = useMemo(() => contarPorTipo(nodos), [nodos])
  const resumen = useMemo(() => resumenConteo(conteo), [conteo])
  const proyectoMostrado = respuesta?.proyecto || proyecto || 'Proyecto Azure DevOps'

  const cargarDatos = useCallback(async () => {
    setCargando(true)
    setError('')
    setSinConfigurar(false)

    const paramsTipos = parametrosBase(proyecto)
    const paramsArbol = parametrosBase(proyecto)
    paramsArbol.set('limite', String(LIMITE_ARBOL))
    if (tiposSeleccionados.length > 0) paramsArbol.set('tipos', tiposSeleccionados.join(','))
    if (areaPath.trim()) paramsArbol.set('area_path', areaPath.trim())
    if (iteracionPath) paramsArbol.set('iteration_path', iteracionPath)

    try {
      const [respProyectos, respTipos, respArbol] = await Promise.all([
        client.get<AzdoProyecto[]>(`/azdo/proyectos?target=${TARGET_AZURE}`),
        client.get<RespuestaTiposAzure>(`/azdo/esquema/tipos?${paramsTipos.toString()}`),
        client.get<RespuestaEsquemaAzure>(`/azdo/esquema/arbol?${paramsArbol.toString()}`),
      ])

      setProyectos(respProyectos.data)
      setTipos(respTipos.data.tipos)
      setJerarquia(respTipos.data.jerarquia)
      setRespuesta(respArbol.data)
      setExpandidos(new Set(respArbol.data.nodos.map((nodo) => nodo.azdo_id)))

      const proyectoApi = respArbol.data.proyecto || respTipos.data.proyecto
      if (!proyecto && proyectoApi) setProyecto(proyectoApi)
    } catch (err) {
      const mensaje = mensajeError(err)
      if (estadoHttp(err) === 400 && /organizaci[oó]n|pat|proyecto|configur/i.test(mensaje)) {
        setSinConfigurar(true)
        setRespuesta(null)
      } else {
        setError(mensaje)
      }
    } finally {
      setCargando(false)
    }
  }, [areaPath, iteracionPath, proyecto, tiposSeleccionados])

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

    const params = parametrosBase(proyecto)
    client
      .get<AzdoIteracion[]>(`/azdo/iteraciones?${params.toString()}`)
      .then((resp) => setIteraciones(resp.data))
      .catch(() => setIteraciones([]))
  }, [proyecto])

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
        descripcion={`${proyectoMostrado} · ${resumen}`}
        acciones={(
          <Boton variante="secundario" onClick={() => void cargarDatos()} disabled={cargando} icono={<Icono nombre="recargar" />}>
            {cargando ? 'Cargando…' : 'Recargar'}
          </Boton>
        )}
      />

      <div className="mx-auto max-w-[1600px] space-y-5 px-4 sm:px-6">
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
            <span>{error}</span>
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

            {nodosFiltrados.length === 0 ? (
              <Tarjeta>
                <div className="py-10 text-center text-sm text-slate-500">
                  {nodos.length === 0
                    ? 'El proyecto no devolvió work items con esos filtros.'
                    : 'No hay coincidencias por título o ID en el árbol cargado.'}
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
