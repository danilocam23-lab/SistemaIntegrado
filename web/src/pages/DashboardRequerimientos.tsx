import { useEffect, useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  Legend, LabelList,
  LineChart, Line,
} from 'recharts'
import { useLista } from '../api/hooks'
import client from '../api/client'
import type { Persona, Requerimiento } from '../types'
import { EncabezadoPagina, FiltroDesplegable, Icono, Kpi, Tarjeta } from '../components/ui'
import {
  COLOR_GRAFICA,
  ContenedorGrafica,
  TooltipGrafica,
  ejeCategoria,
  ejePorcentaje,
  ejeValor,
  etiquetaBarra,
  leyenda,
  rejilla,
} from '../components/ui/graficas'


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
    const conteo: Record<string, number> = {}
    for (const r of reqs) {
      if (r.solicitud?.lt_hitss_id) conteo[r.solicitud.lt_hitss_id] = (conteo[r.solicitud.lt_hitss_id] ?? 0) + 1
    }
    // Agrupa por persona real (nombreKey) en lugar de por id: distintos lt_hitss_id
    // (p.ej. un id huérfano que ya no existe en personas) pueden resolver al mismo
    // nombre y no deben aparecer como filas duplicadas.
    const porNombre = new Map<string, { id: string; nombre: string; nombreKey: string; email: string; reqs: number }>()
    for (const id of Object.keys(conteo)) {
      const p = personas.find((x) => x.id === id)
      const nombre = p?.nombre ?? id
      const nombreKey = normalizarTexto(nombre)
      const existente = porNombre.get(nombreKey)
      if (existente) {
        existente.reqs += conteo[id] ?? 0
        // Prioriza el id/email de un registro que sí exista en `personas`.
        if (!existente.email && p?.email) existente.email = p.email
        if (p && existente.id !== id && !personas.find((x) => x.id === existente.id)) existente.id = id
      } else {
        porNombre.set(nombreKey, { id, nombre, nombreKey, email: p?.email ?? '', reqs: conteo[id] ?? 0 })
      }
    }
    return Array.from(porNombre.values()).sort((a, b) => b.reqs - a.reqs)
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
        icono={<Icono nombre="grafico-linea" />}
        titulo="Dashboard General"
        descripcion="Vista consolidada de métricas operativas · Requerimientos y Soporte"
      />

      {/* ═══ Contenido principal: dos columnas ═══ */}
      <div className="pagina max-w-[1920px]">
        <div className="grid gap-8 xl:grid-cols-2">

          {/* ════════════════════════════════════════════════════════════════════
              COLUMNA IZQUIERDA — Requerimientos & Actas
              ════════════════════════════════════════════════════════════════════ */}
          <section className="flex flex-col gap-6">
            {/* Section header */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-marca-50 text-marca-700">
                <span className="text-lg">📋</span>
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
                  label="Año" icono={<Icono nombre="calendario" />}
                  opciones={anosDisponiblesReq}
                  activos={anosReq}
                  setActivos={setAnosReq}
                />
                <FiltroDesplegable
                  label="Mes" icono={<Icono nombre="calendario" />}
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
              <Kpi rotulo="Requerimientos" valor={kpis.total} nota={`${kpis.activos} activos`} acento={COLOR_GRAFICA.serie} />
              <Kpi rotulo="Horas estimadas" valor={kpis.totalHoras.toLocaleString()} nota="total acumulado" acento={COLOR_GRAFICA.serie} />
              <Kpi rotulo="Entregas" valor={kpis.totalEntregas} nota={`de ${kpis.total} requerimientos`} acento={COLOR_GRAFICA.serie} />
              <Kpi rotulo="ANS Estimación" valor={`${kpis.ansReqPct}%`} nota={`${kpis.ansReqCumple} / ${kpis.ansReqTotal}`} acento={COLOR_GRAFICA.ok} />
              <Kpi rotulo="ANS Estimación (Hitss)" valor={`${kpis.ansReqEpmPct}%`} nota={`${kpis.ansReqEpmCumple} / ${kpis.ansReqTotal}`} acento={COLOR_GRAFICA.ok} />
              <Kpi rotulo="ANS Entregas" valor={`${kpis.ansEntPct}%`} nota={`${kpis.ansEntCumple} / ${kpis.ansEntTotal}`} acento={COLOR_GRAFICA.ok} />
              <Kpi rotulo="ANS Entregas (Hitss)" valor={`${kpis.ansEntEpmPct}%`} nota={`${kpis.ansEntEpmCumple} / ${kpis.ansEntTotal}`} acento={COLOR_GRAFICA.ok} />
            </div>

            {/* Gráfica: Requerimientos por mes */}
            <ContenedorGrafica titulo="Requerimientos por mes" icono={<Icono nombre="grafico-barras" />} alto={240} vacio={porMesFiltrado.length === 0}>
              <BarChart data={porMesFiltrado} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
                <CartesianGrid {...rejilla('horizontal')} />
                <XAxis dataKey="mes" {...ejeCategoria(10)} />
                <YAxis {...ejeValor(11)} />
                <Tooltip content={<TooltipGrafica />} />
                <Bar dataKey="cantidad" fill={COLOR_GRAFICA.serie} radius={[6, 6, 0, 0]} barSize={24}>
                  <LabelList dataKey="cantidad" {...etiquetaBarra('top', 10)} />
                </Bar>
              </BarChart>
            </ContenedorGrafica>

            {/* Equipo LT HITSS */}
            <Tarjeta padding={false} className="min-w-0">
              <div className="tarjeta-encabezado">
                <h3 className="titulo-seccion">Equipo LT HITSS ({equipo.length})</h3>
              </div>
              <div className="tarjeta-pad">
                <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
                  {equipo.length === 0 ? (
                    <p className="py-10 text-center text-sm text-slate-400">Sin datos para el filtro actual</p>
                  ) : equipo.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white/80 px-4 py-2.5 shadow-sm transition-all hover:shadow-md hover:border-blue-200">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-marca-50 text-sm font-bold text-marca-700 shadow-sm">
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
              </div>
            </Tarjeta>

            {/* Gráfica: Tendencia de entregas */}
            <ContenedorGrafica titulo="ANS de entregas" icono={<Icono nombre="grafico-linea" />} alto={240} vacio={tendenciaFiltrada.length === 0}>
              <LineChart data={tendenciaFiltrada} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
                <CartesianGrid {...rejilla()} />
                <XAxis dataKey="mes" {...ejeCategoria(10)} />
                <YAxis {...ejePorcentaje(11)} />
                <Tooltip content={<TrendPctTooltip />} />
                <Line type="monotone" dataKey="cumplePct" stroke={COLOR_GRAFICA.ok} strokeWidth={2.5} name="Cumple" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="noCumplePct" stroke={COLOR_GRAFICA.malo} strokeWidth={2.5} name="No cumple" dot={{ r: 3 }} />
                <Legend {...leyenda()} />
              </LineChart>
            </ContenedorGrafica>

            {/* Gráfica: Tendencia de entregas (Tipificación EPM cuenta como cumple) */}
            <ContenedorGrafica titulo="ANS de entregas (Hitss)" icono={<Icono nombre="grafico-linea" />} alto={240} vacio={tendenciaEpmFiltrada.length === 0}>
              <LineChart data={tendenciaEpmFiltrada} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
                <CartesianGrid {...rejilla()} />
                <XAxis dataKey="mes" {...ejeCategoria(10)} />
                <YAxis {...ejePorcentaje(11)} />
                <Tooltip content={<TrendPctTooltip />} />
                <Line type="monotone" dataKey="cumplePct" stroke={COLOR_GRAFICA.ok} strokeWidth={2.5} name="Cumple" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="noCumplePct" stroke={COLOR_GRAFICA.malo} strokeWidth={2.5} name="No cumple" dot={{ r: 3 }} />
                <Legend {...leyenda()} />
              </LineChart>
            </ContenedorGrafica>

            {/* Gráfica: Tendencia de estimación */}
            <ContenedorGrafica titulo="ANS de estimación" icono={<Icono nombre="portafolio" />} alto={240} vacio={tendenciaReqsFiltrada.length === 0}>
              <LineChart data={tendenciaReqsFiltrada} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
                <CartesianGrid {...rejilla()} />
                <XAxis dataKey="mes" {...ejeCategoria(10)} />
                <YAxis {...ejePorcentaje(11)} />
                <Tooltip content={<TrendPctTooltip />} />
                <Line type="monotone" dataKey="cumplePct" stroke={COLOR_GRAFICA.ok} strokeWidth={2.5} name="Cumple" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="noCumplePct" stroke={COLOR_GRAFICA.malo} strokeWidth={2.5} name="No cumple" dot={{ r: 3 }} />
                <Legend {...leyenda()} />
              </LineChart>
            </ContenedorGrafica>

            {/* Gráfica: Tendencia de estimación (Hitss) */}
            <ContenedorGrafica titulo="ANS de estimación (Hitss)" icono={<Icono nombre="portafolio" />} alto={240} vacio={tendenciaReqsEpmFiltrada.length === 0}>
              <LineChart data={tendenciaReqsEpmFiltrada} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
                <CartesianGrid {...rejilla()} />
                <XAxis dataKey="mes" {...ejeCategoria(10)} />
                <YAxis {...ejePorcentaje(11)} />
                <Tooltip content={<TrendPctTooltip />} />
                <Line type="monotone" dataKey="cumplePct" stroke={COLOR_GRAFICA.ok} strokeWidth={2.5} name="Cumple" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="noCumplePct" stroke={COLOR_GRAFICA.malo} strokeWidth={2.5} name="No cumple" dot={{ r: 3 }} />
                <Legend {...leyenda()} />
              </LineChart>
            </ContenedorGrafica>
          </section>

          {/* ════════════════════════════════════════════════════════════════════
              COLUMNA DERECHA — Soporte & WO
              ════════════════════════════════════════════════════════════════════ */}
          <section className="flex flex-col gap-6">
            {/* Section header */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-marca-50 text-marca-700">
                <span className="text-lg">🛠️</span>
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
                  label="Año" icono={<Icono nombre="calendario" />}
                  opciones={anosDisponiblesSop}
                  activos={anosSop}
                  setActivos={setAnosSop}
                />
                <FiltroDesplegable
                  label="Mes" icono={<Icono nombre="calendario" />}
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
              <Kpi rotulo="Work Orders" valor={workOrderIDFiltrado.toLocaleString('es-CO')} nota="Órdenes distintas" acento={COLOR_GRAFICA.serie} />
              <Kpi rotulo="ANS Oportunidad"
                valor={`${ansOportShow.total > 0 ? ((ansOportShow.cumple / ansOportShow.total) * 100).toFixed(1) : '0.0'}%`}
                nota={`${ansOportShow.cumple} / ${ansOportShow.total}`} acento={COLOR_GRAFICA.ok} />
              <Kpi rotulo="ANS Cumplimiento"
                valor={`${ansCumplShow.total > 0 ? ((ansCumplShow.cumple / ansCumplShow.total) * 100).toFixed(1) : '0.0'}%`}
                nota={`${ansCumplShow.cumple} / ${ansCumplShow.total}`} acento={COLOR_GRAFICA.ok} />
              <Kpi rotulo="ANS Inicio Trabajo"
                valor={`${ansInicioShow.total > 0 ? ((ansInicioShow.cumple / ansInicioShow.total) * 100).toFixed(1) : '0.0'}%`}
                nota={`${ansInicioShow.cumple} / ${ansInicioShow.total}`} acento={COLOR_GRAFICA.ok} />
            </div>

            {/* Gráfica: WO por mes */}
            <ContenedorGrafica titulo="Work Orders por mes" icono={<Icono nombre="grafico-barras" />} alto={240} vacio={woPorMesFiltrado.length === 0}>
              <BarChart data={woPorMesFiltrado} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
                <CartesianGrid {...rejilla('horizontal')} />
                <XAxis dataKey="mes" {...ejeCategoria(10)} />
                <YAxis {...ejeValor(11)} />
                <Tooltip content={<TooltipGrafica />} />
                <Bar dataKey="wo" fill={COLOR_GRAFICA.serie} radius={[6, 6, 0, 0]} barSize={24}>
                  <LabelList dataKey="wo" {...etiquetaBarra('top', 10)} />
                </Bar>
              </BarChart>
            </ContenedorGrafica>

            {/* Gráfica: ANS Oportunidad */}
            <ContenedorGrafica titulo="ANS Oportunidad" icono={<Icono nombre="objetivo" />} alto={240} vacio={ansTendenciaFiltrada.length === 0}>
              <LineChart data={ansTendenciaFiltrada} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
                <CartesianGrid {...rejilla()} />
                <XAxis dataKey="mes" {...ejeCategoria(10)} />
                <YAxis {...ejePorcentaje(11)} />
                <Tooltip content={<TrendPctTooltip />} />
                <Line type="monotone" dataKey="oportunidadPct" stroke={COLOR_GRAFICA.ok} strokeWidth={2.5} name="Cumple" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="oportunidadNoCumplePct" stroke={COLOR_GRAFICA.malo} strokeWidth={2.5} name="No cumple" dot={{ r: 3 }} />
                <Legend {...leyenda()} />
              </LineChart>
            </ContenedorGrafica>

            {/* Gráfica: ANS Cumplimiento */}
            <ContenedorGrafica titulo="ANS Cumplimiento" icono={<Icono nombre="check-circulo" />} alto={240} vacio={ansTendenciaFiltrada.length === 0}>
              <LineChart data={ansTendenciaFiltrada} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
                <CartesianGrid {...rejilla()} />
                <XAxis dataKey="mes" {...ejeCategoria(10)} />
                <YAxis {...ejePorcentaje(11)} />
                <Tooltip content={<TrendPctTooltip />} />
                <Line type="monotone" dataKey="cumplimientoPct" stroke={COLOR_GRAFICA.ok} strokeWidth={2.5} name="Cumple" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="cumplimientoNoCumplePct" stroke={COLOR_GRAFICA.malo} strokeWidth={2.5} name="No cumple" dot={{ r: 3 }} />
                <Legend {...leyenda()} />
              </LineChart>
            </ContenedorGrafica>

            {/* Gráfica: ANS Inicio Trabajo */}
            <ContenedorGrafica titulo="ANS Inicio Trabajo" icono={<Icono nombre="cohete" />} alto={240} vacio={ansTendenciaFiltrada.length === 0}>
              <LineChart data={ansTendenciaFiltrada} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
                <CartesianGrid {...rejilla()} />
                <XAxis dataKey="mes" {...ejeCategoria(10)} />
                <YAxis {...ejePorcentaje(11)} />
                <Tooltip content={<TrendPctTooltip />} />
                <Line type="monotone" dataKey="inicioPct" stroke={COLOR_GRAFICA.ok} strokeWidth={2.5} name="Cumple" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="inicioNoCumplePct" stroke={COLOR_GRAFICA.malo} strokeWidth={2.5} name="No cumple" dot={{ r: 3 }} />
                <Legend {...leyenda()} />
              </LineChart>
            </ContenedorGrafica>
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


