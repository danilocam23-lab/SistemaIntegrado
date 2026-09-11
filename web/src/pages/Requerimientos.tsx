import { useState } from 'react'
import client from '../api/client'
import { mensajeError } from '../api/hooks'
import { useAuth } from '../context/AuthContext'
import type { EstimacionConResumen } from '../types'
import { TablaScroll } from '../components/ui/primitivos'
import type { ClaveSeccionResumen } from './requerimientos/tipos'
import {
  agruparPorHU,
  complexityColor,
  formatDateTime,
  formatNumber,
  sortEntries,
  taskTypeColor,
} from './requerimientos/utilidades'
import { useCamposRequerimientos } from './requerimientos/useCamposRequerimientos'
import { useDatosRequerimientos } from './requerimientos/useDatosRequerimientos'
import { useFiltrosRequerimientos } from './requerimientos/useFiltrosRequerimientos'
import { PanelFiltrosRequerimientos } from './requerimientos/PanelFiltrosRequerimientos'
import { BarraAccionesRequerimientos } from './requerimientos/BarraAccionesRequerimientos'
import { useAccesoresRequerimiento } from './requerimientos/useAccesoresRequerimiento'
import { useExportarExcel } from './requerimientos/useExportarExcel'
import { useEscriturasRequerimientos } from './requerimientos/useEscriturasRequerimientos'
import { crearRenderCelda } from './requerimientos/CeldaEditable'
import { useEstimaciones } from './requerimientos/useEstimaciones'
import { useCargaEstimacion } from './requerimientos/useCargaEstimacion'
import { TablaRequerimientos } from './requerimientos/TablaRequerimientos'

