import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client'
import { mensajeError } from '../api/hooks'
import { useAuth } from '../context/AuthContext'
import type { Estimacion, EstimacionConResumen } from '../types'
import { TablaScroll } from '../components/ui/primitivos'
import type { ClaveSeccionResumen } from './requerimientos/tipos'
import {
  agruparPorHU,
  calcularDiasTranscurridos,
  complexityColor,
  formatDateTime,
  formatNumber,
  normalizarAns,
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

  const [estimacionIds, setEstimacionIds] = useState<Set<string>>(new Set())
  const [estimacionesMap, setEstimacionesMap] = useState<Record<string, Estimacion>>({})
  const [expandedReqs, setExpandedReqs] = useState<Set<string>>(new Set())
  const [loadingReqEst, setLoadingReqEst] = useState<Set<string>>(new Set())
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [estModalReqId, setEstModalReqId] = useState<string | null>(null)
  const [estData, setEstData] = useState<EstimacionConResumen | null>(null)
  const [estLoading, setEstLoading] = useState(false)
  const [creatingTasks, setCreatingTasks] = useState<'hitss' | 'epm' | null>(null)
  const [expandedSections, setExpandedSections] = useState<Record<ClaveSeccionResumen, boolean>>({ type: true, sprint: false, complexity: false })
  const [expandedHUs, setExpandedHUs] = useState<Set<string>>(new Set())
  const [expandedEntregas, setExpandedEntregas] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadTargetRef = useRef<string | null>(null)

  useEffect(() => {
    refreshEstimacionIds().catch(() => {})
  }, [datos])

  async function refreshEstimacionIds(): Promise<void> {
    const r = await client.get<Estimacion[]>('/estimaciones')
    const ids = new Set(r.data.filter((e) => e.requerimiento_id).map((e) => e.requerimiento_id!))
    setEstimacionIds(ids)
  }

  async function toggleExpandReq(reqId: string): Promise<void> {
    if (expandedReqs.has(reqId)) {
      setExpandedReqs((prev) => { const n = new Set(prev); n.delete(reqId); return n })
      return
    }
    setExpandedReqs((prev) => new Set(prev).add(reqId))
    if (estimacionesMap[reqId]) return
    setLoadingReqEst((prev) => new Set(prev).add(reqId))
    try {
      const r = await client.get<EstimacionConResumen>(`/estimaciones/por-requerimiento/${reqId}`)
      if (r.data.exists && r.data.estimacion) {
        setEstimacionesMap((prev) => ({ ...prev, [reqId]: r.data.estimacion! }))
      }
    } catch { /* sin estimación */ }
    finally { setLoadingReqEst((prev) => { const n = new Set(prev); n.delete(reqId); return n }) }
  }

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

  function handleUploadClick(reqId: string): void {
    if (!puedeGestionarEstimaciones) return
    uploadTargetRef.current = reqId
    fileInputRef.current?.click()
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    if (!puedeGestionarEstimaciones) return
    const file = e.target.files?.[0]
    if (!file || !uploadTargetRef.current) return
    const reqId = uploadTargetRef.current
    e.target.value = ''

    setAviso('')
    setUploadingId(reqId)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      let binary = ''
      for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
      const base64 = btoa(binary)

      await client.post(`/estimaciones/upload/${reqId}`, {
        file_base64: base64,
        file_name: file.name,
      })

      await refreshEstimacionIds()
      await openEstimationModal(reqId)
    } catch (err) {
      setAviso(mensajeError(err))
    } finally {
      setUploadingId(null)
      uploadTargetRef.current = null
    }
  }

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

      <TablaScroll>
        <table className="text-sm">
          <thead className="bg-marca-osc text-white">
            <tr>
              <th className="w-8 p-2"></th>
              {columnasActivas.has('codigoReq') && <th className="p-2 text-left">Código REQ</th>}
              {columnasActivas.has('sc') && <th className="p-2 text-left">SC</th>}
              {columnasActivas.has('squad') && <th className="p-2 text-left">Squad</th>}
              {columnasActivas.has('nombreActa') && <th className="p-2 text-left">Nombre de acta</th>}
              {columnasActivas.has('aplicacionEpm') && <th className="p-2 text-left">Aplicación EPM</th>}
              {columnasActivas.has('estado') && <th className="p-2 text-left">Estado</th>}
              {columnasActivas.has('ansEstimacion') && <th className="p-2 text-center">ANS Estimación</th>}
              {columnasActivas.has('ltHitss') && <th className="p-2 text-left">Líder técnico</th>}
              {columnasActivas.has('scrum') && <th className="p-2 text-left">Scrum</th>}
              {columnasActivas.has('horas') && <th className="p-2 text-right">Horas</th>}
              {columnasActivas.has('fechaSolicitud') && <th className="p-2 text-center">F. Solicitud</th>}
              {columnasActivas.has('fechaLimite') && <th className="p-2 text-center">F. Límite</th>}
              {columnasActivas.has('fechaReal') && <th className="p-2 text-center">F. Real</th>}
              {columnasActivas.has('diasTranscurridos') && <th className="p-2 text-right">Días transcurridos</th>}
              {columnasActivas.has('entregasCount') && <th className="p-2 text-center">Entregas</th>}
              <th className="p-2 text-center">Est.</th>
              {columnasExtra.map((c) => (
                <th key={c.key} className="p-2 text-left whitespace-nowrap">{c.label}</th>
              ))}
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {datosFiltrados.map((req) => {
              const isExpanded = expandedReqs.has(req.id)
              const hasEst = estimacionIds.has(req.id)
              const estCargada = estimacionesMap[req.id]
              const grupos = estCargada ? agruparPorHU(estCargada.filas) : []
              return (
                <React.Fragment key={req.id}>{/* Fila principal del requerimiento */}
                  <tr key={req.id} className={`border-t ${isExpanded ? 'bg-cyan-50/30' : ''}`}>
                    <td className="p-2 text-center">
                      {hasEst ? (
                        <button onClick={() => { void toggleExpandReq(req.id) }} className="p-0.5 text-slate-400 hover:text-cyan-600">
                          {loadingReqEst.has(req.id) ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-transparent border-t-cyan-500" />
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg"
                              className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          )}
                        </button>
                      ) : null}
                    </td>
                    {columnasActivas.has('codigoReq') && (
                    <td className="p-2 font-mono">
                      <Link to={`/requerimientos/${req.id}`} className="enlace-accion">
                        {req.codigo_req}
                      </Link>
                    </td>
                    )}
                    {columnasActivas.has('sc') && (
                    <td className="p-2">{renderCelda(req, 'codigo_sc', req.solicitud?.codigo_sc ?? '')}</td>
                    )}
                    {columnasActivas.has('squad') && (
                    <td className="p-2 text-xs text-slate-600">
                      {req.solicitud?.squad_id ? (squadPorId.get(String(req.solicitud.squad_id)) ?? String(req.solicitud.squad_id)) : '—'}
                    </td>
                    )}
                    {columnasActivas.has('nombreActa') && (
                    <td className="p-2">{renderCelda(req, 'nombre', req.nombre ?? '')}</td>
                    )}
                    {columnasActivas.has('aplicacionEpm') && (
                    <td className="p-2 text-xs text-slate-600">
                      {req.nombre ? req.nombre.split('-')[0].trim() : '—'}
                    </td>
                    )}
                    {columnasActivas.has('estado') && (
                    <td className="p-2">{renderCelda(req, 'estado', req.estado, 'select')}</td>
                    )}
                    {columnasActivas.has('ansEstimacion') && (
                    <td className="p-2 text-center">
                      {(() => {
                        const v = (req.ans_acta ?? '').trim().toUpperCase().replace(/[_-]+/g, ' ')
                        if (!v) return <span className="text-slate-400">—</span>
                        const clase = v === 'CUMPLE' ? 'bg-emerald-100 text-emerald-700'
                          : v === 'NO CUMPLE' ? 'bg-red-100 text-red-700'
                          : 'bg-slate-100 text-slate-600'
                        const label = normalizarAns(req.ans_acta)
                        return (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${clase}`}>
                            {label}
                          </span>
                        )
                      })()}
                    </td>
                    )}
                    {columnasActivas.has('ltHitss') && (
                    <td className="p-2">{renderCelda(req, 'lt_hitss_id', nombrePersona(req.solicitud?.lt_hitss_id ?? null), 'select-persona', 'LT_HITSS')}</td>
                    )}
                    {columnasActivas.has('scrum') && (
                    <td className="p-2">{renderCelda(req, 'scrum_id', nombrePersona(req.solicitud?.scrum_id ?? null), 'select-persona', 'SCRUM')}</td>
                    )}
                    {columnasActivas.has('horas') && (
                    <td className="p-2 text-right">{renderCelda(req, 'total_horas_estimadas', req.total_horas_estimadas != null ? String(req.total_horas_estimadas) : '', 'number')}</td>
                    )}
                    {columnasActivas.has('fechaSolicitud') && (
                    <td className="p-2 text-center text-xs">
                      {req.fecha_solicitud_acta
                        ? req.fecha_solicitud_acta.slice(0, 10)
                        : <span className="text-slate-400">—</span>}
                    </td>
                    )}
                    {columnasActivas.has('fechaLimite') && (
                    <td className="p-2 text-center text-xs">
                      {req.fecha_limite
                        ? req.fecha_limite.slice(0, 10)
                        : <span className="text-slate-400">—</span>}
                    </td>
                    )}
                    {columnasActivas.has('fechaReal') && (
                    <td className="p-2 text-center text-xs">
                      {req.fecha_real_entrega_estimacion
                        ? req.fecha_real_entrega_estimacion.slice(0, 10)
                        : <span className="text-slate-400">—</span>}
                    </td>
                    )}
                    {columnasActivas.has('diasTranscurridos') && (
                    <td className="p-2 text-right">
                      {(() => {
                        const result = calcularDiasTranscurridos(req.fecha_limite, req.fecha_real_entrega_estimacion)
                        if (!result) return '—'
                        const color = result.esNegativo ? 'text-red-600 font-semibold' : 'text-emerald-600'
                        return (
                          <span className={color}>
                            {result.esNegativo ? '-' : '+'}{result.dias}
                          </span>
                        )
                      })()}
                    </td>
                    )}
                    {columnasActivas.has('entregasCount') && (
                    <td className="p-2 text-center">
                      {(req.entregas?.length ?? 0) > 0 ? (
                        <button
                          onClick={() => setExpandedEntregas(prev => {
                            const next = new Set(prev)
                            next.has(req.id) ? next.delete(req.id) : next.add(req.id)
                            return next
                          })}
                          className="btn btn-exito btn-sm items-center gap-1"
                          title="Ver entregas"
                        >
                          {req.entregas.length}
                          <svg xmlns="http://www.w3.org/2000/svg"
                            className={`h-3 w-3 transition-transform ${expandedEntregas.has(req.id) ? 'rotate-90' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    )}
                    <td className="p-2 text-center">
                      {hasEst ? (
                        <button onClick={() => { void openEstimationModal(req.id) }} title="Ver estimación"
                          className="rounded p-0.5 text-cyan-600 hover:text-cyan-800">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </button>
                      ) : uploadingId === req.id ? (
                        <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-transparent border-t-amber-500" />
                      ) : puedeGestionarEstimaciones ? (
                        <button onClick={() => handleUploadClick(req.id)} title="Cargar estimación (Excel)"
                          className="rounded p-0.5 text-slate-400 hover:text-cyan-600">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17h6m-6-4h6m-6-4h3" />
                          </svg>
                        </button>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    {columnasExtra.map((c) => (
                      <td key={c.key} className="p-2 text-xs text-slate-600 whitespace-nowrap">
                        {(() => {
                          const v = CAMPO_ACCESOR_REQ[c.key]?.(req)
                          return v != null && v !== '' ? v : <span className="text-slate-400">—</span>
                        })()}
                      </td>
                    ))}
                    <td className="p-2 text-center whitespace-nowrap">
                      {(puedeEditar || puedeEliminar) && (
                        <>
                          {puedeEditar && (
                            <Link to={`/requerimientos/${req.id}`} className="enlace-accion text-xs mr-2">
                              Editar
                            </Link>
                          )}
                          {puedeEliminar && (
                            <button onClick={() => { void eliminar(req) }} className="enlace-accion enlace-accion-peligro text-xs">
                              Eliminar
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>

                  {/* Sub-fila: detalle de entregas */}
                  {expandedEntregas.has(req.id) && req.entregas?.length > 0 && (
                    <tr key={`${req.id}-entregas`}>
                      <td colSpan={totalColumnasTabla} className="p-0">
                        <div className="border-l-4 border-emerald-400 bg-emerald-50/40 px-4 py-2">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-slate-500">
                                <th className="px-3 py-1.5 text-left font-semibold"># Entrega</th>
                                <th className="px-3 py-1.5 text-right font-semibold">Horas</th>
                                <th className="px-3 py-1.5 text-center font-semibold">Fecha comprometida</th>
                                <th className="px-3 py-1.5 text-center font-semibold">Fecha recepción</th>
                                <th className="px-3 py-1.5 text-center font-semibold">Estado</th>
                                <th className="px-3 py-1.5 text-center font-semibold">Garantía</th>
                              </tr>
                            </thead>
                            <tbody>
                              {req.entregas.map((en) => (
                                <tr key={en.numero} className="border-t border-emerald-200 hover:bg-white/60">
                                  <td className="px-3 py-1.5 font-medium text-slate-800">
                                    <span className="text-emerald-500">▸</span> Entrega {en.numero}
                                  </td>
                                  <td className="px-3 py-1.5 text-right">{en.horas ?? '—'}</td>
                                  <td className="px-3 py-1.5 text-center">{en.fecha_comprometida ?? '—'}</td>
                                  <td className="px-3 py-1.5 text-center">{en.fecha_recepcion ?? '—'}</td>
                                  <td className="px-3 py-1.5 text-center">
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                      en.estado === 'Aprobada' ? 'bg-green-100 text-green-700' :
                                      en.estado === 'En revisión' ? 'bg-amber-100 text-amber-700' :
                                      en.estado === 'Rechazada' ? 'bg-red-100 text-red-700' :
                                      'bg-slate-100 text-slate-600'
                                    }`}>
                                      {en.estado ?? '—'}
                                    </span>
                                  </td>
                                  <td className="px-3 py-1.5 text-center">{en.garantia ? '✔' : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Filas detalle: Historias de Usuario agrupadas */}
                  {isExpanded && grupos.length > 0 && (
                    <tr key={`${req.id}-hu`}>
                      <td colSpan={totalColumnasTabla} className="p-0">
                        <div className="border-l-4 border-cyan-400 bg-slate-50 px-4 py-2">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-slate-500">
                                <th className="px-3 py-1.5 text-left font-semibold">Historia de Usuario</th>
                                <th className="px-3 py-1.5 text-left font-semibold">Épica/Feature</th>
                                <th className="px-3 py-1.5 text-center font-semibold">Tareas</th>
                                <th className="px-3 py-1.5 text-right font-semibold">Hrs Est.</th>
                                <th className="px-3 py-1.5 text-right font-semibold">Total+10%</th>
                                <th className="px-3 py-1.5 text-center font-semibold">IDs Creados</th>
                              </tr>
                            </thead>
                            <tbody>
                              {grupos.map((g) => (
                                <tr key={g.key} className="border-t border-slate-200 hover:bg-white/60">
                                  <td className="px-3 py-2 font-medium text-slate-800">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-cyan-500">▸</span>
                                      {g.historia_usuario}
                                      {g.createdHU && (
                                        <span className="rounded bg-cyan-100 px-1 py-0.5 text-[9px] font-mono text-cyan-700">
                                          HU #{g.createdHU}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 text-slate-600">{g.epica_feature}</td>
                                  <td className="px-3 py-2 text-center">
                                    <span className="inline-flex items-center justify-center rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                                      {g.filas.length}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-right font-semibold text-slate-800">{formatNumber(g.totalHorasEstimadas)}</td>
                                  <td className="px-3 py-2 text-right font-bold text-emerald-600">{formatNumber(g.totalHorasFinales)}</td>
                                  <td className="px-3 py-2 text-center whitespace-nowrap">
                                    <div className="flex items-center justify-center gap-1 flex-wrap">
                                      {g.createdTasks.length > 0 && (
                                        <span className="rounded bg-emerald-100 px-1 py-0.5 text-[9px] font-mono text-emerald-700">
                                          {g.createdTasks.length} HITSS
                                        </span>
                                      )}
                                      {g.createdTasksEpm.length > 0 && (
                                        <span className="rounded bg-purple-100 px-1 py-0.5 text-[9px] font-mono text-purple-700">
                                          {g.createdTasksEpm.length} EPM
                                        </span>
                                      )}
                                      {g.createdTasks.length === 0 && g.createdTasksEpm.length === 0 && !g.createdHU && (
                                        <span className="text-slate-400">—</span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="border-t-2 border-slate-300 bg-white/80">
                                <td className="px-3 py-2 font-bold text-slate-700">Total</td>
                                <td className="px-3 py-2"></td>
                                <td className="px-3 py-2 text-center font-bold text-slate-700">
                                  {estCargada?.filas.length ?? 0}
                                </td>
                                <td className="px-3 py-2 text-right font-bold text-slate-900">
                                  {formatNumber(grupos.reduce((s, g) => s + g.totalHorasEstimadas, 0))}
                                </td>
                                <td className="px-3 py-2 text-right font-bold text-emerald-700">
                                  {formatNumber(grupos.reduce((s, g) => s + g.totalHorasFinales, 0))}
                                </td>
                                <td className="px-3 py-2"></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                  {isExpanded && !estCargada && !loadingReqEst.has(req.id) && (
                    <tr key={`${req.id}-empty`}>
                      <td colSpan={totalColumnasTabla} className="border-l-4 border-slate-300 bg-slate-50 px-6 py-3 text-center text-xs text-slate-400">
                        Sin datos de estimación para este requerimiento.
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
            {datosFiltrados.length === 0 && (
              <tr><td colSpan={totalColumnasTabla} className="p-4 text-center text-slate-400">
                {hayFiltrosActivos ? 'Sin resultados con los filtros aplicados.' : 'Sin requerimientos.'}
              </td></tr>
            )}
          </tbody>
          {datosFiltrados.length > 0 && (() => {
            const totalHoras = datosFiltrados.reduce((s, r) => s + (r.total_horas_estimadas ?? 0), 0)
            const totalEntregas = datosFiltrados.reduce((s, r) => s + (r.entregas?.length ?? 0), 0)
            // Label ocupa todas las columnas activas no numéricas (lead + Est. + extras + acciones vacía).
            const leadCount = coreVisibleCount - metricasVisibles.length + columnasExtra.length + 1
            return (
              <tfoot>
                <tr className="border-t-2 border-marca-osc bg-slate-50 font-semibold text-slate-700 text-sm">
                  <td className="p-2"></td>
                  <td className="p-2" colSpan={leadCount}>Total ({datosFiltrados.length} requerimientos)</td>
                  {columnasActivas.has('horas') && <td className="p-2 text-right">{totalHoras.toLocaleString('es-CO')}</td>}
                  {columnasActivas.has('entregasCount') && <td className="p-2 text-center">{totalEntregas}</td>}
                  <td className="p-2"></td>
                </tr>
              </tfoot>
            )
          })()}
        </table>
      </TablaScroll>

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
