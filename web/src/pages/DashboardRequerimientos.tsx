// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LabelList } from 'recharts'
import { useLista } from '../api/hooks'
import client from '../api/client'
import type { Persona, Requerimiento } from '../types'
import { Aviso, BarraFiltros, Boton, Chip, EncabezadoPagina, FiltroDesplegable, Icono, Kpi, Tarjeta } from '../components/ui'
import {
  COLOR_GRAFICA,
  ContenedorGrafica,
  TooltipGrafica,
  ejeCategoria,
  ejeValor,
  etiquetaBarra,
  rejilla,
} from '../components/ui/graficas'
import { GraficaTendenciaAns } from './dashboard-requerimientos/GraficaTendenciaAns'
import { ModalDetalleAnsHitss } from './dashboard-requerimientos/ModalDetalleAnsHitss'
import {
  NOTA_ATRIBUCION_EPM,
  calcularAns,
  calcularTendenciaAns,
  estaCanceladoOReemplazado,
  filasDetalleEntrega,
  filasDetalleReq,
  itemsAnsEntrega,
  itemsAnsReq,
  normalizarAns,
  porcentajeCumple,
} from './dashboard-requerimientos/calculoAns'


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
    const reqsActivos = requerimientosFiltradosAnsActa.filter((r) => !estaCanceladoOReemplazado(r.estado))
    const itemsReq = itemsAnsReq(reqsActivos).filter((i) => normalizarAns(i.ans))
    const ansReq = calcularAns(itemsReq, { atribuirEpm: false })
    // (Hitss): un NO_CUMPLE con tipificación EPM cuenta como cumple
    const ansReqEpm = calcularAns(itemsReq, { atribuirEpm: true })

    // ANS Entregas: ans_entrega de cada entrega (excluye entregas de requerimientos cancelados/reemplazados)
    const itemsEnt = itemsAnsEntrega(reqs).filter((i) => {
      if (!normalizarAns(i.ans)) return false
      if (!filtroReqActivo) return true
      const fecha = i.e.fecha_recepcion ?? i.e.fecha_comprometida
      return !!fecha && pasaFiltroReq(fecha.substring(0, 7))
    })
    const ansEnt = calcularAns(itemsEnt, { atribuirEpm: false })
    const ansEntEpm = calcularAns(itemsEnt, { atribuirEpm: true })

    return {
      total: requerimientosFiltrados.length, totalHoras, totalEntregas, activos: reqsActivos.length,
      ansReqPct: porcentajeCumple(ansReq), ansReqCumple: ansReq.cumple, ansReqTotal: ansReq.total,
      ansReqEpmPct: porcentajeCumple(ansReqEpm), ansReqEpmCumple: ansReqEpm.cumple,
      ansEntPct: porcentajeCumple(ansEnt), ansEntCumple: ansEnt.cumple, ansEntTotal: ansEnt.total,
      ansEntEpmPct: porcentajeCumple(ansEntEpm), ansEntEpmCumple: ansEntEpm.cumple,
    }
  }, [reqs, anosReq, mesesReq])

  // ─── Detalle de las gráficas ANS (Hitss): mismo universo que los KPI "(Hitss)" ───
  const [detalleAns, setDetalleAns] = useState<'entregas' | 'estimacion' | null>(null)
  const cerrarDetalleAns = useCallback(() => setDetalleAns(null), [])
  const filasDetalleAns = useMemo(() => {
    if (!detalleAns) return []
    const nombrePersona = (id: string | null): string =>
      id ? (personas.find((p) => p.id === id)?.nombre ?? id) : '—'
    const filtroActivo = anosReq.size > 0 || mesesReq.size > 0
    if (detalleAns === 'estimacion') {
      const activos = reqs
        .filter((r) => !filtroActivo || (!!r.fecha_solicitud_acta && pasaFiltroReq(r.fecha_solicitud_acta.substring(0, 7))))
        .filter((r) => !estaCanceladoOReemplazado(r.estado))
      return filasDetalleReq(itemsAnsReq(activos).filter((i) => normalizarAns(i.ans)), nombrePersona)
    }
    const items = itemsAnsEntrega(reqs).filter((i) => {
      if (!normalizarAns(i.ans)) return false
      if (!filtroActivo) return true
      const fecha = i.e.fecha_recepcion ?? i.e.fecha_comprometida
      return !!fecha && pasaFiltroReq(fecha.substring(0, 7))
    })
    return filasDetalleEntrega(items, reqs, nombrePersona)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detalleAns, reqs, personas, anosReq, mesesReq])


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
  const tendencia = useMemo(
    () => calcularTendenciaAns(itemsAnsEntrega(reqs), (i) => i.e.fecha_recepcion ?? i.e.fecha_comprometida, { atribuirEpm: false }),
    [reqs],
  )

  // ─── Tendencia mensual (entregas por mes) considerando Tipificación EPM como cumple ───
  const tendenciaEpm = useMemo(
    () => calcularTendenciaAns(itemsAnsEntrega(reqs), (i) => i.e.fecha_recepcion ?? i.e.fecha_comprometida, { atribuirEpm: true }),
    [reqs],
  )

  // ─── Tendencia mensual (ANS requerimientos): solo con ANS cumple / no cumple ───
  const itemsTendenciaReqs = useMemo(
    () => itemsAnsReq(reqs).filter((i) => ['cumple', 'no_cumple'].includes(normalizarAns(i.ans))),
    [reqs],
  )
  const tendenciaReqs = useMemo(
    () => calcularTendenciaAns(itemsTendenciaReqs, (i) => i.r.fecha_solicitud_acta ?? i.r.fecha_inicio, { atribuirEpm: false }),
    [itemsTendenciaReqs],
  )

  // ─── Tendencia mensual (ANS requerimientos) considerando Tipificación EPM como cumple ───
  const tendenciaReqsEpm = useMemo(
    () => calcularTendenciaAns(itemsTendenciaReqs, (i) => i.r.fecha_solicitud_acta ?? i.r.fecha_inicio, { atribuirEpm: true }),
    [itemsTendenciaReqs],
  )

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
    return (
      <div className="pagina">
        <Aviso tono="info" className="text-center" >Cargando dashboard…</Aviso>
      </div>
    )
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
    <div>
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
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-marca-50 text-lg text-marca-700">
                <Icono nombre="portafolio" />
              </div>
              <div>
                <h2 className="titulo-seccion">Requerimientos &amp; Actas</h2>
                <p className="text-xs text-slate-500">Gestión de demanda, entregas y cumplimiento ANS</p>
              </div>
            </div>

            {/* Filtro */}
            <BarraFiltros titulo="Filtro por fecha inicio / recepción">
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
                  <Boton onClick={() => { setAnosReq(new Set()); setMesesReq(new Set()) }}
                    variante="secundario" tamano="sm" icono={<Icono nombre="x" />}>
                    Limpiar
                  </Boton>
                )}
            </BarraFiltros>

            {/* KPIs Requerimientos */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Kpi rotulo="Requerimientos" valor={kpis.total} nota={`${kpis.activos} activos`} acento={COLOR_GRAFICA.serie} />
              <Kpi rotulo="Horas estimadas" valor={Math.round(kpis.totalHoras).toLocaleString('es-CO')} nota="total acumulado" acento={COLOR_GRAFICA.serie} />
              <Kpi rotulo="Entregas" valor={kpis.totalEntregas} nota={`de ${kpis.total} requerimientos`} acento={COLOR_GRAFICA.serie} />
              <Kpi rotulo="ANS Estimación" valor={`${kpis.ansReqPct}%`} nota={`${kpis.ansReqCumple} / ${kpis.ansReqTotal}`} acento={COLOR_GRAFICA.ok} />
              <Kpi rotulo="ANS Estimación (Hitss)" valor={`${kpis.ansReqEpmPct}%`} nota={`${kpis.ansReqEpmCumple} / ${kpis.ansReqTotal}`} acento={COLOR_GRAFICA.ok} />
              <Kpi rotulo="ANS Entregas" valor={`${kpis.ansEntPct}%`} nota={`${kpis.ansEntCumple} / ${kpis.ansEntTotal}`} acento={COLOR_GRAFICA.ok} />
              <Kpi rotulo="ANS Entregas (Hitss)" valor={`${kpis.ansEntEpmPct}%`} nota={`${kpis.ansEntEpmCumple} / ${kpis.ansEntTotal}`} acento={COLOR_GRAFICA.ok} />
            </div>
            <Aviso tono="info">
              <strong>Vistas «(Hitss)»:</strong> {NOTA_ATRIBUCION_EPM}
            </Aviso>

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
                    <div key={m.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-marca-50 text-sm font-bold text-marca-700 shadow-sm">
                        {m.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-800">{m.nombre}</div>
                        <div className="truncate text-xs text-slate-400">{m.email || '—'}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Chip tono="marca">{m.reqs} Req</Chip>
                        <Chip tono="neutro">{woPorLt[m.nombreKey] ?? 0} WO</Chip>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Tarjeta>

            {/* Gráfica: Tendencia de entregas */}
            <GraficaTendenciaAns titulo="ANS de entregas" icono={<Icono nombre="grafico-linea" />} datos={tendenciaFiltrada} claveCumple="cumplePct" claveNoCumple="noCumplePct" />

            {/* Gráfica: Tendencia de entregas (Tipificación EPM cuenta como cumple) */}
            <GraficaTendenciaAns titulo="ANS de entregas (Hitss)" descripcion={NOTA_ATRIBUCION_EPM} icono={<Icono nombre="grafico-linea" />} datos={tendenciaEpmFiltrada} claveCumple="cumplePct" claveNoCumple="noCumplePct" acciones={<Boton tamano="sm" onClick={() => setDetalleAns('entregas')}>Detalle</Boton>} />

            {/* Gráfica: Tendencia de estimación */}
            <GraficaTendenciaAns titulo="ANS de estimación" icono={<Icono nombre="portafolio" />} datos={tendenciaReqsFiltrada} claveCumple="cumplePct" claveNoCumple="noCumplePct" />

            {/* Gráfica: Tendencia de estimación (Hitss) */}
            <GraficaTendenciaAns titulo="ANS de estimación (Hitss)" descripcion={NOTA_ATRIBUCION_EPM} icono={<Icono nombre="portafolio" />} datos={tendenciaReqsEpmFiltrada} claveCumple="cumplePct" claveNoCumple="noCumplePct" acciones={<Boton tamano="sm" onClick={() => setDetalleAns('estimacion')}>Detalle</Boton>} />
            <ModalDetalleAnsHitss
              abierto={detalleAns !== null}
              onCerrar={cerrarDetalleAns}
              titulo={detalleAns === 'entregas' ? 'ANS de entregas (Hitss)' : 'ANS de estimación (Hitss)'}
              filas={filasDetalleAns}
              esEntrega={detalleAns === 'entregas'}
            />
          </section>

          {/* ════════════════════════════════════════════════════════════════════
              COLUMNA DERECHA — Soporte & WO
              ════════════════════════════════════════════════════════════════════ */}
          <section className="flex flex-col gap-6">
            {/* Section header */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-marca-50 text-lg text-marca-700">
                <Icono nombre="soporte" />
              </div>
              <div>
                <h2 className="titulo-seccion">Soporte &amp; Work Orders</h2>
                <p className="text-xs text-slate-500">Operaciones, ANS de soporte y tendencias</p>
              </div>
            </div>

            {/* Filtro */}
            <BarraFiltros titulo="Filtro por Fecha Fin Real">
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
                  <Boton onClick={() => { setAnosSop(new Set()); setMesesSop(new Set()) }}
                    variante="secundario" tamano="sm" icono={<Icono nombre="x" />}>
                    Limpiar
                  </Boton>
                )}
            </BarraFiltros>

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
            <GraficaTendenciaAns titulo="ANS Oportunidad" icono={<Icono nombre="objetivo" />} datos={ansTendenciaFiltrada} claveCumple="oportunidadPct" claveNoCumple="oportunidadNoCumplePct" />

            {/* Gráfica: ANS Cumplimiento */}
            <GraficaTendenciaAns titulo="ANS Cumplimiento" icono={<Icono nombre="check-circulo" />} datos={ansTendenciaFiltrada} claveCumple="cumplimientoPct" claveNoCumple="cumplimientoNoCumplePct" />

            {/* Gráfica: ANS Inicio Trabajo */}
            <GraficaTendenciaAns titulo="ANS Inicio Trabajo" icono={<Icono nombre="cohete" />} datos={ansTendenciaFiltrada} claveCumple="inicioPct" claveNoCumple="inicioNoCumplePct" />
          </section>

        </div>
      </div>
    </div>
  )
}