export default function Requerimientos() {
  const { tienePermiso } = useAuth()
  const puedeEditar = tienePermiso('requerimientos.editar')
  const puedeEliminar = tienePermiso('requerimientos.eliminar')
  const puedeCrear = tienePermiso('requerimientos.crear')
  const puedeExportar = tienePermiso('requerimientos.exportar')
  const puedeGestionarEstimaciones = tienePermiso('requerimientos.editar')
  const {
    datos, error, recargar,
    estadosReq, estadosEnt,
    personas,
    configuracion,
    squadPorId, personaPorId, categoriaPorId,
    nombrePersona,
  } = useDatosRequerimientos()

  const { columnasActivas, filtrosActivos, exportCamposActivos, columnasExtra, coreVisibleCount, metricasVisibles, totalColumnasTabla } =
    useCamposRequerimientos(configuracion)

  const {
    filtros, setFiltros, mostrarFiltros, setMostrarFiltros, hayFiltrosActivos, datosFiltrados,
    squadsDisponibles, lideresDisponibles, categoriasDisponibles, tipificacionesDisponibles, tiposCostoDisponibles,
  } = useFiltrosRequerimientos(datos, personas, squadPorId, categoriaPorId)

  const { CAMPO_ACCESOR_REQ } = useAccesoresRequerimiento(squadPorId, categoriaPorId, personaPorId, nombrePersona)
  const { exportarExcel } = useExportarExcel(puedeExportar, exportCamposActivos, datosFiltrados, CAMPO_ACCESOR_REQ)

  const [aviso, setAviso] = useState('')

  const { editValue, setEditValue, iniciarEdicionCelda, guardarCelda, handleKeyDown, isEditing, eliminar } =
    useEscriturasRequerimientos(puedeEditar, puedeEliminar, recargar, setAviso)
  const renderCelda = crearRenderCelda({
    editValue, setEditValue, guardarCelda, handleKeyDown, isEditing, iniciarEdicionCelda, puedeEditar, estadosReq, personas,
  })

  const { estimacionIds, estimacionesMap, expandedReqs, loadingReqEst, refreshEstimacionIds, toggleExpandReq } =
    useEstimaciones(datos)

  const [estModalReqId, setEstModalReqId] = useState<string | null>(null)
  const [estData, setEstData] = useState<EstimacionConResumen | null>(null)
  const [estLoading, setEstLoading] = useState(false)
  const [creatingTasks, setCreatingTasks] = useState<'hitss' | 'epm' | null>(null)
  const [expandedSections, setExpandedSections] = useState<Record<ClaveSeccionResumen, boolean>>({ type: true, sprint: false, complexity: false })
  const [expandedHUs, setExpandedHUs] = useState<Set<string>>(new Set())
  const [expandedEntregas, setExpandedEntregas] = useState<Set<string>>(new Set())

  async function openEstimationModal(reqId: string): Promise<void> {
    setEstModalReqId(reqId)
    setEstLoading(true)
    setEstData(null)
    setExpandedSections({ type: true, sprint: false, complexity: false })
    try {
      const r = await client.get<EstimacionConResumen>(`/estimaciones/por-requerimiento/${reqId}`)
      setEstData(r.data)
    } catch {
      setEstData({ exists: false, estimacion: null, summary: null })
    } finally {
      setEstLoading(false)
    }
  }

  const { fileInputRef, uploadingId, handleUploadClick, handleFileSelected } =
    useCargaEstimacion(puedeGestionarEstimaciones, setAviso, refreshEstimacionIds, openEstimationModal)

  async function handleCreateTasks(org: 'hitss' | 'epm'): Promise<void> {
    if (!puedeGestionarEstimaciones) return
    if (!estData?.estimacion) return
    setAviso('')
    setCreatingTasks(org)
    try {
      const r = await client.post<EstimacionConResumen & { creadas: number; errores: string[] }>(
        `/estimaciones/${estData.estimacion.id}/crear-tareas-${org}`,
      )
      setEstData({ exists: true, estimacion: r.data.estimacion, summary: r.data.summary })
      const partes = [`${r.data.creadas} tareas creadas en ${org.toUpperCase()}`]
      if (r.data.errores?.length) partes.push(`${r.data.errores.length} con error`)
      setAviso(partes.join(' · '))
    } catch (err) {
      setAviso(mensajeError(err))
    } finally {
      setCreatingTasks(null)
    }
  }

  async function deleteEstimation(): Promise<void> {
    if (!puedeGestionarEstimaciones) return
    if (!estData?.estimacion) return
    setAviso('')
    try {
      await client.delete(`/estimaciones/${estData.estimacion.id}`)
      setEstModalReqId(null)
      setEstData(null)
      await refreshEstimacionIds()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  function toggleSection(key: ClaveSeccionResumen): void {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function toggleHU(key: string): void {
    setExpandedHUs((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const reqSeleccionado = estModalReqId ? datos.find((req) => req.id === estModalReqId) ?? null : null
  const estimacion = estData?.estimacion ?? null
  const summary = estData?.summary

  return (
    <div>
      <BarraAccionesRequerimientos
        puedeCrear={puedeCrear}
        puedeExportar={puedeExportar}
        mostrarFiltros={mostrarFiltros}
        setMostrarFiltros={setMostrarFiltros}
        hayFiltrosActivos={hayFiltrosActivos}
        exportarDeshabilitado={datosFiltrados.length === 0}
        onExportar={exportarExcel}
      />

      {(aviso || error) && (
        <div className="aviso aviso-error mb-3">{aviso || error}</div>
      )}

      {/* Panel de filtros */}
      {mostrarFiltros && (
        <PanelFiltrosRequerimientos
          filtros={filtros}
          setFiltros={setFiltros}
          hayFiltrosActivos={hayFiltrosActivos}
          filtrosActivos={filtrosActivos}
          estadosReq={estadosReq}
          estadosEnt={estadosEnt}
          squadsDisponibles={squadsDisponibles}
          lideresDisponibles={lideresDisponibles}
          categoriasDisponibles={categoriasDisponibles}
          tipificacionesDisponibles={tipificacionesDisponibles}
          tiposCostoDisponibles={tiposCostoDisponibles}
        />
      )}

      <TablaRequerimientos
        datosFiltrados={datosFiltrados}
        hayFiltrosActivos={hayFiltrosActivos}
        columnasActivas={columnasActivas}
        columnasExtra={columnasExtra}
        coreVisibleCount={coreVisibleCount}
        metricasVisibles={metricasVisibles}
        totalColumnasTabla={totalColumnasTabla}
        expandedReqs={expandedReqs}
        estimacionIds={estimacionIds}
        estimacionesMap={estimacionesMap}
        loadingReqEst={loadingReqEst}
        toggleExpandReq={toggleExpandReq}
        expandedEntregas={expandedEntregas}
        setExpandedEntregas={setExpandedEntregas}
        renderCelda={renderCelda}
        squadPorId={squadPorId}
        nombrePersona={nombrePersona}
        CAMPO_ACCESOR_REQ={CAMPO_ACCESOR_REQ}
        uploadingId={uploadingId}
        puedeGestionarEstimaciones={puedeGestionarEstimaciones}
        handleUploadClick={handleUploadClick}
        openEstimationModal={openEstimationModal}
        puedeEditar={puedeEditar}
        puedeEliminar={puedeEliminar}
        eliminar={eliminar}
      />

      {estModalReqId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onClick={() => setEstModalReqId(null)}>
          <div className="flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-cyan-50 p-2 text-cyan-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <h2 className="titulo-seccion truncate">
                      Estimación — {reqSeleccionado?.codigo_req ?? estModalReqId} — {reqSeleccionado?.nombre ?? 'Sin nombre'}
                    </h2>
                    <p className="truncate text-sm text-slate-600">
                      {estimacion?.archivo ?? 'Sin archivo'} · Subido {formatDateTime(estimacion?.subido_en ?? estimacion?.fecha_estimacion)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {puedeGestionarEstimaciones && (
                  <>
                    <button
                      onClick={() => { void handleCreateTasks('hitss') }}
                      disabled={!estData?.estimacion || creatingTasks !== null}
                      title="Crear tareas en Azure DevOps HITSS"
                      className="btn btn-secundario items-center gap-1"
                    >
                      {creatingTasks === 'hitss' ? (
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" />
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                        </svg>
                      )}
                      Crear tareas HITSS
                    </button>
                    <button
                      onClick={() => { void handleCreateTasks('epm') }}
                      disabled={!estData?.estimacion || creatingTasks !== null}
                      title="Crear tareas en Azure DevOps EPM"
                      className="btn btn-secundario items-center gap-1"
                    >
                      {creatingTasks === 'epm' ? (
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-purple-200 border-t-purple-600" />
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      )}
                      Crear tareas EPM
                    </button>
                    <div className="mx-1 h-5 w-px bg-slate-200" />
                    <button onClick={() => handleUploadClick(estModalReqId)} className="btn btn-secundario">
                      Reemplazar
                    </button>
                    <button onClick={() => { void deleteEstimation() }} disabled={!estimacion} className="btn btn-peligro">
                      Eliminar
                    </button>
                  </>
                )}
                <button onClick={() => setEstModalReqId(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800" title="Cerrar">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
              {estLoading ? (
                <div className="flex h-64 items-center justify-center">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-100 border-t-cyan-600" />
                </div>
              ) : !estData?.exists || !estimacion ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
                  No hay una estimación disponible para este requerimiento.
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid gap-4 lg:grid-cols-[2fr,1fr,1fr]">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-1">
                      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Información general</p>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-slate-400">Título</p>
                          <p className="text-sm font-semibold text-slate-900">{estimacion.titulo || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Cliente</p>
                          <p className="text-sm font-semibold text-slate-900">{estimacion.cliente || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Iniciativa</p>
                          <p className="text-sm font-semibold text-slate-900">{estimacion.iniciativa || '—'}</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:col-span-2 lg:grid-cols-4">
                      <div className="rounded-2xl border border-cyan-100 bg-white p-5 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-600">Total tareas</p>
                        <p className="mt-3 text-3xl font-bold text-slate-900">{formatNumber(estimacion.total_filas)}</p>
                      </div>
                      <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Horas estimadas</p>
                        <p className="mt-3 text-3xl font-bold text-slate-900">{formatNumber(estimacion.total_horas_estimadas)}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Promedio (hrs)</p>
                        <p className="mt-3 text-3xl font-bold text-slate-900">{formatNumber(estimacion.total_promedio)}</p>
                      </div>
                      <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Total +10% (hrs)</p>
                        <p className="mt-3 text-3xl font-bold text-slate-900">{formatNumber(estimacion.total_horas_finales)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <section className="tarjeta overflow-hidden">
                      <button onClick={() => toggleSection('type')} className="flex w-full items-center justify-between px-5 py-4 text-left">
                        <div>
                          <h3 className="font-semibold text-slate-900">Resumen por Tipo de Tarea</h3>
                          <p className="text-sm text-slate-600">Agrupado por tipo de actividad</p>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-slate-400 transition-transform ${expandedSections.type ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {expandedSections.type && (
                        <TablaScroll plano className="border-t border-slate-200">
                          <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 text-slate-600">
                              <tr>
                                <th className="px-4 py-3 text-left">Tipo</th>
                                <th className="px-4 py-3 text-right">Tareas</th>
                                <th className="px-4 py-3 text-right">Hrs Est.</th>
                                <th className="px-4 py-3 text-right">Mejor</th>
                                <th className="px-4 py-3 text-right">Peor</th>
                                <th className="px-4 py-3 text-right">Promedio</th>
                                <th className="px-4 py-3 text-right">Total+10%</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sortEntries(Object.entries(summary?.byType ?? {})).map(([key, value]) => (
                                <tr key={key} className="border-t border-slate-100">
                                  <td className="px-4 py-3 font-medium text-slate-900">{key}</td>
                                  <td className="px-4 py-3 text-right text-slate-700">{formatNumber(value.count)}</td>
                                  <td className="px-4 py-3 text-right text-slate-700">{formatNumber(value.estimated)}</td>
                                  <td className="px-4 py-3 text-right text-slate-700">{formatNumber(value.best)}</td>
                                  <td className="px-4 py-3 text-right text-slate-700">{formatNumber(value.worst)}</td>
                                  <td className="px-4 py-3 text-right text-slate-700">{formatNumber(value.average)}</td>
                                  <td className="px-4 py-3 text-right font-semibold text-emerald-600">{formatNumber(value.total)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </TablaScroll>
                      )}
                    </section>

                    <section className="tarjeta overflow-hidden">
                      <button onClick={() => toggleSection('sprint')} className="flex w-full items-center justify-between px-5 py-4 text-left">
                        <div>
                          <h3 className="font-semibold text-slate-900">Resumen por Sprint</h3>
                          <p className="text-sm text-slate-600">Distribución estimada por sprint</p>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-slate-400 transition-transform ${expandedSections.sprint ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {expandedSections.sprint && (
                        <TablaScroll plano className="border-t border-slate-200">
                          <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 text-slate-600">
                              <tr>
                                <th className="px-4 py-3 text-left">Sprint</th>
                                <th className="px-4 py-3 text-right">Tareas</th>
                                <th className="px-4 py-3 text-right">Hrs Est.</th>
                                <th className="px-4 py-3 text-right">Mejor</th>
                                <th className="px-4 py-3 text-right">Peor</th>
                                <th className="px-4 py-3 text-right">Promedio</th>
                                <th className="px-4 py-3 text-right">Total+10%</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sortEntries(Object.entries(summary?.bySprint ?? {})).map(([key, value]) => (
                                <tr key={key} className="border-t border-slate-100">
                                  <td className="px-4 py-3 font-medium text-slate-900">{key}</td>
                                  <td className="px-4 py-3 text-right text-slate-700">{formatNumber(value.count)}</td>
                                  <td className="px-4 py-3 text-right text-slate-700">{formatNumber(value.estimated)}</td>
                                  <td className="px-4 py-3 text-right text-slate-700">{formatNumber(value.best)}</td>
                                  <td className="px-4 py-3 text-right text-slate-700">{formatNumber(value.worst)}</td>
                                  <td className="px-4 py-3 text-right text-slate-700">{formatNumber(value.average)}</td>
                                  <td className="px-4 py-3 text-right font-semibold text-emerald-600">{formatNumber(value.total)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </TablaScroll>
                      )}
                    </section>

                    <section className="tarjeta overflow-hidden">
                      <button onClick={() => toggleSection('complexity')} className="flex w-full items-center justify-between px-5 py-4 text-left">
                        <div>
                          <h3 className="font-semibold text-slate-900">Resumen por Complejidad</h3>
                          <p className="text-sm text-slate-600">Consolidado por nivel de complejidad</p>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-slate-400 transition-transform ${expandedSections.complexity ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {expandedSections.complexity && (
                        <TablaScroll plano className="border-t border-slate-200">
                          <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 text-slate-600">
                              <tr>
                                <th className="px-4 py-3 text-left">Complejidad</th>
                                <th className="px-4 py-3 text-right">Tareas</th>
                                <th className="px-4 py-3 text-right">Hrs Est.</th>
                                <th className="px-4 py-3 text-right">Promedio</th>
                                <th className="px-4 py-3 text-right">Total+10%</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sortEntries(Object.entries(summary?.byComplexity ?? {})).map(([key, value]) => (
                                <tr key={key} className="border-t border-slate-100">
                                  <td className="px-4 py-3 font-medium text-slate-900">{key}</td>
                                  <td className="px-4 py-3 text-right text-slate-700">{formatNumber(value.count)}</td>
                                  <td className="px-4 py-3 text-right text-slate-700">{formatNumber(value.estimated)}</td>
                                  <td className="px-4 py-3 text-right text-slate-700">{formatNumber(value.average)}</td>
                                  <td className="px-4 py-3 text-right font-semibold text-emerald-600">{formatNumber(value.total)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </TablaScroll>
                      )}
                    </section>
                  </div>

                  <section className="tarjeta overflow-hidden">
                    <div className="border-b border-slate-200 px-5 py-4">
                      <h3 className="font-semibold text-slate-900">
                        Detalle por Historia de Usuario ({agruparPorHU(estimacion.filas).length} HU · {estimacion.filas.length} tareas)
                      </h3>
                      <p className="text-sm text-slate-600">Haz clic en una fila para expandir y ver las tareas individuales</p>
                    </div>
                    <TablaScroll plano>
                      <table className="min-w-[1100px] text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                          <tr>
                            <th className="w-8 px-2 py-3"></th>
                            <th className="px-4 py-3 text-left">Historia de Usuario</th>
                            <th className="px-4 py-3 text-left">Épica/Feature</th>
                            <th className="px-4 py-3 text-center">Tareas</th>
                            <th className="px-4 py-3 text-right">Hrs Est.</th>
                            <th className="px-4 py-3 text-right">Total+10%</th>
                            <th className="px-4 py-3 text-center">IDs Creados</th>
                          </tr>
                        </thead>
                        <tbody>
                          {agruparPorHU(estimacion.filas).map((grupo) => {
                            const isOpen = expandedHUs.has(grupo.key)
                            return (
                              <>{/* Fila maestra (HU) */}
                                <tr
                                  key={grupo.key}
                                  onClick={() => toggleHU(grupo.key)}
                                  className="cursor-pointer border-t border-slate-200 bg-white hover:bg-cyan-50/50 transition-colors"
                                >
                                  <td className="px-2 py-3 text-center">
                                    <svg xmlns="http://www.w3.org/2000/svg"
                                      className={`mx-auto h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-slate-900">{grupo.historia_usuario}</span>
                                      {grupo.createdHU && (
                                        <span className="rounded bg-cyan-100 px-1.5 py-0.5 text-[10px] font-mono text-cyan-700">
                                          HU #{grupo.createdHU}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-slate-600">{grupo.epica_feature}</td>
                                  <td className="px-4 py-3 text-center">
                                    <span className="inline-flex items-center justify-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                                      {grupo.filas.length}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatNumber(grupo.totalHorasEstimadas)}</td>
                                  <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatNumber(grupo.totalHorasFinales)}</td>
                                  <td className="px-4 py-3 text-center whitespace-nowrap">
                                    <div className="flex items-center justify-center gap-1 flex-wrap">
                                      {grupo.createdTasks.length > 0 && (
                                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-mono text-emerald-700">
                                          {grupo.createdTasks.length} tasks HITSS
                                        </span>
                                      )}
                                      {grupo.createdTasksEpm.length > 0 && (
                                        <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-mono text-purple-700">
                                          {grupo.createdTasksEpm.length} tasks EPM
                                        </span>
                                      )}
                                      {grupo.createdTasks.length === 0 && grupo.createdTasksEpm.length === 0 && !grupo.createdHU && (
                                        <span className="text-[10px] text-slate-400">—</span>
                                      )}
                                    </div>
                                  </td>
                                </tr>

                                {/* Filas detalle (tareas) */}
                                {isOpen && grupo.filas.map((fila, idx) => (
                                  <tr key={`${grupo.key}-${fila.numero ?? idx}`} className="border-t border-slate-100 bg-slate-50/60">
                                    <td className="px-2 py-2"></td>
                                    <td colSpan={2} className="px-4 py-2">
                                      <div className="flex items-center gap-2 pl-4">
                                        <span className="text-slate-400 text-xs font-mono">{fila.numero ?? idx + 1}.</span>
                                        <span className="text-slate-700">{fila.actividad || '—'}</span>
                                        <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: taskTypeColor(fila.tipo_tarea) }}>
                                          {fila.tipo_tarea || '—'}
                                        </span>
                                        {fila.complejidad && (
                                          <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: complexityColor(fila.complejidad) }}>
                                            {fila.complejidad}
                                          </span>
                                        )}
                                        {fila.sprint != null && (
                                          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
                                            Sprint {fila.sprint}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-2 text-center text-slate-500 text-xs">—</td>
                                    <td className="px-4 py-2 text-right text-slate-700">{formatNumber(fila.horas_estimadas)}</td>
                                    <td className="px-4 py-2 text-right text-emerald-600">{formatNumber(fila.horas_totales || fila.metodologia_10)}</td>
                                    <td className="px-4 py-2 text-center whitespace-nowrap">
                                      <div className="flex items-center justify-center gap-1">
                                        {fila.created_task_hitss ? (
                                          <span title={`Tarea HITSS #${fila.created_task_hitss}`}
                                            className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-mono text-emerald-700">
                                            #{fila.created_task_hitss}
                                          </span>
                                        ) : null}
                                        {fila.created_task_epm ? (
                                          <span title={`Tarea EPM #${fila.created_task_epm}`}
                                            className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-mono text-purple-700">
                                            #{fila.created_task_epm}
                                          </span>
                                        ) : null}
                                        {!fila.created_task_hitss && !fila.created_task_epm ? (
                                          <span className="text-[10px] text-slate-400">—</span>
                                        ) : null}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </>
                            )
                          })}
                        </tbody>
                      </table>
                    </TablaScroll>
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { void handleFileSelected(e) }} />
    </div>
  )
}
