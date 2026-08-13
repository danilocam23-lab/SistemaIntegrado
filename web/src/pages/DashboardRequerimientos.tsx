import React, { useEffect, useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  Legend, LabelList,
  LineChart, Line,
} from 'recharts'
import { useLista } from '../api/hooks'
import client from '../api/client'
import type { Persona, Requerimiento } from '../types'


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

export default function DashboardRequerimientos() {
  const { datos: reqs, cargando } = useLista<Requerimiento>('/requerimientos')
  const { datos: personas } = useLista<Persona>('/personas')
  const [workOrderIDCount, setWorkOrderIDCount] = useState(0)
  const [woPorMesIds, setWoPorMesIds] = useState<Record<string, string[]>>({})
  const [ansOportunidadData, setAnsOportunidadData] = useState({ total: 0, cumple: 0 })
  const [ansCumplimientoData, setAnsCumplimientoData] = useState({ total: 0, cumple: 0 })
  const [ansInicioTrabajoData, setAnsInicioTrabajoData] = useState({ total: 0, cumple: 0 })
  const [ansTendencia, setAnsTendencia] = useState<Array<{ mes: string; oportunidadTotal: number; oportunidadCumple: number; oportunidadNoCumple: number; oportunidadPct: number; cumplimientoTotal: number; cumplimientoCumple: number; cumplimientoNoCumple: number; cumplimientoPct: number; inicioTotal: number; inicioCumple: number; inicioNoCumple: number; inicioPct: number }>>([])
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
          cumplimientoPct: datos.cumplimientoTotal > 0 ? parseFloat(((datos.cumplimientoCumple / datos.cumplimientoTotal) * 100).toFixed(1)) : 0,
          inicioPct: datos.inicioTotal > 0 ? parseFloat(((datos.inicioCumple / datos.inicioTotal) * 100).toFixed(1)) : 0,
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

    // ANS Requerimientos: usa el campo ANS Acta y su fecha de solicitud de acta.
    const reqsActivos = requerimientosFiltradosAnsActa.filter((r) => {
      const normalized = r.estado.toUpperCase()
      return !normalized.includes('CANCELADO') && !normalized.includes('REEMPLAZADO')
    })
    const requerimentosConAns = reqsActivos.filter((r) => normalizarAns(r.ans_acta))
    const ansReqCumple = requerimentosConAns.filter((r) => normalizarAns(r.ans_acta) === 'cumple').length
    const ansReqPct = requerimentosConAns.length > 0 ? parseFloat(((ansReqCumple / requerimentosConAns.length) * 100).toFixed(1)) : 0

    // ANS Entregas: campo ans_entrega de cada entrega
    const conAnsEnt    = entregasFiltradas.filter((e) => e.ans_entrega)
    const ansEntCumple = conAnsEnt.filter((e) => e.ans_entrega === 'CUMPLE').length
    const ansEntPct    = conAnsEnt.length > 0 ? parseFloat(((ansEntCumple / conAnsEnt.length) * 100).toFixed(1)) : 0

    return {
      total: requerimientosFiltrados.length, totalHoras, totalEntregas, activos: reqsActivos.length,
      ansReqPct, ansReqCumple, ansReqTotal: requerimentosConAns.length,
      ansEntPct, ansEntCumple, ansEntTotal: conAnsEnt.length,
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
    const map: Record<string, { total: number; cumple: number; noCumple: number }> = {}
    for (const r of reqs) {
      for (const e of r.entregas ?? []) {
        const fecha = e.fecha_recepcion ?? e.fecha_comprometida
        if (!fecha) continue
        const mes = fecha.substring(0, 7)
        if (!map[mes]) map[mes] = { total: 0, cumple: 0, noCumple: 0 }
        map[mes].total++
        if (e.ans_entrega === 'CUMPLE') map[mes].cumple++
        else if (e.ans_entrega === 'NO_CUMPLE') map[mes].noCumple++
      }
    }
   return Object.entries(map)
     .sort(([a], [b]) => a.localeCompare(b))
     .map(([mes, v]) => ({ mes, ...v }))
  }, [reqs])

  // ─── Tendencia mensual (ANS requerimientos por mes) ───────────────
  const tendenciaReqs = useMemo(() => {
    const map: Record<string, { total: number; cumple: number; noCumple: number }> = {}
    for (const r of reqs) {
      const ans = normalizarAns(r.ans_acta)
      if (ans !== 'cumple' && ans !== 'no_cumple') continue
      const fecha = r.fecha_solicitud_acta ?? r.fecha_inicio
      if (!fecha) continue
      const mes = fecha.substring(0, 7)
      if (!map[mes]) map[mes] = { total: 0, cumple: 0, noCumple: 0 }
      map[mes].total++
      if (ans === 'cumple') map[mes].cumple++
      else map[mes].noCumple++
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, v]) => ({ mes, ...v }))
  }, [reqs])

  // ─── Años disponibles por fuente ───────────────────────
  const anosDisponiblesReq = useMemo(() => {
    const s = new Set<string>()
    for (const d of [...porMes, ...tendencia]) s.add(d.mes.substring(0, 4))
    return Array.from(s).sort()
  }, [porMes, tendencia])

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
  const tendenciaReqsFiltrada = hayFiltroReq ? tendenciaReqs.filter((d) => pasaFiltroReq(d.mes)) : tendenciaReqs
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-100">
      {/* ═══ Header ejecutivo ═══ */}
      <header className="sticky top-0 z-30 border-b border-slate-200/60 bg-white/90 backdrop-blur-xl shadow-sm">
        <div className="mx-auto max-w-[1920px] px-6 py-5">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Dashboard General
            </h1>
            <p className="text-sm text-slate-500">
              Vista consolidada de métricas operativas · Requerimientos &amp; Soporte
            </p>
          </div>
        </div>
      </header>

      {/* ═══ Contenido principal: dos columnas ═══ */}
      <div className="mx-auto max-w-[1920px] px-6 py-8">
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
                <h2 className="text-lg font-bold text-slate-900">Requerimientos &amp; Actas</h2>
                <p className="text-xs text-slate-500">Gestión de demanda, entregas y cumplimiento ANS</p>
              </div>
            </div>

            {/* Filtro */}
            <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-blue-600">
                Filtro por fecha inicio / recepción
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <FilterDropdown
                  label="Año" emoji="📅"
                  opciones={anosDisponiblesReq}
                  activos={anosReq}
                  setActivos={setAnosReq}
                  color="blue"
                />
                <FilterDropdown
                  label="Mes" emoji="🗓️"
                  opciones={MESES_LABELS}
                  activos={mesesReq}
                  setActivos={setMesesReq}
                  esMes
                  color="blue"
                />
                {hayFiltroReq && (
                  <button type="button" onClick={() => { setAnosReq(new Set()); setMesesReq(new Set()) }}
                    className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors">
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
              <MetricCard accent="indigo" icon="📝" label="ANS Requerimientos" value={`${kpis.ansReqPct}%`} sub={`${kpis.ansReqCumple} / ${kpis.ansReqTotal}`} />
              <MetricCard accent="teal" icon="✅" label="ANS Entregas" value={`${kpis.ansEntPct}%`} sub={`${kpis.ansEntCumple} / ${kpis.ansEntTotal}`} />
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
            <GlassPanel titulo="Tendencia de entregas" icon="📈">
              {tendenciaFiltrada.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={tendenciaFiltrada} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip content={<TrendTooltip />} />
                    <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2.5} name="Total" dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="cumple" stroke="#10b981" strokeWidth={2.5} name="Cumple" dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="noCumple" stroke="#ef4444" strokeWidth={2.5} name="No cumple" dot={{ r: 3 }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </GlassPanel>

            {/* Gráfica: Tendencia de requerimientos */}
            <GlassPanel titulo="Tendencia de requerimientos" icon="📋">
              {tendenciaReqsFiltrada.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={tendenciaReqsFiltrada} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip content={<TrendTooltip />} />
                    <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2.5} name="Total" dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="cumple" stroke="#10b981" strokeWidth={2.5} name="Cumple" dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="noCumple" stroke="#ef4444" strokeWidth={2.5} name="No cumple" dot={{ r: 3 }} />
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
                <h2 className="text-lg font-bold text-slate-900">Soporte &amp; Work Orders</h2>
                <p className="text-xs text-slate-500">Operaciones, ANS de soporte y tendencias</p>
              </div>
            </div>

            {/* Filtro */}
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                Filtro por Fecha Fin Real
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <FilterDropdown
                  label="Año" emoji="📅"
                  opciones={anosDisponiblesSop}
                  activos={anosSop}
                  setActivos={setAnosSop}
                  color="green"
                />
                <FilterDropdown
                  label="Mes" emoji="🗓️"
                  opciones={MESES_LABELS}
                  activos={mesesSop}
                  setActivos={setMesesSop}
                  esMes
                  color="green"
                />
                {hayFiltroSop && (
                  <button type="button" onClick={() => { setAnosSop(new Set()); setMesesSop(new Set()) }}
                    className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 transition-colors">
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
            <GlassPanel titulo="ANS Oportunidad — Tendencia" icon="🎯">
              {ansTendenciaFiltrada.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={ansTendenciaFiltrada} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip content={<TrendTooltip />} />
                    <Line type="monotone" dataKey="oportunidadTotal" stroke="#3b82f6" strokeWidth={2.5} name="Total" dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="oportunidadCumple" stroke="#10b981" strokeWidth={2.5} name="Cumple" dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="oportunidadNoCumple" stroke="#ef4444" strokeWidth={2.5} name="No cumple" dot={{ r: 3 }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </GlassPanel>

            {/* Gráfica: ANS Cumplimiento */}
            <GlassPanel titulo="ANS Cumplimiento — Tendencia" icon="✅">
              {ansTendenciaFiltrada.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={ansTendenciaFiltrada} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip content={<TrendTooltip />} />
                    <Line type="monotone" dataKey="cumplimientoTotal" stroke="#3b82f6" strokeWidth={2.5} name="Total" dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="cumplimientoCumple" stroke="#10b981" strokeWidth={2.5} name="Cumple" dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="cumplimientoNoCumple" stroke="#ef4444" strokeWidth={2.5} name="No cumple" dot={{ r: 3 }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </GlassPanel>

            {/* Gráfica: ANS Inicio Trabajo */}
            <GlassPanel titulo="ANS Inicio Trabajo — Tendencia" icon="🚀">
              {ansTendenciaFiltrada.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={ansTendenciaFiltrada} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip content={<TrendTooltip />} />
                    <Line type="monotone" dataKey="inicioTotal" stroke="#3b82f6" strokeWidth={2.5} name="Total" dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="inicioCumple" stroke="#10b981" strokeWidth={2.5} name="Cumple" dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="inicioNoCumple" stroke="#ef4444" strokeWidth={2.5} name="No cumple" dot={{ r: 3 }} />
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

function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const totalEntry = payload.find((p: any) => /total/i.test(p.dataKey))
  const totalVal = totalEntry?.value ?? 0
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm">
      <p className="mb-1 text-xs font-bold text-slate-700">{label}</p>
      {payload.map((entry: any) => {
        const isTotal = /total/i.test(entry.dataKey)
        const pct = !isTotal && totalVal > 0
          ? ` (${((entry.value / totalVal) * 100).toFixed(1)}%)`
          : ''
        return (
          <p key={entry.dataKey} className="text-xs" style={{ color: entry.stroke }}>
            {entry.name}: <span className="font-bold">{entry.value}{pct}</span>
          </p>
        )
      })}
    </div>
  )
}

function FilterDropdown({
  label, emoji, opciones, activos, setActivos, esMes = false, color
}: {
  label: string
  emoji: string
  opciones: string[]
  activos: Set<string>
  setActivos: React.Dispatch<React.SetStateAction<Set<string>>>
  esMes?: boolean
  color: 'blue' | 'green'
}) {
  const ring   = color === 'blue' ? 'border-blue-200 focus-within:border-blue-400' : 'border-emerald-200 focus-within:border-emerald-400'
  const badge  = color === 'blue' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
  const chkOn  = color === 'blue' ? 'border-blue-300 bg-blue-50 text-blue-900' : 'border-emerald-300 bg-emerald-50 text-emerald-900'
  const allBtn = color === 'blue' ? 'text-blue-600' : 'text-emerald-600'

  const toKey   = (_o: string, i: number) => esMes ? String(i + 1) : _o
  const allKeys = opciones.map((o, i) => toKey(o, i))
  const toggle  = (k: string) => setActivos((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n })

  return (
    <details className="group relative">
      <summary className={`flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl border ${ring} bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:shadow transition-all`}>
        <div className="flex items-center gap-1.5">
          <span>{emoji} {label}</span>
          {activos.size > 0 && <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${badge}`}>{activos.size}</span>}
        </div>
        <svg className="h-3.5 w-3.5 text-slate-400 transition-transform group-open:rotate-180" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z" clipRule="evenodd" />
        </svg>
      </summary>
      <div className="absolute z-20 mt-2 min-w-[200px] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
        <div className="flex justify-end gap-3 mb-2">
          <button type="button" onClick={() => setActivos(new Set(allKeys))} className={`text-[10px] font-semibold ${allBtn} hover:underline`}>Todos</button>
          <button type="button" onClick={() => setActivos(new Set())} className="text-[10px] font-semibold text-slate-400 hover:underline">Limpiar</button>
        </div>
        <div className={esMes ? 'grid grid-cols-3 gap-1.5' : 'flex flex-wrap gap-1.5'}>
          {opciones.map((o, i) => {
            const k = toKey(o, i)
            const checked = activos.has(k)
            return (
              <label key={k} className={`flex cursor-pointer items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-all ${checked ? chkOn : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                <input type="checkbox" checked={checked} onChange={() => toggle(k)} className="rounded" />
                {o}
              </label>
            )
          })}
        </div>
      </div>
    </details>
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
