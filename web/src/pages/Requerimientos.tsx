import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as XLSX from 'xlsx'
import client from '../api/client'
import { mensajeError, useLista, useEstados } from '../api/hooks'
import { useAuth } from '../context/AuthContext'
import type { Aplicacion, Estimacion, EstimacionConResumen, FilaEstimacion, Persona, Requerimiento, Squad } from '../types'

export default function Requerimientos() {
  const { usuario } = useAuth()
  const esSuperadmin = usuario?.rol === 'superadmin'
  const { datos, error, recargar } = useLista<Requerimiento>('/requerimientos')
  const { estadosReq, estadosEnt } = useEstados()
  const { datos: personas } = useLista<Persona>('/personas')
  // Aplicaciones: fuente principal de nombre de squad (squad_id = codigo de app)
  const { datos: aplicaciones } = useLista<Aplicacion>('/aplicaciones')

  // Squads de la colección squads (para registros importados con _id numérico)
  const [squadsCol, setSquadsCol] = useState<Squad[]>([])
  useEffect(() => {
    client.get<Squad[]>('/squads', { headers: { 'X-Aplicacion': '__todas__' } })
      .then((r) => setSquadsCol(r.data))
      .catch(() => {
        client.get<Squad[]>('/squads').then((r) => setSquadsCol(r.data)).catch(() => {})
      })
  }, [])

  const [aviso, setAviso] = useState('')
  const [estimacionIds, setEstimacionIds] = useState<Set<string>>(new Set())
  const [estimacionesMap, setEstimacionesMap] = useState<Record<string, Estimacion>>({})
  const [expandedReqs, setExpandedReqs] = useState<Set<string>>(new Set())
  const [loadingReqEst, setLoadingReqEst] = useState<Set<string>>(new Set())
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [estModalReqId, setEstModalReqId] = useState<string | null>(null)
  const [estData, setEstData] = useState<EstimacionConResumen | null>(null)
  const [estLoading, setEstLoading] = useState(false)
  const [creatingTasks, setCreatingTasks] = useState<'hitss' | 'epm' | null>(null)
  const [expandedSections, setExpandedSections] = useState({ type: true, sprint: false, complexity: false })
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
    uploadTargetRef.current = reqId
    fileInputRef.current?.click()
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
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

  function toggleSection(key: 'type' | 'sprint' | 'complexity'): void {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function taskTypeColor(tipo: string | null): string {
    switch (tipo?.toUpperCase()) {
      case 'DESARROLLO': return '#22c55e'
      case 'PRUEBAS': return '#f97316'
      case 'DESPLIEGUE': return '#3b82f6'
      case 'ESTABILIZACION': return '#6b7280'
      default: return '#94a3b8'
    }
  }

  function complexityColor(cx: string | null): string {
    switch (cx?.toLowerCase()) {
      case 'bajo': return '#22c55e'
      case 'medio': return '#f59e0b'
      case 'alto': return '#ef4444'
      default: return '#94a3b8'
    }
  }

  function formatNumber(value: number | null | undefined): string {
    const num = Number(value ?? 0)
    if (!Number.isFinite(num)) return '0'
    return num.toLocaleString('es-CO', { maximumFractionDigits: 2 })
  }

  function formatDateTime(value: string | null | undefined): string {
    if (!value) return 'Sin fecha'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
  }

  function sortEntries<T>(entries: Array<[string, T]>): Array<[string, T]> {
    return [...entries].sort(([a], [b]) => {
      const numA = Number(a)
      const numB = Number(b)
      if (!Number.isNaN(numA) && !Number.isNaN(numB)) return numA - numB
      return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' })
    })
  }

  function toggleHU(key: string): void {
    setExpandedHUs((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  interface GrupoHU {
    key: string
    historia_usuario: string
    epica_feature: string
    filas: FilaEstimacion[]
    totalHorasEstimadas: number
    totalHorasFinales: number
    totalMejor: number
    totalPeor: number
    totalPromedio: number
    createdHU: number | null
    createdTasks: number[]
    createdTasksEpm: number[]
  }

  function agruparPorHU(filas: FilaEstimacion[]): GrupoHU[] {
    const mapa = new Map<string, GrupoHU>()
    for (const fila of filas) {
      const key = fila.historia_usuario || `__sin_hu_${fila.numero ?? Math.random()}`
      let grupo = mapa.get(key)
      if (!grupo) {
        grupo = {
          key,
          historia_usuario: fila.historia_usuario || 'Sin Historia de Usuario',
          epica_feature: fila.epica_feature || '—',
          filas: [],
          totalHorasEstimadas: 0,
          totalHorasFinales: 0,
          totalMejor: 0,
          totalPeor: 0,
          totalPromedio: 0,
          createdHU: null,
          createdTasks: [],
          createdTasksEpm: [],
        }
        mapa.set(key, grupo)
      }
      grupo.filas.push(fila)
      grupo.totalHorasEstimadas += fila.horas_estimadas ?? 0
      grupo.totalHorasFinales += fila.horas_totales ?? fila.metodologia_10 ?? 0
      grupo.totalMejor += fila.mejor_caso ?? 0
      grupo.totalPeor += fila.peor_caso ?? 0
      grupo.totalPromedio += fila.promedio ?? 0
      if (fila.created_hu_hitss) grupo.createdHU = fila.created_hu_hitss
      if (fila.created_task_hitss) grupo.createdTasks.push(fila.created_task_hitss)
      if (fila.created_task_epm) grupo.createdTasksEpm.push(fila.created_task_epm)
    }
    return Array.from(mapa.values())
  }

  // Filtros
  interface Filtros {
    codigoReq: string
    sc: string
    squad: string
    estado: string
    liderTecnico: string
    fechaSolicitudDesde: string
    fechaSolicitudHasta: string
    fechaComprometidaDesde: string
    fechaComprometidaHasta: string
    fechaLimiteDesde: string
    fechaLimiteHasta: string
    estadoEntrega: string
  }
  const FILTROS_INIT: Filtros = {
    codigoReq: '', sc: '', squad: '', estado: '', liderTecnico: '',
    fechaSolicitudDesde: '', fechaSolicitudHasta: '',
    fechaComprometidaDesde: '', fechaComprometidaHasta: '',
    fechaLimiteDesde: '', fechaLimiteHasta: '',
    estadoEntrega: '',
  }
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INIT)
  const [mostrarFiltros, setMostrarFiltros] = useState(false)

  // Edición inline por celda
  const [editCell, setEditCell] = useState<{ id: string; campo: string } | null>(null)
  const [editValue, setEditValue] = useState('')

  function iniciarEdicionCelda(req: Requerimiento, campo: string): void {
    let valor = ''
    switch (campo) {
      case 'codigo_sc': valor = req.solicitud?.codigo_sc ?? ''; break
      case 'nombre': valor = req.nombre ?? ''; break
      case 'estado': valor = req.estado; break
      case 'lt_hitss_id': valor = req.solicitud?.lt_hitss_id ?? ''; break
      case 'scrum_id': valor = req.solicitud?.scrum_id ?? ''; break
      case 'total_horas_estimadas': valor = req.total_horas_estimadas != null ? String(req.total_horas_estimadas) : ''; break
      case 'cantidad_entregas': valor = String(req.cantidad_entregas ?? 0); break
    }
    setEditCell({ id: req.id, campo })
    setEditValue(valor)
  }

  async function guardarCelda(req: Requerimiento): Promise<void> {
    setAviso('')
    const campo = editCell?.campo
    if (!campo) return

    try {
      const payload: any = {}
      if (campo === 'codigo_sc' || campo === 'lt_hitss_id' || campo === 'scrum_id') {
        payload.solicitud = { ...req.solicitud, [campo]: editValue || null }
      } else if (campo === 'total_horas_estimadas') {
        payload.total_horas_estimadas = editValue ? Number(editValue) : null
      } else if (campo === 'cantidad_entregas') {
        payload.cantidad_entregas = editValue ? Number(editValue) : 0
      } else if (campo === 'nombre') {
        payload.nombre = editValue || null
      } else if (campo === 'estado') {
        payload.estado = editValue
      }

      await client.put(`/requerimientos/${req.id}`, payload)
      setEditCell(null)
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  function handleKeyDown(e: React.KeyboardEvent, req: Requerimiento): void {
    if (e.key === 'Enter') { guardarCelda(req) }
    else if (e.key === 'Escape') { setEditCell(null) }
  }

  async function eliminar(req: Requerimiento): Promise<void> {
    if (!window.confirm(`¿Eliminar el requerimiento ${req.codigo_req}? Esta acción no se puede deshacer.`)) return
    setAviso('')
    try {
      await client.delete(`/requerimientos/${req.id}`, {
        headers: { 'X-Aplicacion': req.aplicacion_id },
      })
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  const nombrePersona = (id: string | null): string =>
    id ? (personas.find((p) => p.id === id)?.nombre ?? id) : '—'

  const isEditing = (reqId: string, campo: string): boolean =>
    editCell?.id === reqId && editCell?.campo === campo

  function renderCelda(req: Requerimiento, campo: string, displayValue: string, type?: 'select' | 'select-persona' | 'number', rolFiltro?: string): JSX.Element {
    if (isEditing(req.id, campo)) {
      if (type === 'select') {
        return (
          <select value={editValue} onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => guardarCelda(req)} autoFocus
            className="w-full rounded border px-2 py-1 text-xs">
            {estadosReq.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )
      }
      if (type === 'select-persona') {
        const lista = rolFiltro ? personas.filter((p) => p.rol_operativo === rolFiltro) : personas
        return (
          <select value={editValue} onChange={(e) => { setEditValue(e.target.value) }}
            onBlur={() => guardarCelda(req)} autoFocus
            className="w-full rounded border px-2 py-1 text-xs">
            <option value="">—</option>
            {lista.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        )
      }
      return (
        <input value={editValue} onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => guardarCelda(req)} onKeyDown={(e) => handleKeyDown(e, req)}
          type={type === 'number' ? 'number' : 'text'} autoFocus
          className="w-full rounded border px-2 py-1 text-xs" />
      )
    }
    return (
      <span onDoubleClick={esSuperadmin ? () => iniciarEdicionCelda(req, campo) : undefined}
        className={`block w-full rounded px-1 py-0.5 ${esSuperadmin ? 'cursor-pointer hover:bg-slate-100' : ''}`}
        title={esSuperadmin ? 'Doble clic para editar' : undefined}>
        {displayValue || '—'}
      </span>
    )
  }

  function exportarExcel(): void {
    const fuente = datos
    // Hoja 1: Requerimientos
    const filasReq = fuente.map((req) => ({
      'Código REQ': req.codigo_req,
      'Nombre / Acta': req.nombre ?? '',
      'Estado': req.estado,
      'Código SC': req.solicitud?.codigo_sc ?? '',
      'Tipo Costo': req.solicitud?.tipo_costo ?? '',
      'Tecnología': req.solicitud?.tecnologia ?? '',
      'Squad': req.solicitud?.squad_id ? (squadPorId.get(String(req.solicitud.squad_id)) ?? String(req.solicitud.squad_id)) : '',
      'Líder Técnico': req.solicitud?.lt_hitss_id ? nombrePersona(req.solicitud.lt_hitss_id) : '',
      'Scrum': req.solicitud?.scrum_id ? nombrePersona(req.solicitud.scrum_id) : '',
      'Horas Estimadas': req.total_horas_estimadas ?? '',
      'Monto Pactado': req.monto_pactado ?? '',
      'Fecha Solicitud': req.solicitud?.fecha_solicitud ?? '',
      'Fecha Inicio': req.fecha_inicio ?? '',
      'Fecha Fin': req.fecha_fin ?? '',
      'Fecha Límite': req.fecha_limite ?? '',
      'Fecha Real Entrega Estimaciones': req.fecha_real_entrega_estimacion ?? '',
      'ANS Estimación': req.ans_estimacion ?? '',
      'ANS Acta': req.ans_acta ?? '',
      'Cantidad Entregas': req.cantidad_entregas ?? 0,
      'Motivo Cierre': req.motivo_cierre ?? '',
      'Acta de Trabajo': req.acta_trabajo ?? '',
      'Observaciones / Seguimiento': req.seguimiento ?? '',
    }))

    // Hoja 2: Entregas
    const filasEntregas: object[] = []
    for (const req of fuente) {
      for (const en of req.entregas ?? []) {
        filasEntregas.push({
          'Código REQ': req.codigo_req,
          'Nombre REQ': req.nombre ?? '',
          '# Entrega': en.numero,
          'Horas': en.horas ?? '',
          'Porcentaje': en.porcentaje ?? '',
          'Fecha Comprometida': en.fecha_comprometida ?? '',
          'Fecha Recepción': en.fecha_recepcion ?? '',
          'Fecha Cargue': en.fecha_cargue ?? '',
          'Fecha Aprobación': en.fecha_aprobacion ?? '',
          'Fecha Ejecución': en.fecha_ejecucion ?? '',
          'Estado': en.estado ?? '',
          'ANS Entrega': en.ans_entrega ?? '',
          'Garantía': en.garantia ? 'Sí' : 'No',
        })
      }
    }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasReq), 'Requerimientos')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasEntregas.length ? filasEntregas : [{}]), 'Entregas')

    const fecha = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `requerimientos_${fecha}.xlsx`)
  }

  function fechaComprometidaReq(req: Requerimiento): string | null {
    const fechas = (req.entregas ?? [])
      .map((e) => e.fecha_comprometida)
      .filter(Boolean) as string[]
    if (fechas.length === 0) return null
    const hoy = new Date().toISOString().slice(0, 10)
    const futuras = fechas.filter((f) => f.slice(0, 10) >= hoy).sort()
    if (futuras.length > 0) return futuras[0].slice(0, 10)
    return fechas.sort().reverse()[0].slice(0, 10)
  }

  function calcularDiasTranscurridos(fechaLimite: string | null, fechaReal: string | null): { dias: number; esNegativo: boolean } | null {
    const hoy = new Date().toISOString().slice(0, 10)
    
    if (!fechaLimite) return null
    
    // Fecha a usar para el cálculo del rango
    const fechaFin = fechaReal ? fechaReal.slice(0, 10) : hoy
    const fechaInicio = fechaLimite.slice(0, 10)
    
    // Calcular diferencia en días
    const fecha1 = new Date(fechaInicio)
    const fecha2 = new Date(fechaFin)
    const diferencia = Math.floor((fecha2.getTime() - fecha1.getTime()) / (1000 * 60 * 60 * 24))
    
    // Determinar si es negativo:
    // - Si no hay fecha real y hoy > fechaLimite: negativo (atraso)
    // - Si hay fecha real y fechaReal > fechaLimite: negativo (atraso)
    // - En caso contrario: positivo (días restantes o dentro de plazo)
    let esNegativo = false
    if (!fechaReal && hoy > fechaInicio) {
      esNegativo = true
    } else if (fechaReal && fechaReal.slice(0, 10) > fechaInicio) {
      esNegativo = true
    }
    
    return { dias: Math.abs(diferencia), esNegativo }
  }

  const reqSeleccionado = estModalReqId ? datos.find((req) => req.id === estModalReqId) ?? null : null
  const estimacion = estData?.estimacion ?? null
  const summary = estData?.summary

  // Mapa id → nombre combinando aplicaciones (fuente principal: squad_id = codigo de app)
  // y la colección squads (para registros importados con _id numérico).
  const squadPorId = useMemo(() => {
    const m = new Map<string, string>()
    // Primero squads de colección (menor prioridad, colección puede estar vacía)
    squadsCol.forEach((s) => m.set(String(s.id), s.nombre))
    // Luego aplicaciones (mayor prioridad, fuente real de squad_id en la mayoría de los casos)
    aplicaciones.forEach((a) => m.set(String(a.codigo), a.nombre))
    return m
  }, [squadsCol, aplicaciones])

  const squadsDisponibles = useMemo(() => {
    const nombres = new Set<string>()
    datos.forEach((req) => {
      if (req.solicitud?.squad_id) {
        const nombre = squadPorId.get(String(req.solicitud.squad_id)) ?? String(req.solicitud.squad_id)
        nombres.add(nombre)
      }
    })
    return Array.from(nombres).sort((a, b) => a.localeCompare(b, 'es'))
  }, [datos, squadPorId])

  const lideresDisponibles = useMemo(() =>
    personas.filter((p) => p.rol_operativo === 'LT_HITSS'),
    [personas])

  const hayFiltrosActivos = Object.values(filtros).some((v) => v !== '')

  const datosFiltrados = useMemo(() => {
    return datos.filter((req) => {
      // Texto libre
      if (filtros.codigoReq && !req.codigo_req.toLowerCase().includes(filtros.codigoReq.toLowerCase())) return false
      if (filtros.sc && !(req.solicitud?.codigo_sc ?? '').toLowerCase().includes(filtros.sc.toLowerCase())) return false

      // Squad: comparar contra nombre resuelto
      if (filtros.squad) {
        const nombreSquad = req.solicitud?.squad_id
          ? (squadPorId.get(String(req.solicitud.squad_id)) ?? String(req.solicitud.squad_id))
          : ''
        if (nombreSquad !== filtros.squad) return false
      }

      // Estado exacto del requerimiento
      if (filtros.estado && req.estado !== filtros.estado) return false

      // Líder técnico por ID
      if (filtros.liderTecnico && req.solicitud?.lt_hitss_id !== filtros.liderTecnico) return false

      // Fecha solicitud acta (campo que se ve en el formulario)
      if (filtros.fechaSolicitudDesde || filtros.fechaSolicitudHasta) {
        const fecha = req.fecha_solicitud_acta ? req.fecha_solicitud_acta.slice(0, 10) : null
        if (!fecha) return false
        if (filtros.fechaSolicitudDesde && fecha < filtros.fechaSolicitudDesde) return false
        if (filtros.fechaSolicitudHasta && fecha > filtros.fechaSolicitudHasta) return false
      }

      // Fecha comprometida (usa la misma lógica que la columna)
      if (filtros.fechaComprometidaDesde || filtros.fechaComprometidaHasta) {
        const fc = fechaComprometidaReq(req)
        if (!fc) return false
        if (filtros.fechaComprometidaDesde && fc < filtros.fechaComprometidaDesde) return false
        if (filtros.fechaComprometidaHasta && fc > filtros.fechaComprometidaHasta) return false
      }

      // Fecha límite
      if (filtros.fechaLimiteDesde || filtros.fechaLimiteHasta) {
        const fl = req.fecha_limite ? req.fecha_limite.slice(0, 10) : null
        if (!fl) return false
        if (filtros.fechaLimiteDesde && fl < filtros.fechaLimiteDesde) return false
        if (filtros.fechaLimiteHasta && fl > filtros.fechaLimiteHasta) return false
      }

      // Estado de entrega: case-insensitive
      if (filtros.estadoEntrega) {
        const match = (req.entregas ?? []).some(
          (en) => (en.estado ?? '').toLowerCase() === filtros.estadoEntrega.toLowerCase()
        )
        if (!match) return false
      }

      return true
    })
  }, [datos, filtros, squadPorId])

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-marca-osc">Requerimientos</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={exportarExcel}
            disabled={datos.length === 0}
            className="flex items-center gap-2 rounded border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Exportar Excel
          </button>
          {esSuperadmin && (
            <Link to="/requerimientos/nuevo" className="rounded bg-marca px-4 py-2 text-white hover:bg-marca-osc text-sm">
              Crear
            </Link>
          )}
          <button
            onClick={() => setMostrarFiltros((v) => !v)}
            className={`flex items-center gap-2 rounded border px-4 py-2 text-sm font-medium transition-colors ${mostrarFiltros || hayFiltrosActivos ? 'border-marca bg-marca/10 text-marca' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            Filtros{hayFiltrosActivos && <span className="ml-1 rounded-full bg-marca px-1.5 py-0.5 text-[10px] font-bold text-white">ON</span>}
          </button>
        </div>
      </div>

      {(aviso || error) && (
        <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{aviso || error}</div>
      )}

      {/* Panel de filtros */}
      {mostrarFiltros && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Filtros</span>
            {hayFiltrosActivos && (
              <button onClick={() => setFiltros(FILTROS_INIT)} className="text-xs text-red-500 hover:underline">
                Limpiar filtros
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {/* Código REQ */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Código REQ</label>
              <input type="text" value={filtros.codigoReq} placeholder="Buscar..."
                onChange={(e) => setFiltros((f) => ({ ...f, codigoReq: e.target.value }))}
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs focus:border-marca focus:outline-none" />
            </div>
            {/* SC */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">SC</label>
              <input type="text" value={filtros.sc} placeholder="Buscar..."
                onChange={(e) => setFiltros((f) => ({ ...f, sc: e.target.value }))}
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs focus:border-marca focus:outline-none" />
            </div>
            {/* Squad */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Squad</label>
              <select value={filtros.squad}
                onChange={(e) => setFiltros((f) => ({ ...f, squad: e.target.value }))}
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs focus:border-marca focus:outline-none">
                <option value="">Todos</option>
                {squadsDisponibles.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {/* Estado */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Estado</label>
              <select value={filtros.estado}
                onChange={(e) => setFiltros((f) => ({ ...f, estado: e.target.value }))}
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs focus:border-marca focus:outline-none">
                <option value="">Todos</option>
                {estadosReq.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {/* Líder técnico */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Líder técnico</label>
              <select value={filtros.liderTecnico}
                onChange={(e) => setFiltros((f) => ({ ...f, liderTecnico: e.target.value }))}
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs focus:border-marca focus:outline-none">
                <option value="">Todos</option>
                {lideresDisponibles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            {/* Estado entregas */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Estado (entregas)</label>
              <select value={filtros.estadoEntrega}
                onChange={(e) => setFiltros((f) => ({ ...f, estadoEntrega: e.target.value }))}
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs focus:border-marca focus:outline-none">
                <option value="">Todos</option>
                {estadosEnt.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {/* Fecha solicitud */}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600">Fecha y hora de solicitud</label>
              <div className="flex items-center gap-1">
                <input type="date" value={filtros.fechaSolicitudDesde}
                  onChange={(e) => setFiltros((f) => ({ ...f, fechaSolicitudDesde: e.target.value }))}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs focus:border-marca focus:outline-none" />
                <span className="text-xs text-slate-400">–</span>
                <input type="date" value={filtros.fechaSolicitudHasta}
                  onChange={(e) => setFiltros((f) => ({ ...f, fechaSolicitudHasta: e.target.value }))}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs focus:border-marca focus:outline-none" />
              </div>
            </div>
            {/* Fecha comprometida */}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600">Fecha comprometida</label>
              <div className="flex items-center gap-1">
                <input type="date" value={filtros.fechaComprometidaDesde}
                  onChange={(e) => setFiltros((f) => ({ ...f, fechaComprometidaDesde: e.target.value }))}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs focus:border-marca focus:outline-none" />
                <span className="text-xs text-slate-400">–</span>
                <input type="date" value={filtros.fechaComprometidaHasta}
                  onChange={(e) => setFiltros((f) => ({ ...f, fechaComprometidaHasta: e.target.value }))}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs focus:border-marca focus:outline-none" />
              </div>
            </div>
            {/* Fecha límite */}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600">Fecha límite</label>
              <div className="flex items-center gap-1">
                <input type="date" value={filtros.fechaLimiteDesde}
                  onChange={(e) => setFiltros((f) => ({ ...f, fechaLimiteDesde: e.target.value }))}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs focus:border-marca focus:outline-none" />
                <span className="text-xs text-slate-400">–</span>
                <input type="date" value={filtros.fechaLimiteHasta}
                  onChange={(e) => setFiltros((f) => ({ ...f, fechaLimiteHasta: e.target.value }))}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs focus:border-marca focus:outline-none" />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full overflow-hidden rounded-xl border bg-white text-sm">
          <thead className="bg-marca-osc text-white">
            <tr>
              <th className="w-8 p-2"></th>
              <th className="p-2 text-left">Código REQ</th>
              <th className="p-2 text-left">SC</th>
              <th className="p-2 text-left">Squad</th>
              <th className="p-2 text-left">Nombre de acta</th>
              <th className="p-2 text-left">Estado</th>
              <th className="p-2 text-left">Líder técnico</th>
              <th className="p-2 text-left">Scrum</th>
              <th className="p-2 text-right">Horas</th>
              <th className="p-2 text-center">F. Solicitud</th>
              <th className="p-2 text-center">F. Límite</th>
              <th className="p-2 text-center">F. Real</th>
              <th className="p-2 text-right">Días transcurridos</th>
              <th className="p-2 text-center">Entregas</th>
              <th className="p-2 text-center">Est.</th>
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
                <>{/* Fila principal del requerimiento */}
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
                    <td className="p-2 font-mono">
                      <Link to={`/requerimientos/${req.id}`} className="text-marca hover:underline">
                        {req.codigo_req}
                      </Link>
                    </td>
                    <td className="p-2">{renderCelda(req, 'codigo_sc', req.solicitud?.codigo_sc ?? '')}</td>
                    <td className="p-2 text-xs text-slate-600">
                      {req.solicitud?.squad_id ? (squadPorId.get(String(req.solicitud.squad_id)) ?? String(req.solicitud.squad_id)) : '—'}
                    </td>
                    <td className="p-2">{renderCelda(req, 'nombre', req.nombre ?? '')}</td>
                    <td className="p-2">{renderCelda(req, 'estado', req.estado, 'select')}</td>
                    <td className="p-2">{renderCelda(req, 'lt_hitss_id', nombrePersona(req.solicitud?.lt_hitss_id ?? null), 'select-persona', 'LT_HITSS')}</td>
                    <td className="p-2">{renderCelda(req, 'scrum_id', nombrePersona(req.solicitud?.scrum_id ?? null), 'select-persona', 'SCRUM')}</td>
                    <td className="p-2 text-right">{renderCelda(req, 'total_horas_estimadas', req.total_horas_estimadas != null ? String(req.total_horas_estimadas) : '', 'number')}</td>
                    <td className="p-2 text-center text-xs">
                      {req.fecha_solicitud_acta
                        ? req.fecha_solicitud_acta.slice(0, 10)
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="p-2 text-center text-xs">
                      {req.fecha_limite
                        ? req.fecha_limite.slice(0, 10)
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="p-2 text-center text-xs">
                      {req.fecha_real_entrega_estimacion
                        ? req.fecha_real_entrega_estimacion.slice(0, 10)
                        : <span className="text-slate-400">—</span>}
                    </td>
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
                    <td className="p-2 text-center">
                      {(req.entregas?.length ?? 0) > 0 ? (
                        <button
                          onClick={() => setExpandedEntregas(prev => {
                            const next = new Set(prev)
                            next.has(req.id) ? next.delete(req.id) : next.add(req.id)
                            return next
                          })}
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-200"
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
                      ) : (
                        <button onClick={() => handleUploadClick(req.id)} title="Cargar estimación (Excel)"
                          className="rounded p-0.5 text-slate-400 hover:text-cyan-600">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17h6m-6-4h6m-6-4h3" />
                          </svg>
                        </button>
                      )}
                    </td>
                    <td className="p-2 text-center whitespace-nowrap">
                      {esSuperadmin && (
                        <>
                          <Link to={`/requerimientos/${req.id}`} className="mr-2 text-marca hover:underline text-xs">
                            Editar
                          </Link>
                          <button onClick={() => { void eliminar(req) }} className="text-red-600 hover:underline text-xs">
                            Eliminar
                          </button>
                        </>
                      )}
                    </td>
                  </tr>

                  {/* Sub-fila: detalle de entregas */}
                  {expandedEntregas.has(req.id) && req.entregas?.length > 0 && (
                    <tr key={`${req.id}-entregas`}>
                      <td colSpan={13} className="p-0">
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
                      <td colSpan={13} className="p-0">
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
                      <td colSpan={13} className="border-l-4 border-slate-300 bg-slate-50 px-6 py-3 text-center text-xs text-slate-400">
                        Sin datos de estimación para este requerimiento.
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
            {datosFiltrados.length === 0 && (
              <tr><td colSpan={13} className="p-4 text-center text-slate-400">
                {hayFiltrosActivos ? 'Sin resultados con los filtros aplicados.' : 'Sin requerimientos.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

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
                    <h2 className="truncate text-lg font-bold text-slate-900">
                      Estimación — {reqSeleccionado?.codigo_req ?? estModalReqId} — {reqSeleccionado?.nombre ?? 'Sin nombre'}
                    </h2>
                    <p className="truncate text-sm text-slate-600">
                      {estimacion?.archivo ?? 'Sin archivo'} · Subido {formatDateTime(estimacion?.subido_en ?? estimacion?.fecha_estimacion)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { void handleCreateTasks('hitss') }}
                  disabled={!estData?.estimacion || creatingTasks !== null}
                  title="Crear tareas en Azure DevOps HITSS"
                  className="flex items-center gap-1 rounded-lg border border-cyan-300 px-3 py-2 text-sm font-medium text-cyan-700 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-50"
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
                  className="flex items-center gap-1 rounded-lg border border-purple-300 px-3 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-50"
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
                <button onClick={() => handleUploadClick(estModalReqId)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Reemplazar
                </button>
                <button onClick={() => { void deleteEstimation() }} disabled={!estimacion} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">
                  Eliminar
                </button>
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
                    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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
                        <div className="overflow-x-auto border-t border-slate-200">
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
                        </div>
                      )}
                    </section>

                    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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
                        <div className="overflow-x-auto border-t border-slate-200">
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
                        </div>
                      )}
                    </section>

                    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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
                        <div className="overflow-x-auto border-t border-slate-200">
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
                        </div>
                      )}
                    </section>
                  </div>

                  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 px-5 py-4">
                      <h3 className="font-semibold text-slate-900">
                        Detalle por Historia de Usuario ({agruparPorHU(estimacion.filas).length} HU · {estimacion.filas.length} tareas)
                      </h3>
                      <p className="text-sm text-slate-600">Haz clic en una fila para expandir y ver las tareas individuales</p>
                    </div>
                    <div className="overflow-x-auto">
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
                    </div>
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
