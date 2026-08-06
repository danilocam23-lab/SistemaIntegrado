import React, { useEffect, useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  Legend,
  LineChart, Line,
} from 'recharts'
import { useLista } from '../api/hooks'
import client from '../api/client'
import { ESTADOS_REQUERIMIENTO } from '../constantes'
import type { Persona, Requerimiento } from '../types'

const COLORES_KPI = {
  total:    { bg: 'bg-blue-50',   text: 'text-blue-600',   border: 'border-blue-200',   icon: '📋' },
  horas:    { bg: 'bg-green-50',  text: 'text-green-600',  border: 'border-green-200',  icon: '⏱️' },
  entregas: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200', icon: '📦' },
  ansActa:  { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200', icon: '📝' },
  ansEnt:   { bg: 'bg-teal-50',   text: 'text-teal-600',   border: 'border-teal-200',   icon: '✅' },
}

function abreviarEstado(e: string): string {
  return e
    .replace('ESTIMACION EN CURSO POR HITSS', 'Est. Curso')
    .replace('ESTIMACION EN ESPERA DE APROBACION POR EPM', 'Est. Espera')
    .replace('ESTIMACION APROBADA POR LT', 'Est. Aprob. LT')
    .replace('ESTIMACION APROBADA ENTREGA PENDIENTE', 'Est. Aprob.')
    .replace('ENTREGA CARGADA', 'Ent. Cargada')
    .replace('ENTREGA NO CARGADA', 'Ent. No Carg.')
    .replace('CONTROL DE CAMBIOS', 'Ctrl. Cambios')
    .replace('REQUERIMIENTO DEVUELTO A EPM', 'Devuelto')
    .replace('REQUERIMIENTO SUSPENDIDO POR EPM', 'Suspendido')
    .replace('REQUERIMIENTO CANCELADO POR EPM', 'Cancel. EPM')
    .replace('REQUERIMIENTO CANCELADO', 'Cancelado')
    .replace('REQUERIMIENTO REEMPLAZADO', 'Reemplazado')
}

function normalizarTexto(v: string): string {
  return v
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
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
    const totalHoras = reqs.reduce((s, r) => s + Number(r.total_horas_estimadas ?? 0), 0)
    const allEntregas = reqs.flatMap((r) => r.entregas ?? [])
    const totalEntregas = allEntregas.length

    // ANS Requerimientos: evalúa todos los requerimientos activos
    const reqsActivos = reqs.filter((r) => {
      const normalized = r.estado.toUpperCase()
      return !normalized.includes('CANCELADO') && !normalized.includes('REEMPLAZADO')
    })
    const requerimentosConAns = reqsActivos.filter((r) => r.ans_acta)
    const ansReqCumple = requerimentosConAns.filter((r) => r.ans_acta === 'CUMPLE').length
    const ansReqPct = requerimentosConAns.length > 0 ? parseFloat(((ansReqCumple / requerimentosConAns.length) * 100).toFixed(1)) : 0

    // ANS Entregas: campo ans_entrega de cada entrega
    const conAnsEnt    = allEntregas.filter((e) => e.ans_entrega)
    const ansEntCumple = conAnsEnt.filter((e) => e.ans_entrega === 'CUMPLE').length
    const ansEntPct    = conAnsEnt.length > 0 ? parseFloat(((ansEntCumple / conAnsEnt.length) * 100).toFixed(1)) : 0

    return {
      total: reqs.length, totalHoras, totalEntregas,
      ansReqPct, ansReqCumple, ansReqTotal: requerimentosConAns.length,
      ansEntPct, ansEntCumple, ansEntTotal: conAnsEnt.length,
    }
  }, [reqs])

  // ─── Requerimientos por estado ──────────────────────────
  const porEstado = useMemo(() => {
    const map: Record<string, number> = {}
    for (const e of ESTADOS_REQUERIMIENTO) map[e] = 0
    for (const r of reqs) {
      map[r.estado] = (map[r.estado] ?? 0) + 1
    }
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .map(([estado, cantidad]) => ({ estado: abreviarEstado(estado), cantidad, full: estado }))
  }, [reqs])

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
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-marca-osc">Dashboard General</h1>
      <p className="text-sm text-slate-500">
        Métricas y estado general de los requerimientos.
      </p>

      {/* ═══ Filtros independientes por fuente ═══ */}
      <div className="grid gap-3 lg:grid-cols-2">

        {/* ── Filtro Requerimientos (fecha_inicio / fecha_recepcion) ── */}
        <div className="rounded-xl border-2 border-blue-100 bg-blue-50/50 p-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-blue-700">
            📋 Requerimientos &amp; Entregas — por fecha inicio / recepción
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
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
                className="self-start px-3 py-2 rounded-lg border border-blue-200 bg-white text-xs font-semibold text-blue-600 hover:bg-blue-50 whitespace-nowrap">
                ✕ Limpiar
              </button>
            )}
          </div>
        </div>

        {/* ── Filtro Soporte (Fecha_Fin_Real) ── */}
        <div className="rounded-xl border-2 border-green-100 bg-green-50/50 p-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-green-700">
            🛠️ Soporte / WO — por Fecha Fin Real
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
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
                className="self-start px-3 py-2 rounded-lg border border-green-200 bg-white text-xs font-semibold text-green-600 hover:bg-green-50 whitespace-nowrap">
                ✕ Limpiar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ═══ KPI Cards ═══ */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          icon={COLORES_KPI.total.icon} label="Requerimientos" value={kpis.total}
          sub={`${porEstado.filter((e) => !e.full.includes('CANCELADO') && !e.full.includes('REEMPLAZADO')).reduce((s, e) => s + e.cantidad, 0)} activos`}
          color={COLORES_KPI.total} />
        <KpiCard
          icon={COLORES_KPI.horas.icon} label="Horas estimadas" value={kpis.totalHoras.toLocaleString()}
          sub="total acumulado"
          color={COLORES_KPI.horas} />
        <KpiCard
          icon={COLORES_KPI.entregas.icon} label="Entregas" value={kpis.totalEntregas}
          sub={`de ${reqs.length} requerimientos`}
          color={COLORES_KPI.entregas} />
        <KpiCard
          icon={COLORES_KPI.ansActa.icon} label="ANS Requerimientos" value={`${kpis.ansReqPct}%`}
          sub={`${kpis.ansReqCumple} / ${kpis.ansReqTotal} evaluados`}
          color={COLORES_KPI.ansActa} />
        <KpiCard
          icon={COLORES_KPI.ansEnt.icon} label="ANS Entregas" value={`${kpis.ansEntPct}%`}
          sub={`${kpis.ansEntCumple} / ${kpis.ansEntTotal} evaluados`}
          color={COLORES_KPI.ansEnt} />
      </div>

      {/* Work Order ID + ANS Soporte Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Work Order ID Card */}
        <div className="flex items-center gap-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="text-3xl">📋</div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-600">Work Order ID Distintos</p>
            <p className="text-2xl font-bold text-blue-900">{workOrderIDFiltrado.toLocaleString('es-CO')}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-blue-500">Órdenes de trabajo</p>
            <p className="text-sm text-blue-600">en el sistema</p>
          </div>
        </div>
        {/* ANS Oportunidad */}
        <div className="flex items-center gap-4 rounded-xl border border-green-200 bg-green-50 p-4">
          <div className="text-3xl">🎯</div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-green-600">ANS Oportunidad</p>
            <p className="text-2xl font-bold text-green-900">
              {ansOportShow.total > 0
                ? ((ansOportShow.cumple / ansOportShow.total) * 100).toFixed(1)
                : '0.0'}%
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-green-500">Cumple</p>
            <p className="text-sm text-green-600">{ansOportShow.cumple} / {ansOportShow.total}</p>
          </div>
        </div>

        {/* ANS Cumplimiento */}
        <div className="flex items-center gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-3xl">✅</div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-600">ANS Cumplimiento</p>
            <p className="text-2xl font-bold text-amber-900">
              {ansCumplShow.total > 0
                ? ((ansCumplShow.cumple / ansCumplShow.total) * 100).toFixed(1)
                : '0.0'}%
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-amber-500">Cumple</p>
            <p className="text-sm text-amber-600">{ansCumplShow.cumple} / {ansCumplShow.total}</p>
          </div>
        </div>

        {/* ANS Inicio Trabajo */}
        <div className="flex items-center gap-4 rounded-xl border border-purple-200 bg-purple-50 p-4">
          <div className="text-3xl">🚀</div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-purple-600">ANS Inicio Trabajo</p>
            <p className="text-2xl font-bold text-purple-900">
              {ansInicioShow.total > 0
                ? ((ansInicioShow.cumple / ansInicioShow.total) * 100).toFixed(1)
                : '0.0'}%
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-purple-500">Cumple</p>
            <p className="text-sm text-purple-600">{ansInicioShow.cumple} / {ansInicioShow.total}</p>
          </div>
        </div>
      </div>

      {/* ═══ Row 2: Mes + Equipo ═══ */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Requerimientos por mes */}
        <Panel titulo="Requerimientos por mes">
          {porMesFiltrado.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={porMesFiltrado} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [v, 'Requerimientos']} />
                <Bar dataKey="cantidad" fill="#16a34a" radius={[4, 4, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* WO por mes */}
        <Panel titulo="WO por mes">
          {woPorMesFiltrado.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={woPorMesFiltrado} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [v, 'WO']} />
                <Bar dataKey="wo" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Equipo */}
        <Panel titulo={`LT HITSS (${equipo.length})`}>
          <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
            {equipo.length === 0 ? <Empty /> : equipo.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-marca text-sm font-bold text-white">
                  {m.nombre.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{m.nombre}</div>
                  <div className="truncate text-xs text-slate-400">{m.email || '—'}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                    Req: {m.reqs}
                  </span>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                    WO: {woPorLt[m.nombreKey] ?? 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* ═══ Row 3+4: Tendencia y ANS ═══ */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel titulo="Tendencia de entregas">
          {tendenciaFiltrada.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={tendenciaFiltrada} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2} name="Total" dot />
                <Line type="monotone" dataKey="cumple" stroke="#16a34a" strokeWidth={2} name="Cumple" dot />
                <Line type="monotone" dataKey="noCumple" stroke="#dc2626" strokeWidth={2} name="No cumple" dot />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel titulo="ANS Oportunidad">
          {ansTendenciaFiltrada.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={ansTendenciaFiltrada} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="oportunidadTotal"    stroke="#2563eb" strokeWidth={2} name="Total"     dot />
                <Line type="monotone" dataKey="oportunidadCumple"   stroke="#16a34a" strokeWidth={2} name="Cumple"    dot />
                <Line type="monotone" dataKey="oportunidadNoCumple" stroke="#dc2626" strokeWidth={2} name="No cumple" dot />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel titulo="ANS Cumplimiento">
          {ansTendenciaFiltrada.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={ansTendenciaFiltrada} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="cumplimientoTotal"    stroke="#2563eb" strokeWidth={2} name="Total"     dot />
                <Line type="monotone" dataKey="cumplimientoCumple"   stroke="#16a34a" strokeWidth={2} name="Cumple"    dot />
                <Line type="monotone" dataKey="cumplimientoNoCumple" stroke="#dc2626" strokeWidth={2} name="No cumple" dot />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel titulo="ANS Inicio Trabajo">
          {ansTendenciaFiltrada.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={ansTendenciaFiltrada} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="inicioTotal"    stroke="#2563eb" strokeWidth={2} name="Total"     dot />
                <Line type="monotone" dataKey="inicioCumple"   stroke="#16a34a" strokeWidth={2} name="Cumple"    dot />
                <Line type="monotone" dataKey="inicioNoCumple" stroke="#dc2626" strokeWidth={2} name="No cumple" dot />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>
    </div>
  )
}

/* ─── Componentes auxiliares ─── */

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
  const ring   = color === 'blue' ? 'border-blue-200 focus-within:border-blue-400' : 'border-green-200 focus-within:border-green-400'
  const badge  = color === 'blue' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
  const chkOn  = color === 'blue' ? 'border-blue-300 bg-blue-50 text-blue-900' : 'border-green-300 bg-green-50 text-green-900'
  const allBtn = color === 'blue' ? 'text-blue-600' : 'text-green-600'

  // Para meses, la key es el número 1-12 como string; para años, es el año string
  const toKey   = (_o: string, i: number) => esMes ? String(i + 1) : _o
  const allKeys = opciones.map((o, i) => toKey(o, i))
  const toggle  = (k: string) => setActivos((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n })

  return (
    <details className="group flex-1">
      <summary className={`flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg border-2 ${ring} bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors`}>
        <div className="flex items-center gap-1.5">
          <span>{emoji} {label}</span>
          {activos.size > 0 && <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${badge}`}>{activos.size}</span>}
        </div>
        <svg className="h-3.5 w-3.5 text-slate-400 transition-transform group-open:rotate-180" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z" clipRule="evenodd" />
        </svg>
      </summary>
      <div className="absolute z-20 mt-1 min-w-[180px] rounded-lg border border-slate-200 bg-white p-2.5 shadow-lg">
        <div className="flex justify-end gap-3 mb-2">
          <button type="button" onClick={() => setActivos(new Set(allKeys))} className={`text-[10px] font-semibold ${allBtn} hover:underline`}>Todos</button>
          <button type="button" onClick={() => setActivos(new Set())} className="text-[10px] font-semibold text-slate-400 hover:underline">Limpiar</button>
        </div>
        <div className={esMes ? 'grid grid-cols-3 gap-1.5' : 'flex flex-wrap gap-1.5'}>
          {opciones.map((o, i) => {
            const k = toKey(o, i)
            const checked = activos.has(k)
            return (
              <label key={k} className={`flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-[11px] font-semibold transition-colors ${checked ? chkOn : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                <input type="checkbox" checked={checked} onChange={() => toggle(k)} />
                {o}
              </label>
            )
          })}
        </div>
      </div>
    </details>
  )
}

function KpiCard({ icon, label, value, sub, color }: {
  icon: string; label: string; value: string | number; sub: string
  color: { bg: string; text: string; border: string }
}) {
  return (
    <div className={`flex items-center gap-4 rounded-xl border ${color.border} ${color.bg} p-4`}>
      <span className="text-3xl">{icon}</span>
      <div>
        <div className={`text-2xl font-bold ${color.text}`}>{value}</div>
        <div className="text-sm font-medium text-slate-700">{label}</div>
        <div className="text-xs text-slate-500">{sub}</div>
      </div>
    </div>
  )
}

function Panel({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="w-full min-w-0 rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm transition-shadow duration-200 hover:shadow-md">
      <h3 className="mb-4 text-sm font-semibold text-slate-900 uppercase tracking-wide">{titulo}</h3>
      {children}
    </div>
  )
}

function Empty() {
  return <p className="py-8 text-center text-sm text-slate-400">Sin datos</p>
}
