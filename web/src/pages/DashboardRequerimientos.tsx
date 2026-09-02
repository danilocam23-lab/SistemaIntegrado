import React, { useEffect, useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  Legend, LabelList,
  LineChart, Line,
} from 'recharts'
import { useLista } from '../api/hooks'
import client from '../api/client'
import type { Persona, Requerimiento } from '../types'
import { EncabezadoPagina, FiltroDesplegable } from '../components/ui'


function normalizarTexto(v: string): string {
  return v
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizarAns(valor: string | null | undefined): string {
  return normalizarTexto(valor ?? '').replace(/\s+/g, '_')
}

function conPorcentajes<T extends { total: number; cumple: number; noCumple: number }>(
  v: T,
): T & { cumplePct: number; noCumplePct: number } {
  return {
    ...v,
    cumplePct: v.total > 0 ? parseFloat(((v.cumple / v.total) * 100).toFixed(1)) : 0,
    noCumplePct: v.total > 0 ? parseFloat(((v.noCumple / v.total) * 100).toFixed(1)) : 0,
  }
}

export default function DashboardRequerimientos() {
  const { datos: reqs, cargando } = useLista<Requerimiento>('/requerimientos')
  const { datos: personas } = useLista<Persona>('/personas')
  const [workOrderIDCount, setWorkOrderIDCount] = useState(0)
  const [woPorMesIds, setWoPorMesIds] = useState<Record<string, string[]>>({})
  const [ansOportunidadData, setAnsOportunidadData] = useState({ total: 0, cumple: 0 })
  const [ansCumplimientoData, setAnsCumplimientoData] = useState({ total: 0, cumple: 0 })
  const [ansInicioTrabajoData, setAnsInicioTrabajoData] = useState({ total: 0, cumple: 0 })
  const [ansTendencia, setAnsTendencia] = useState<Array<{ mes: string; oportunidadTotal: number; oportunidadCumple: number; oportunidadNoCumple: number; oportunidadPct: number; oportunidadNoCumplePct: number; cumplimientoTotal: number; cumplimientoCumple: number; cumplimientoNoCumple: number; cumplimientoPct: number; cumplimientoNoCumplePct: number; inicioTotal: number; inicioCumple: number; inicioNoCumple: number; inicioPct: number; inicioNoCumplePct: number }>>([])
  const [woPorLt, setWoPorLt] = useState<Record<string, number>>({})
  const [woPorMes, setWoPorMes] = useState<Array<{ mes: string; wo: number }>>([])
  // Filtros independientes por fuente de datos
  const [anosReq, setAnosReq] = useState<Set<string>>(new Set())
  const [mesesReq, setMesesReq] = useState<Set<string>>(new Set())
  const [anosSop, setAnosSop] = useState<Set<string>>(new Set())
  const [mesesSop, setMesesSop] = useState<Set<string>>(new Set())

  useEffect(() => {
    client
      .get<{ registros: Array<{ lider?: string; Work_Order_ID?: string; Fecha_Fin_Real?: string; Estado_ANS_Oportunidad?: string; Estado_ANS_Cumplimiento?: string; Estado_ANS_inicio_trabajo?: string }> }>('/soporte/solicitudes-fabrica/resumen')
      .then((r) => {
        const hoy = new Date().toISOString().substring(0, 10)
        const workOrderIDs = new Set<string>()
        const woPorLtMap: Record<string, Set<string>> = {}
        const woPorMesMap: Record<string, Set<string>> = {}
        let oportunidadTotal = 0, oportunidadCumple = 0, oportunidadNoCumple = 0
        let cumplimientoTotal = 0, cumplimientoCumple = 0, cumplimientoNoCumple = 0
        let inicioTotal = 0, inicioCumple = 0, inicioNoCumple = 0
        
        // Para tendencia por mes (Fecha Fin Real)
        const tendenciaMap: Record<string, { oportunidadTotal: number; oportunidadCumple: number; oportunidadNoCumple: number; cumplimientoTotal: number; cumplimientoCumple: number; cumplimientoNoCumple: number; inicioTotal: number; inicioCumple: number; inicioNoCumple: number }> = {}

        r.data.registros?.forEach((reg) => {
          if (reg.Work_Order_ID) {
            workOrderIDs.add(reg.Work_Order_ID)
          }
          const liderSoporte = reg.lider ?? ''
          if (liderSoporte && reg.Work_Order_ID) {
            const liderKey = normalizarTexto(liderSoporte)
            if (!woPorLtMap[liderKey]) woPorLtMap[liderKey] = new Set<string>()
            woPorLtMap[liderKey].add(reg.Work_Order_ID)
          }
          
          const fechaFin = reg.Fecha_Fin_Real
          const mes = fechaFin ? fechaFin.substring(0, 7) : 'Sin fecha'
          if (!woPorMesMap[mes]) woPorMesMap[mes] = new Set<string>()
          if (reg.Work_Order_ID) {
            woPorMesMap[mes].add(reg.Work_Order_ID)
          }

          if (fechaFin && fechaFin.substring(0, 10) > hoy) return

          if (!tendenciaMap[mes]) tendenciaMap[mes] = { 
            oportunidadTotal: 0, oportunidadCumple: 0, oportunidadNoCumple: 0,
            cumplimientoTotal: 0, cumplimientoCumple: 0, cumplimientoNoCumple: 0,
            inicioTotal: 0, inicioCumple: 0, inicioNoCumple: 0
          }

          if (reg.Estado_ANS_Oportunidad) {
            oportunidadTotal++
            tendenciaMap[mes].oportunidadTotal++
            if (reg.Estado_ANS_Oportunidad.toUpperCase() === 'CUMPLE') {
              oportunidadCumple++
              tendenciaMap[mes].oportunidadCumple++
            } else {
              oportunidadNoCumple++
              tendenciaMap[mes].oportunidadNoCumple++
            }
          }
          
          if (reg.Estado_ANS_Cumplimiento) {
            cumplimientoTotal++
            tendenciaMap[mes].cumplimientoTotal++
            if (reg.Estado_ANS_Cumplimiento.toUpperCase() === 'CUMPLE') {
              cumplimientoCumple++
              tendenciaMap[mes].cumplimientoCumple++
            } else {
              cumplimientoNoCumple++
              tendenciaMap[mes].cumplimientoNoCumple++
            }
          }
          
          if (reg.Estado_ANS_inicio_trabajo) {
            inicioTotal++
            tendenciaMap[mes].inicioTotal++
            if (reg.Estado_ANS_inicio_trabajo.toUpperCase() === 'CUMPLE') {
              inicioCumple++
              tendenciaMap[mes].inicioCumple++
            } else {
              inicioNoCumple++
              tendenciaMap[mes].inicioNoCumple++
            }
          }
        })

        setWorkOrderIDCount(workOrderIDs.size)
        setWoPorMesIds(Object.fromEntries(Object.entries(woPorMesMap).map(([mes, ids]) => [mes, Array.from(ids)])))
        setWoPorLt(Object.fromEntries(Object.entries(woPorLtMap).map(([k, v]) => [k, v.size])))
        setWoPorMes(Object.entries(woPorMesMap).sort(([a], [b]) => a.localeCompare(b)).map(([mes, ids]) => ({ mes, wo: ids.size })))
        setAnsOportunidadData({ total: oportunidadTotal, cumple: oportunidadCumple })
        setAnsCumplimientoData({ total: cumplimientoTotal, cumple: cumplimientoCumple })
        setAnsInicioTrabajoData({ total: inicioTotal, cumple: inicioCumple })
        setAnsTendencia(Object.entries(tendenciaMap).sort(([a], [b]) => a.localeCompare(b)).map(([mes, datos]) => ({
          mes, ...datos,
          oportunidadPct: datos.oportunidadTotal > 0 ? parseFloat(((datos.oportunidadCumple / datos.oportunidadTotal) * 100).toFixed(1)) : 0,
          oportunidadNoCumplePct: datos.oportunidadTotal > 0 ? parseFloat(((datos.oportunidadNoCumple / datos.oportunidadTotal) * 100).toFixed(1)) : 0,
          cumplimientoPct: datos.cumplimientoTotal > 0 ? parseFloat(((datos.cumplimientoCumple / datos.cumplimientoTotal) * 100).toFixed(1)) : 0,
          cumplimientoNoCumplePct: datos.cumplimientoTotal > 0 ? parseFloat(((datos.cumplimientoNoCumple / datos.cumplimientoTotal) * 100).toFixed(1)) : 0,
          inicioPct: datos.inicioTotal > 0 ? parseFloat(((datos.inicioCumple / datos.inicioTotal) * 100).toFixed(1)) : 0,
          inicioNoCumplePct: datos.inicioTotal > 0 ? parseFloat(((datos.inicioNoCumple / datos.inicioTotal) * 100).toFixed(1)) : 0,
        })))
      })
      .catch(() => {
        setWorkOrderIDCount(0)
        setWoPorMesIds({})
        setWoPorLt({})
        setWoPorMes([])
        setAnsOportunidadData({ total: 0, cumple: 0 })
        setAnsCumplimientoData({ total: 0, cumple: 0 })
        setAnsInicioTrabajoData({ total: 0, cumple: 0 })
        setAnsTendencia([])
      })
  }, [])

  // ─── KPIs ───────────────────────────────────────────────
  const kpis = useMemo(() => {
    const filtroReqActivo = anosReq.size > 0 || mesesReq.size > 0
    const requerimientosFiltrados = reqs.filter((r) => {
      if (!filtroReqActivo) return true
      const fecha = r.fecha_inicio ?? r.fecha_solicitud_acta
      return !!fecha && pasaFiltroReq(fecha.substring(0, 7))
    })
    const totalHoras = requerimientosFiltrados.reduce((s, r) => s + Number(r.total_horas_estimadas ?? 0), 0)
    const allEntregas = reqs.flatMap((r) => r.entregas ?? [])
    const entregasFiltradas = allEntregas.filter((e) => {
      if (!filtroReqActivo) return true
      const fecha = e.fecha_recepcion ?? e.fecha_comprometida
      return !!fecha && pasaFiltroReq(fecha.substring(0, 7))
    })
    const totalEntregas = entregasFiltradas.length

    const requerimientosFiltradosAnsActa = reqs.filter((r) => {
      if (!filtroReqActivo) return true
      return !!r.fecha_solicitud_acta && pasaFiltroReq(r.fecha_solicitud_acta.substring(0, 7))
    })

    // ANS Estimación: usa el campo ANS Acta y su fecha de solicitud de acta.
    const reqsActivos = requerimientosFiltradosAnsActa.filter((r) => {
      const normalized = r.estado.toUpperCase()
      return !normalized.includes('CANCELADO') && !normalized.includes('REEMPLAZADO')
    })
    const requerimentosConAns = reqsActivos.filter((r) => normalizarAns(r.ans_acta))
    const ansReqCumple = requerimentosConAns.filter((r) => normalizarAns(r.ans_acta) === 'cumple').length
    const ansReqPct = requerimentosConAns.length > 0 ? parseFloat(((ansReqCumple / requerimentosConAns.length) * 100).toFixed(1)) : 0

    // ANS Estimación (Hitss): si Tipificación es EPM, un "No cumple" pasa a "Cumple"
    const ansReqEpmCumple = requerimentosConAns.filter((r) => {
      const ans = normalizarAns(r.ans_acta)
      const esEpm = (r as any).tipificacion === 'EPM'
      return ans === 'cumple' || (esEpm && ans === 'no_cumple')
    }).length
    const ansReqEpmPct = requerimentosConAns.length > 0 ? parseFloat(((ansReqEpmCumple / requerimentosConAns.length) * 100).toFixed(1)) : 0

    // ANS Entregas: campo ans_entrega de cada entrega
    const conAnsEnt    = entregasFiltradas.filter((e) => e.ans_entrega)
    const ansEntCumple = conAnsEnt.filter((e) => e.ans_entrega === 'CUMPLE').length
    const ansEntPct    = conAnsEnt.length > 0 ? parseFloat(((ansEntCumple / conAnsEnt.length) * 100).toFixed(1)) : 0

    // ANS Entregas (Hitss): si Tipificación de la entrega es EPM, un "No cumple" pasa a "Cumple"
    const ansEntEpmCumple = conAnsEnt.filter((e) => {
      const esEpm = (e as any).tipificacion === 'EPM'
      return e.ans_entrega === 'CUMPLE' || (esEpm && e.ans_entrega === 'NO_CUMPLE')
    }).length
    const ansEntEpmPct = conAnsEnt.length > 0 ? parseFloat(((ansEntEpmCumple / conAnsEnt.length) * 100).toFixed(1)) : 0

    return {
      total: requerimientosFiltrados.length, totalHoras, totalEntregas, activos: reqsActivos.length,
      ansReqPct, ansReqCumple, ansReqTotal: requerimentosConAns.length,
      ansReqEpmPct, ansReqEpmCumple,
      ansEntPct, ansEntCumple, ansEntTotal: conAnsEnt.length,
      ansEntEpmPct, ansEntEpmCumple,
    }
  }, [reqs, anosReq, mesesReq])

  // ─── Requerimientos por mes (fecha_inicio) ──────────────
  const porMes = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of reqs) {
      const fecha = r.fecha_inicio ?? r.fecha_solicitud_acta
      if (!fecha) continue
      const mes = fecha.substring(0, 7) // YYYY-MM
      map[mes] = (map[mes] ?? 0) + 1
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, cantidad]) => ({ mes, cantidad }))
  }, [reqs])

  // ─── Equipo: solo Líderes Técnicos HITSS ───────────────
  const equipo = useMemo(() => {
    const ids = new Set<string>()
    for (const r of reqs) {
      if (r.solicitud?.lt_hitss_id) ids.add(r.solicitud.lt_hitss_id)
    }
    const conteo: Record<string, number> = {}
    for (const r of reqs) {
      if (r.solicitud?.lt_hitss_id) conteo[r.solicitud.lt_hitss_id] = (conteo[r.solicitud.lt_hitss_id] ?? 0) + 1
    }
    return Array.from(ids).map((id) => {
      const p = personas.find((x) => x.id === id)
      const nombre = p?.nombre ?? id
      return { id, nombre, nombreKey: normalizarTexto(nombre), email: p?.email ?? '', reqs: conteo[id] ?? 0 }
    }).sort((a, b) => b.reqs - a.reqs)
  }, [reqs, personas])

  // ─── Tendencia mensual (entregas por mes) ───────────────
  const tendencia = useMemo(() => {
    const hoy = new Date().toISOString().substring(0, 10)
    const map: Record<string, { total: number; cumple: number; noCumple: number }> = {}
    for (const r of reqs) {
      for (const e of r.entregas ?? []) {
        const fecha = e.fecha_recepcion ?? e.fecha_comprometida
        if (!fecha) continue
        if (fecha.substring(0, 10) > hoy) continue
        const mes = fecha.substring(0, 7)
        if (!map[mes]) map[mes] = { total: 0, cumple: 0, noCumple: 0 }
        map[mes].total++
        if (e.ans_entrega === 'CUMPLE') map[mes].cumple++
        else if (e.ans_entrega === 'NO_CUMPLE') map[mes].noCumple++
      }
    }
   return Object.entries(map)
     .sort(([a], [b]) => a.localeCompare(b))
     .map(([mes, v]) => conPorcentajes({ mes, ...v }))
  }, [reqs])

  // ─── Tendencia mensual (entregas por mes) considerando Tipificación EPM como cumple ───
  const tendenciaEpm = useMemo(() => {
    const hoy = new Date().toISOString().substring(0, 10)
    const map: Record<string, { total: number; cumple: number; noCumple: number }> = {}
    for (const r of reqs) {
      for (const e of r.entregas ?? []) {
        const esEpm = (e as any).tipificacion === 'EPM'
        const fecha = e.fecha_recepcion ?? e.fecha_comprometida
        if (!fecha) continue
        if (fecha.substring(0, 10) > hoy) continue
        const mes = fecha.substring(0, 7)
        if (!map[mes]) map[mes] = { total: 0, cumple: 0, noCumple: 0 }
        map[mes].total++
        const cumple = e.ans_entrega === 'CUMPLE' || (esEpm && e.ans_entrega === 'NO_CUMPLE')
        if (cumple) map[mes].cumple++
        else if (e.ans_entrega === 'NO_CUMPLE') map[mes].noCumple++
      }
    }
   return Object.entries(map)
     .sort(([a], [b]) => a.localeCompare(b))
     .map(([mes, v]) => conPorcentajes({ mes, ...v }))
  }, [reqs])
  const tendenciaReqs = useMemo(() => {
    const hoy = new Date().toISOString().substring(0, 10)
    const map: Record<string, { total: number; cumple: number; noCumple: number }> = {}
    for (const r of reqs) {
      const ans = normalizarAns(r.ans_acta)
      if (ans !== 'cumple' && ans !== 'no_cumple') continue
      const fecha = r.fecha_solicitud_acta ?? r.fecha_inicio
      if (!fecha) continue
      if (fecha.substring(0, 10) > hoy) continue
      const mes = fecha.substring(0, 7)
      if (!map[mes]) map[mes] = { total: 0, cumple: 0, noCumple: 0 }
      map[mes].total++
      if (ans === 'cumple') map[mes].cumple++
      else map[mes].noCumple++
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, v]) => conPorcentajes({ mes, ...v }))
  }, [reqs])

  // ─── Tendencia mensual (ANS requerimientos) considerando Tipificación EPM como cumple ───
  const tendenciaReqsEpm = useMemo(() => {
    const hoy = new Date().toISOString().substring(0, 10)
    const map: Record<string, { total: number; cumple: number; noCumple: number }> = {}
    for (const r of reqs) {
      const ans = normalizarAns(r.ans_acta)
      if (ans !== 'cumple' && ans !== 'no_cumple') continue
      const fecha = r.fecha_solicitud_acta ?? r.fecha_inicio
      if (!fecha) continue
      if (fecha.substring(0, 10) > hoy) continue
      const mes = fecha.substring(0, 7)
      if (!map[mes]) map[mes] = { total: 0, cumple: 0, noCumple: 0 }
      map[mes].total++
      const esEpm = (r as any).tipificacion === 'EPM'
      const cumple = ans === 'cumple' || (esEpm && ans === 'no_cumple')
      if (cumple) map[mes].cumple++
      else map[mes].noCumple++
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, v]) => conPorcentajes({ mes, ...v }))
  }, [reqs])

  // ─── Años disponibles por fuente ───────────────────────
  const anosDisponiblesReq = useMemo(() => {
    const s = new Set<string>()
    for (const d of [...porMes, ...tendencia, ...tendenciaEpm, ...tendenciaReqs, ...tendenciaReqsEpm]) s.add(d.mes.substring(0, 4))
    return Array.from(s).sort()
  }, [porMes, tendencia, tendenciaEpm, tendenciaReqs, tendenciaReqsEpm])

  const anosDisponiblesSop = useMemo(() => {
    const s = new Set<string>()
    for (const d of [...woPorMes, ...ansTendencia]) s.add(d.mes.substring(0, 4))
    return Array.from(s).sort()
  }, [woPorMes, ansTendencia])

  const MESES_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

  // ─── WO distintos filtrado por Fecha_Fin_Real ──────────
  const workOrderIDFiltrado = useMemo(() => {
    const activo = anosSop.size > 0 || mesesSop.size > 0
    if (!activo) return workOrderIDCount
    const ids = new Set<string>()
    for (const [mes, woIds] of Object.entries(woPorMesIds)) {
      const [ano, mm] = mes.split('-')
      if (anosSop.size > 0 && !anosSop.has(ano)) continue
      if (mesesSop.size > 0 && !mesesSop.has(String(Number(mm)))) continue
      woIds.forEach((id) => ids.add(id))
    }
    return ids.size
  }, [woPorMesIds, anosSop, mesesSop, workOrderIDCount])

  // ─── Funciones de filtro por fuente ────────────────────
  function pasaFiltroReq(mes: string) {
    const [ano, mm] = mes.split('-')
    if (anosReq.size > 0 && !anosReq.has(ano)) return false
    if (mesesReq.size > 0 && !mesesReq.has(String(Number(mm)))) return false
    return true
  }
  function pasaFiltroSop(mes: string) {
    const [ano, mm] = mes.split('-')
    if (anosSop.size > 0 && !anosSop.has(ano)) return false
    if (mesesSop.size > 0 && !mesesSop.has(String(Number(mm)))) return false
    return true
  }

  if (cargando) {
   return <div className="p-8 text-center text-slate-500">Cargando dashboard…</div>
  }

  // ─── Datos filtrados por fuente ────────────────────────
  const hayFiltroReq = anosReq.size > 0 || mesesReq.size > 0
  const hayFiltroSop = anosSop.size > 0 || mesesSop.size > 0

  const porMesFiltrado        = hayFiltroReq ? porMes.filter((d) => pasaFiltroReq(d.mes)) : porMes
  const tendenciaFiltrada     = hayFiltroReq ? tendencia.filter((d) => pasaFiltroReq(d.mes)) : tendencia
  const tendenciaEpmFiltrada  = hayFiltroReq ? tendenciaEpm.filter((d) => pasaFiltroReq(d.mes)) : tendenciaEpm
  const tendenciaReqsFiltrada = hayFiltroReq ? tendenciaReqs.filter((d) => pasaFiltroReq(d.mes)) : tendenciaReqs
  const tendenciaReqsEpmFiltrada = hayFiltroReq ? tendenciaReqsEpm.filter((d) => pasaFiltroReq(d.mes)) : tendenciaReqsEpm
  const woPorMesFiltrado      = hayFiltroSop ? woPorMes.filter((d) => pasaFiltroSop(d.mes)) : woPorMes
  const ansTendenciaFiltrada  = hayFiltroSop ? ansTendencia.filter((d) => pasaFiltroSop(d.mes)) : ansTendencia

  // Tarjetas ANS recalculadas desde tendencia filtrada (Fecha_Fin_Real)
  const ansOportFilt = ansTendenciaFiltrada.reduce((acc, d) => ({ total: acc.total + d.oportunidadTotal, cumple: acc.cumple + d.oportunidadCumple }), { total: 0, cumple: 0 })
  const ansCumplFilt = ansTendenciaFiltrada.reduce((acc, d) => ({ total: acc.total + d.cumplimientoTotal, cumple: acc.cumple + d.cumplimientoCumple }), { total: 0, cumple: 0 })
  const ansInicioFilt = ansTendenciaFiltrada.reduce((acc, d) => ({ total: acc.total + d.inicioTotal, cumple: acc.cumple + d.inicioCumple }), { total: 0, cumple: 0 })
  const ansOportShow  = hayFiltroSop ? ansOportFilt  : ansOportunidadData
  const ansCumplShow  = hayFiltroSop ? ansCumplFilt  : ansCumplimientoData
  const ansInicioShow = hayFiltroSop ? ansInicioFilt : ansInicioTrabajoData

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ═══ Header ejecutivo ═══ */}
      <EncabezadoPagina
        icono="📈"
        titulo="Dashboard General"
        descripcion="Vista consolidada de métricas operativas · Requerimientos y Soporte"
      />

      {/* ═══ Contenido principal: dos columnas ═══ */}
      <div className="pagina max-w-[1920px]">
        <div className="grid gap-8 xl:grid-cols-2">

          {/* ════════════════════════════════════════════════════════════════════
              COLUMNA IZQUIERDA — Requerimientos & Actas
              ════════════════════════════════════════════════════════════════════ */}
          <section className="relative flex flex-col gap-6 rounded-3xl border border-blue-200/60 bg-gradient-to-br from-white via-blue-50/30 to-white p-6 shadow-lg shadow-blue-100/40 ring-1 ring-blue-100/30">
            {/* Accent line */}
            <div className="absolute inset-x-6 top-0 h-1 rounded-b-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-400" />

            {/* Section header */}
            <div className="flex items-center gap-3 pt-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-md shadow-blue-200">
                <span className="text-lg text-white">📋</span>
              </div>
              <div>
                <h2 className="titulo-seccion">Requerimientos &amp; Actas</h2>
                <p className="text-xs text-slate-500">Gestión de demanda, entregas y cumplimiento ANS</p>
              </div>
            </div>

            {/* Filtro */}
            <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-blue-600">
                Filtro por fecha inicio / recepción
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <FiltroDesplegable
                  label="Año" icono="📅"
                  opciones={anosDisponiblesReq}
                  activos={anosReq}
                  setActivos={setAnosReq}
                />
                <FiltroDesplegable
                  label="Mes" icono="🗓️"
                  opciones={MESES_LABELS}
                  activos={mesesReq}
                  setActivos={setMesesReq}
                  esMes
                />
                {hayFiltroReq && (
                  <button type="button" onClick={() => { setAnosReq(new Set()); setMesesReq(new Set()) }}
                    className="btn btn-secundario btn-sm">
                    ✕ Limpiar
                  </button>
                )}
              </div>
            </div>

            {/* KPIs Requerimientos */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <MetricCard accent="blue" icon="📋" label="Requerimientos" value={kpis.total} sub={`${kpis.activos} activos`} />
              <MetricCard accent="emerald" icon="⏱️" label="Horas estimadas" value={kpis.totalHoras.toLocaleString()} sub="total acumulado" />
              <MetricCard accent="violet" icon="📦" label="Entregas" value={kpis.totalEntregas} sub={`de ${kpis.total} requerimientos`} />
              <MetricCard accent="indigo" icon="📝" label="ANS Estimación" value={`${kpis.ansReqPct}%`} sub={`${kpis.ansReqCumple} / ${kpis.ansReqTotal}`} />
              <MetricCard accent="indigo" icon="📝" label="ANS Estimación (Hitss)" value={`${kpis.ansReqEpmPct}%`} sub={`${kpis.ansReqEpmCumple} / ${kpis.ansReqTotal}`} />
              <MetricCard accent="teal" icon="✅" label="ANS Entregas" value={`${kpis.ansEntPct}%`} sub={`${kpis.ansEntCumple} / ${kpis.ansEntTotal}`} />
              <MetricCard accent="teal" icon="✅" label="ANS Entregas (Hitss)" value={`${kpis.ansEntEpmPct}%`} sub={`${kpis.ansEntEpmCumple} / ${kpis.ansEntTotal}`} />
            </div>

            {/* Gráfica: Requerimientos por mes */}
            <GlassPanel titulo="Requerimientos por mes" icon="📊">
              {porMesFiltrado.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={porMesFiltrado} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip formatter={(v) => [v, 'Requerimientos']} />
                    <Bar dataKey="cantidad" fill="url(#gradReq)" radius={[6, 6, 0, 0]} barSize={24}>
                      <LabelList dataKey="cantidad" position="top" style={{ fontSize: 10, fill: '#475569', fontWeight: 600 }} />
                    </Bar>
                    <defs>
                      <linearGradient id="gradReq" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#6366f1" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </GlassPanel>

            {/* Equipo LT HITSS */}
            <GlassPanel titulo={`Equipo LT HITSS (${equipo.length})`} icon="👥">
              <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
                {equipo.length === 0 ? <Empty /> : equipo.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white/80 px-4 py-2.5 shadow-sm transition-all hover:shadow-md hover:border-blue-200">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-bold text-white shadow-sm">
                      {m.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-800">{m.nombre}</div>
                      <div className="truncate text-xs text-slate-400">{m.email || '—'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                        {m.reqs} Req
                      </span>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                        {woPorLt[m.nombreKey] ?? 0} WO
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </GlassPanel>

            {/* Gráfica: Tendencia de entregas */}
            <GlassPanel titulo="ANS de entregas" icon="📈">
              {tendenciaFiltrada.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={tendenciaFiltrada} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip content={<TrendPctTooltip />} />
                    <Line type="monotone" dataKey="cumplePct" stroke="#10b981" strokeWidth={2.5} name="Cumple" dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="noCumplePct" stroke="#ef4444" strokeWidth={2.5} name="No cumple" dot={{ r: 3 }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </GlassPanel>

            {/* Gráfica: Tendencia de entregas (Tipificación EPM cuenta como cumple) */}
            <GlassPanel titulo="ANS de entregas (Hitss)" icon="📈">
              {tendenciaEpmFiltrada.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={tendenciaEpmFiltrada} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip content={<TrendPctTooltip />} />
                    <Line type="monotone" dataKey="cumplePct" stroke="#10b981" strokeWidth={2.5} name="Cumple" dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="noCumplePct" stroke="#ef4444" strokeWidth={2.5} name="No cumple" dot={{ r: 3 }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </GlassPanel>

            {/* Gráfica: Tendencia de estimación */}
            <GlassPanel titulo="ANS de estimación" icon="📋">
              {tendenciaReqsFiltrada.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={tendenciaReqsFiltrada} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip content={<TrendPctTooltip />} />
                    <Line type="monotone" dataKey="cumplePct" stroke="#10b981" strokeWidth={2.5} name="Cumple" dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="noCumplePct" stroke="#ef4444" strokeWidth={2.5} name="No cumple" dot={{ r: 3 }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </GlassPanel>

            {/* Gráfica: Tendencia de estimación (Hitss) */}
            <GlassPanel titulo="ANS de estimación (Hitss)" icon="📋">
              {tendenciaReqsEpmFiltrada.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={tendenciaReqsEpmFiltrada} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip content={<TrendPctTooltip />} />
                    <Line type="monotone" dataKey="cumplePct" stroke="#10b981" strokeWidth={2.5} name="Cumple" dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="noCumplePct" stroke="#ef4444" strokeWidth={2.5} name="No cumple" dot={{ r: 3 }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </GlassPanel>
          </section>

          {/* ════════════════════════════════════════════════════════════════════
              COLUMNA DERECHA — Soporte & WO
              ════════════════════════════════════════════════════════════════════ */}
          <section className="relative flex flex-col gap-6 rounded-3xl border border-emerald-200/60 bg-gradient-to-br from-white via-emerald-50/30 to-white p-6 shadow-lg shadow-emerald-100/40 ring-1 ring-emerald-100/30">
            {/* Accent line */}
            <div className="absolute inset-x-6 top-0 h-1 rounded-b-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400" />

            {/* Section header */}
            <div className="flex items-center gap-3 pt-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 shadow-md shadow-emerald-200">
                <span className="text-lg text-white">🛠️</span>
              </div>
              <div>
                <h2 className="titulo-seccion">Soporte &amp; Work Orders</h2>
                <p className="text-xs text-slate-500">Operaciones, ANS de soporte y tendencias</p>
              </div>
            </div>

            {/* Filtro */}
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                Filtro por Fecha Fin Real
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <FiltroDesplegable
                  label="Año" icono="📅"
                  opciones={anosDisponiblesSop}
                  activos={anosSop}
                  setActivos={setAnosSop}
                />
                <FiltroDesplegable
                  label="Mes" icono="🗓️"
                  opciones={MESES_LABELS}
                  activos={mesesSop}
                  setActivos={setMesesSop}
                  esMes
                />
                {hayFiltroSop && (
                  <button type="button" onClick={() => { setAnosSop(new Set()); setMesesSop(new Set()) }}
                    className="btn btn-exito btn-sm">
                    ✕ Limpiar
                  </button>
                )}
              </div>
            </div>

            {/* KPIs Soporte */}
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard accent="emerald" icon="📋" label="Work Orders" value={workOrderIDFiltrado.toLocaleString('es-CO')} sub="Órdenes distintas" />
              <MetricCard accent="green" icon="🎯" label="ANS Oportunidad"
                value={`${ansOportShow.total > 0 ? ((ansOportShow.cumple / ansOportShow.total) * 100).toFixed(1) : '0.0'}%`}
                sub={`${ansOportShow.cumple} / ${ansOportShow.total}`} />
              <MetricCard accent="amber" icon="✅" label="ANS Cumplimiento"
                value={`${ansCumplShow.total > 0 ? ((ansCumplShow.cumple / ansCumplShow.total) * 100).toFixed(1) : '0.0'}%`}
                sub={`${ansCumplShow.cumple} / ${ansCumplShow.total}`} />
              <MetricCard accent="purple" icon="🚀" label="ANS Inicio Trabajo"
                value={`${ansInicioShow.total > 0 ? ((ansInicioShow.cumple / ansInicioShow.total) * 100).toFixed(1) : '0.0'}%`}
                sub={`${ansInicioShow.cumple} / ${ansInicioShow.total}`} />
            </div>

            {/* Gráfica: WO por mes */}
            <GlassPanel titulo="Work Orders por mes" icon="📊">
              {woPorMesFiltrado.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={woPorMesFiltrado} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip formatter={(v) => [v, 'WO']} />
                    <Bar dataKey="wo" fill="url(#gradWo)" radius={[6, 6, 0, 0]} barSize={24}>
                      <LabelList dataKey="wo" position="top" style={{ fontSize: 10, fill: '#475569', fontWeight: 600 }} />
                    </Bar>
                    <defs>
                      <linearGradient id="gradWo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#14b8a6" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </GlassPanel>

            {/* Gráfica: ANS Oportunidad */}
            <GlassPanel titulo="ANS Oportunidad" icon="🎯">
              {ansTendenciaFiltrada.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={ansTendenciaFiltrada} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip content={<TrendPctTooltip />} />
                    <Line type="monotone" dataKey="oportunidadPct" stroke="#10b981" strokeWidth={2.5} name="Cumple" dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="oportunidadNoCumplePct" stroke="#ef4444" strokeWidth={2.5} name="No cumple" dot={{ r: 3 }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </GlassPanel>

            {/* Gráfica: ANS Cumplimiento */}
            <GlassPanel titulo="ANS Cumplimiento" icon="✅">
              {ansTendenciaFiltrada.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={ansTendenciaFiltrada} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip content={<TrendPctTooltip />} />
                    <Line type="monotone" dataKey="cumplimientoPct" stroke="#10b981" strokeWidth={2.5} name="Cumple" dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="cumplimientoNoCumplePct" stroke="#ef4444" strokeWidth={2.5} name="No cumple" dot={{ r: 3 }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </GlassPanel>

            {/* Gráfica: ANS Inicio Trabajo */}
            <GlassPanel titulo="ANS Inicio Trabajo" icon="🚀">
              {ansTendenciaFiltrada.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={ansTendenciaFiltrada} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip content={<TrendPctTooltip />} />
                    <Line type="monotone" dataKey="inicioPct" stroke="#10b981" strokeWidth={2.5} name="Cumple" dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="inicioNoCumplePct" stroke="#ef4444" strokeWidth={2.5} name="No cumple" dot={{ r: 3 }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </GlassPanel>
          </section>

        </div>
      </div>
    </div>
  )
}

/* ─── Componentes auxiliares premium ─── */

function TrendPctTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const fila = payload[0]?.payload ?? {}
  // Mapea cada dataKey de %, a su campo de cantidad absoluta y su campo de total del mes.
  const RAW_KEY: Record<string, string> = {
    cumplePct: 'cumple', noCumplePct: 'noCumple',
    oportunidadPct: 'oportunidadCumple', oportunidadNoCumplePct: 'oportunidadNoCumple',
    cumplimientoPct: 'cumplimientoCumple', cumplimientoNoCumplePct: 'cumplimientoNoCumple',
    inicioPct: 'inicioCumple', inicioNoCumplePct: 'inicioNoCumple',
  }
  const TOTAL_KEY: Record<string, string> = {
    cumplePct: 'total', noCumplePct: 'total',
    oportunidadPct: 'oportunidadTotal', oportunidadNoCumplePct: 'oportunidadTotal',
    cumplimientoPct: 'cumplimientoTotal', cumplimientoNoCumplePct: 'cumplimientoTotal',
    inicioPct: 'inicioTotal', inicioNoCumplePct: 'inicioTotal',
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm">
      <p className="mb-1 text-xs font-bold text-slate-700">{label}</p>
      {payload.map((entry: any) => {
        const cantidad = fila[RAW_KEY[entry.dataKey]]
        const total = fila[TOTAL_KEY[entry.dataKey]]
        const detalle = cantidad !== undefined && total !== undefined ? ` (${cantidad}/${total})` : ''
        return (
          <p key={entry.dataKey} className="text-xs" style={{ color: entry.stroke }}>
            {entry.name}: <span className="font-bold">{entry.value}%{detalle}</span>
          </p>
        )
      })}
    </div>
  )
}


const METRIC_ACCENTS = {
  blue:    { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-700', sub: 'text-blue-500' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700', sub: 'text-emerald-500' },
  violet:  { bg: 'bg-violet-50', border: 'border-violet-100', text: 'text-violet-700', sub: 'text-violet-500' },
  indigo:  { bg: 'bg-indigo-50', border: 'border-indigo-100', text: 'text-indigo-700', sub: 'text-indigo-500' },
  teal:    { bg: 'bg-teal-50', border: 'border-teal-100', text: 'text-teal-700', sub: 'text-teal-500' },
  green:   { bg: 'bg-green-50', border: 'border-green-100', text: 'text-green-700', sub: 'text-green-500' },
  amber:   { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700', sub: 'text-amber-500' },
  purple:  { bg: 'bg-purple-50', border: 'border-purple-100', text: 'text-purple-700', sub: 'text-purple-500' },
}

function MetricCard({ accent, icon, label, value, sub }: {
  accent: keyof typeof METRIC_ACCENTS
  icon: string
  label: string
  value: string | number
  sub: string
}) {
  const theme = METRIC_ACCENTS[accent]
  return (
    <div className={`group relative overflow-hidden rounded-2xl border ${theme.border} ${theme.bg} p-4 transition-all duration-300 hover:shadow-lg hover:scale-[1.02]`}>
      <div className="flex items-start gap-3">
        <span className="shrink-0 text-2xl">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className={`mt-1 break-words text-xl font-extrabold ${theme.text}`}>{value}</p>
          <p className={`mt-0.5 text-xs font-medium ${theme.sub}`}>{sub}</p>
        </div>
      </div>
    </div>
  )
}

function GlassPanel({ titulo, icon, children }: { titulo: string; icon?: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white/70 backdrop-blur-sm p-5 shadow-sm transition-all duration-300 hover:shadow-md">
      <div className="mb-4 flex items-center gap-2">
        {icon && <span className="text-base">{icon}</span>}
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">{titulo}</h3>
      </div>
      {children}
    </div>
  )
}

function Empty() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
      <span className="text-4xl opacity-30">📭</span>
      <p className="mt-2 text-sm font-medium">Sin datos disponibles</p>
    </div>
  )
}
