import { useCallback, useEffect, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAplicacion } from '../context/AplicacionContext'
import { useAuth } from '../context/AuthContext'
import { TablaScroll } from '../components/ui/primitivos'
import { claseBadgeEstado } from './asignaciones/estados'
import type { AsignacionItem } from './asignaciones/tipos'
import { FormularioAsignacion } from './asignaciones/FormularioAsignacion'
import { useDatosAsignaciones } from './asignaciones/useDatosAsignaciones'
import { useDerivadosAsignaciones } from './asignaciones/useDerivadosAsignaciones'
import { useEscriturasAsignaciones } from './asignaciones/useEscriturasAsignaciones'
import { useFormularioAsignacion } from './asignaciones/useFormularioAsignacion'
import { useWorkOrdersPorPersona } from './asignaciones/useWorkOrdersPorPersona'

export default function Asignaciones() {
  const { asignaciones, personas, categorias, requerimientos, configuraciones, capacidades, error, recargar } =
    useDatosAsignaciones()
  const { modoConsolidado, activa } = useAplicacion()
  const { tienePermiso } = useAuth()
  const { wosPorPersonaMap } = useWorkOrdersPorPersona(personas)

  const puedeEditarAsignaciones = tienePermiso('asignaciones.editar')

  const [aviso, setAviso] = useState('')
  const [gruposExpandidos, setGruposExpandidos] = useState<Set<string | null>>(new Set())
  const [filtroEstado, setFiltroEstado] = useState<string>('__todos__')
  const [filtroPersona, setFiltroPersona] = useState<string>('__todos__')
  const [busquedaPersona, setBusquedaPersona] = useState('')
  const [vistaActiva, setVistaActiva] = useState<'actas' | 'personas'>('actas')
  const [personasExpandidas, setPersonasExpandidas] = useState<Set<string>>(new Set())

  const {
    personasDisponibles,
    personaPorId,
    categoriaPorId,
    reqIdsActivos,
    opcionesReq,
    etiquetaReq,
    capacidadUsada,
    calcularPctSugerido,
    gruposReq,
    estadosUnicos,
    gruposFiltrados,
    gruposPorPersona,
  } = useDerivadosAsignaciones({
    asignaciones,
    personas,
    categorias,
    requerimientos,
    configuraciones,
    capacidades,
    wosPorPersonaMap,
    filtroEstado,
    filtroPersona,
    busquedaPersona,
  })

  const formulario = useFormularioAsignacion({
    opcionesReq,
    requerimientos,
    etiquetaReq,
    calcularPctSugerido,
    activa,
    modoConsolidado,
    puedeEditar: puedeEditarAsignaciones,
    setAviso,
  })

  const escrituras = useEscriturasAsignaciones({
    asignaciones,
    requerimientos,
    reqIdsActivos,
    capacidadUsada,
    activa,
    puedeEditar: puedeEditarAsignaciones,
    setAviso,
    recargar,
    formulario,
    etiquetaReq,
  })

  useEffect(() => {
    setGruposExpandidos(new Set(gruposReq.map((grupo) => grupo.reqId)))
  }, [gruposReq])

  const abrirEdicion = useCallback((asig: AsignacionItem) => {
    escrituras.cancelarEdicionInline()
    formulario.abrirEdicion(asig)
  }, [escrituras, formulario])

  const alternarGrupo = useCallback((reqId: string | null) => {
    setGruposExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(reqId)) next.delete(reqId)
      else next.add(reqId)
      return next
    })
  }, [])

  const onReqHeaderClick = useCallback((event: ReactMouseEvent<HTMLButtonElement>, reqId: string | null) => {
    event.preventDefault()
    alternarGrupo(reqId)
  }, [alternarGrupo])

  return (
    <div>
      <h1 className="titulo-pagina mb-4">Asignaciones de carga</h1>

      {puedeEditarAsignaciones && (
        <FormularioAsignacion
          form={formulario}
          onSubmit={formulario.modoEdicion ? escrituras.actualizar : escrituras.crear}
          categorias={categorias}
          personasDisponibles={personasDisponibles}
          puedeEditar={puedeEditarAsignaciones}
        />
      )}

      {modoConsolidado && !formulario.requerimientoId && !formulario.modoEdicion && (
        <div className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          {'Modo consolidado: selecciona un requerimiento para crear la asignación en la aplicación correcta.'}
        </div>
      )}

      {(aviso || error) && (
        <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{aviso || error}</div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex items-center gap-1 rounded-lg border bg-slate-100 p-1 w-fit">
        <button type="button" onClick={() => setVistaActiva('actas')}
          className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${vistaActiva === 'actas' ? 'bg-white text-marca shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
          Por Actas / Requerimientos
        </button>
        <button type="button" onClick={() => setVistaActiva('personas')}
          className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${vistaActiva === 'personas' ? 'bg-white text-marca shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
          Por Personas
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-600">Filtrar por estado del requerimiento:</label>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="campo campo-sm"
          >
            <option value="__todos__">Todos</option>
            {estadosUnicos.map((estado) => (
              <option key={estado} value={estado}>{estado}</option>
            ))}
            <option value="__sin_estado__">Sin estado</option>
          </select>
          {filtroEstado !== '__todos__' && (
            <button
              type="button"
              onClick={() => setFiltroEstado('__todos__')}
              className="enlace-accion-sutil"
            >
              Limpiar ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-600">Buscar persona:</label>
          <input
            type="text"
            value={busquedaPersona}
            onChange={(e) => setBusquedaPersona(e.target.value)}
            placeholder="Nombre de la persona…"
            className="campo campo-sm w-56"
          />
          <select
            value={filtroPersona}
            onChange={(e) => setFiltroPersona(e.target.value)}
            className="campo campo-sm"
          >
            <option value="__todos__">Todas</option>
            {personasDisponibles.map((persona) => (
              <option key={persona.id} value={persona.id}>{persona.nombre}</option>
            ))}
          </select>
          {(filtroPersona !== '__todos__' || busquedaPersona) && (
            <button
              type="button"
              onClick={() => { setFiltroPersona('__todos__'); setBusquedaPersona('') }}
              className="enlace-accion-sutil"
            >
              Limpiar ✕
            </button>
          )}
        </div>
      </div>

      {vistaActiva === 'actas' && (
      <div className="space-y-4">
        {gruposFiltrados.map((grupo) => {
          const expandido = gruposExpandidos.has(grupo.reqId)
          return (
            <section key={grupo.reqId ?? 'sin-requerimiento'} className="tarjeta overflow-hidden">
              <div className="flex items-center justify-between gap-3 bg-marca-osc px-4 py-3 text-white">
                <button
                  type="button"
                  onClick={(event) => onReqHeaderClick(event, grupo.reqId)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="text-sm">{expandido ? '▼' : '▶'}</span>
                  <span className="truncate text-sm font-semibold">{grupo.reqLabel}</span>
                  {grupo.reqId && (() => {
                    if (!grupo.horasEstimadas) return null
                    const horasReales = grupo.horasEstimadas * 0.9
                    return (
                      <div className="ml-4 flex shrink-0 items-center gap-4 border-l border-white/30 pl-4 text-xs font-medium">
                        <div>
                          <div className="text-white/70">Horas est.</div>
                          <div>{grupo.horasEstimadas.toFixed(1)} h</div>
                        </div>
                        <div>
                          <div className="text-white/70">Horas reales (90%)</div>
                          <div>{horasReales.toFixed(1)} h</div>
                        </div>
                      </div>
                    )
                  })()}
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  {grupo.reqId && (
                    <Link
                      to={`/requerimientos/${grupo.reqId}`}
                      className="rounded-full bg-white/10 px-2 py-1 text-xs font-medium text-white hover:bg-white/20"
                    >
                      Ver req
                    </Link>
                  )}
                  <span className={`chip ${claseBadgeEstado(grupo.reqEstado)}`}>
                    {grupo.reqEstado ?? 'Sin estado'}
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-medium text-white">
                    {grupo.items.length} asignación{grupo.items.length === 1 ? '' : 'es'}
                  </span>
                </div>
              </div>

              {expandido && (
                <TablaScroll plano>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700">
                        <th className="p-3 text-left">Persona</th>
                        <th className="p-3 text-left">Categoría</th>
                        <th className="p-3 text-center">Prioridad</th>
                        <th className="p-3 text-right">% carga</th>
                        <th className="p-3 text-right">Horas según carga</th>
                        <th className="p-3 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grupo.items.map(({ asig, horasCarga }) => {
                        const enEdicionInline = escrituras.edicionInlineId === asig.id
                        return (
                          <tr key={asig.id} className={`border-t ${formulario.editandoAsig?.id === asig.id ? 'bg-amber-50' : ''}`}>
                            <td className="p-3">{personaPorId.get(asig.persona_id)?.nombre ?? asig.persona_id}</td>
                            <td className="p-3">{categoriaPorId.get(asig.categoria_id)?.nombre ?? asig.categoria_id}</td>
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={asig.prioridad === true}
                                onChange={() => void escrituras.cambiarPrioridad(asig)}
                                title="Marcar como prioridad"
                                className={`h-4 w-4 accent-marca ${puedeEditarAsignaciones ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                                disabled={!puedeEditarAsignaciones}
                              />
                            </td>
                            <td className="p-3 text-right font-medium">
                              {enEdicionInline ? (
                                <input
                                  autoFocus
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={escrituras.edicionInlineValor}
                                  onChange={(e) => escrituras.setEdicionInlineValor(e.target.value)}
                                  onBlur={() => void escrituras.guardarEdicionInline(asig)}
                                  onKeyDown={escrituras.onInlineKeyDown}
                                  className="campo campo-sm w-20 text-right"
                                />
                              ) : (
                                <span className="inline-flex items-center gap-1">
                                  <span className={asig.total_porcentaje === 0 ? 'text-red-500' : ''}>
                                    {asig.total_porcentaje}%
                                  </span>
                                  {puedeEditarAsignaciones && (
                                    <button
                                      type="button"
                                      onClick={() => escrituras.iniciarEdicionInline(asig)}
                                      title="Editar %"
                                      className="text-slate-400 hover:text-marca"
                                    >
                                      ✎
                                    </button>
                                  )}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right text-slate-700">{horasCarga.toFixed(1)} h</td>
                            <td className="p-3 text-center whitespace-nowrap">
                              {puedeEditarAsignaciones && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => abrirEdicion(asig)}
                                    className="mr-3 text-xs text-marca hover:underline"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void escrituras.eliminar(asig)}
                                    className="text-xs text-red-600 hover:underline"
                                  >
                                    Eliminar
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </TablaScroll>
              )}
            </section>
          )
        })}

        {gruposFiltrados.length === 0 && (
          <div className="tarjeta p-6 text-center text-sm text-slate-400">
            {filtroEstado !== '__todos__' ? 'No hay asignaciones con ese estado de requerimiento.' : 'Sin asignaciones.'}
          </div>
        )}
      </div>
      )}

      {vistaActiva === 'personas' && (
      <div className="space-y-4">
        {gruposPorPersona.map((gp) => {
          const expandida = personasExpandidas.has(gp.persona.id)
          const totalHoras = gp.reqs.reduce((s, r) => s + r.horasCarga, 0)
          return (
            <section key={gp.persona.id} className="tarjeta overflow-hidden">
              <div className="flex items-center justify-between gap-3 bg-marca-osc px-4 py-3 text-white">
                <button
                  type="button"
                  onClick={() => setPersonasExpandidas((prev) => {
                    const n = new Set(prev)
                    if (n.has(gp.persona.id)) n.delete(gp.persona.id); else n.add(gp.persona.id)
                    return n
                  })}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="text-sm">{expandida ? '▼' : '▶'}</span>
                  <span className="truncate text-sm font-semibold">{gp.persona.nombre}</span>
                  <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-xs">{gp.reqs.length} asignaciones</span>
                  <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-xs">{totalHoras.toFixed(0)}h carga</span>
                  {(wosPorPersonaMap.get(gp.persona.id)?.length ?? 0) > 0 && (
                    <span className="shrink-0 rounded-full bg-emerald-400/30 px-2 py-0.5 text-xs">{wosPorPersonaMap.get(gp.persona.id)!.length} WO</span>
                  )}
                </button>
              </div>
              {expandida && (
                <div className="space-y-0">
                  <TablaScroll plano>
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-3 py-2">Requerimiento</th>
                          <th className="px-3 py-2">Estado</th>
                          <th className="px-3 py-2">Categoría</th>
                          <th className="px-3 py-2 text-right">%</th>
                          <th className="px-3 py-2 text-right">Horas carga</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gp.reqs.map((r, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="px-3 py-2 font-medium">{r.reqLabel}</td>
                            <td className="px-3 py-2">
                              {r.reqEstado && <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${claseBadgeEstado(r.reqEstado)}`}>{r.reqEstado}</span>}
                            </td>
                            <td className="px-3 py-2">{categoriaPorId.get(r.asig.categoria_id)?.nombre ?? '—'}</td>
                            <td className="px-3 py-2 text-right">{r.asig.total_porcentaje}%</td>
                            <td className="px-3 py-2 text-right font-mono">{r.horasCarga.toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TablaScroll>
                  {(wosPorPersonaMap.get(gp.persona.id)?.length ?? 0) > 0 && (
                    <div className="border-t bg-emerald-50/50 px-3 py-2">
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Solicitudes Soporte WO ({wosPorPersonaMap.get(gp.persona.id)!.length})</p>
                      <TablaScroll plano>
                        <table className="w-full text-left text-xs">
                          <thead className="text-emerald-700">
                            <tr>
                              <th className="px-2 py-1">WO ID</th>
                              <th className="px-2 py-1">Estado</th>
                              <th className="px-2 py-1">Prioridad</th>
                              <th className="px-2 py-1">Fecha</th>
                              <th className="px-2 py-1">Descripción</th>
                            </tr>
                          </thead>
                          <tbody>
                            {wosPorPersonaMap.get(gp.persona.id)!.map((wo) => (
                              <tr key={wo.id} className="border-t border-emerald-100">
                                <td className="px-2 py-1 font-mono font-medium">{wo.wo_id}</td>
                                <td className="px-2 py-1">{wo.status}</td>
                                <td className="px-2 py-1">{wo.priority}</td>
                                <td className="px-2 py-1">{wo.created_date}</td>
                                <td className="px-2 py-1 max-w-[200px] truncate">{wo.descripcion}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </TablaScroll>
                    </div>
                  )}
                </div>
              )}
            </section>
          )
        })}
        {gruposPorPersona.length === 0 && (
          <div className="tarjeta p-6 text-center text-sm text-slate-400">
            Sin asignaciones para mostrar.
          </div>
        )}
      </div>
      )}
    </div>
  )
}
