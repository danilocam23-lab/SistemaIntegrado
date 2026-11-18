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
  filasDetalleEntrega,
  filasDetalleReq,
} from './dashboard-requerimientos/calculoAns'
import {
  anosDisponibles, derivarRequerimientos, derivarSoporte, normalizarTexto,
} from './dashboard-requerimientos/filtrosFechas'
import type { RegistroSoporte } from './dashboard-requerimientos/filtrosFechas'
import { useCorteColombia, useFiltroTemporal } from './dashboard-requerimientos/useRelojDashboard'

export default function DashboardRequerimientos() {
  const { datos: reqs, cargando, error: errorReq } = useLista<Requerimiento>('/requerimientos')
  const { datos: personas } = useLista<Persona>('/personas')
  // El resumen devuelve un objeto, no una lista: useLista no cubre este contrato.
  const [registrosSoporte, setRegistrosSoporte] = useState<RegistroSoporte[]>([])
  const [cargandoSoporte, setCargandoSoporte] = useState(true)
  const [errorSoporte, setErrorSoporte] = useState('')
  const hoy = useCorteColombia()
  const anoActual = hoy.slice(0, 4)
  // Filtros independientes por fuente de datos
  const filtroReq = useFiltroTemporal(hoy)
  const filtroSop = useFiltroTemporal(hoy)
  const { anos: anosReq, meses: mesesReq, setAnos: setAnosReq, setMeses: setMesesReq } = filtroReq
  const { anos: anosSop, meses: mesesSop, setAnos: setAnosSop, setMeses: setMesesSop } = filtroSop

  useEffect(() => {
    let vigente = true
    client
      .get<{ registros: RegistroSoporte[] }>('/soporte/solicitudes-fabrica/resumen')
      .then((r) => {
        if (!Array.isArray(r.data.registros)) throw new Error('Resumen de soporte inválido')
        if (vigente) setRegistrosSoporte(r.data.registros)
      })
      .catch(() => {
        if (vigente) setErrorSoporte('No fue posible cargar Soporte y Work Orders.')
      })
      .finally(() => {
        if (vigente) setCargandoSoporte(false)
      })
    return () => { vigente = false }
  }, [])

  const datosReq = useMemo(() => derivarRequerimientos(reqs, filtroReq), [reqs, anosReq, mesesReq, hoy])
  const datosSop = useMemo(() => derivarSoporte(registrosSoporte, filtroSop), [registrosSoporte, anosSop, mesesSop, hoy])
  const {
    kpis, porMes: porMesFiltrado, tendencia: tendenciaFiltrada, tendenciaEpm: tendenciaEpmFiltrada,
    tendenciaReqs: tendenciaReqsFiltrada, tendenciaReqsEpm: tendenciaReqsEpmFiltrada,
  } = datosReq
  const {
    workOrderIDFiltrado, woPorLt, woPorMes: woPorMesFiltrado,
    ansTendencia: ansTendenciaFiltrada, ansOportShow, ansCumplShow, ansInicioShow,
  } = datosSop

  // ─── Detalle de las gráficas ANS (Hitss): mismo universo que los KPI "(Hitss)" ───
  const [detalleAns, setDetalleAns] = useState<'entregas' | 'estimacion' | null>(null)
  const cerrarDetalleAns = useCallback(() => setDetalleAns(null), [])
  const filasDetalleAns = useMemo(() => {
    if (!detalleAns) return []
    const nombrePersona = (id: string | null): string =>
      id ? (personas.find((p) => p.id === id)?.nombre ?? id) : '—'
    if (detalleAns === 'estimacion') {
      return filasDetalleReq(datosReq.itemsReq, nombrePersona)
    }
    return filasDetalleEntrega(datosReq.itemsEnt, reqs, nombrePersona)
  }, [detalleAns, reqs, personas, datosReq])

  // ─── Equipo: solo Líderes Técnicos HITSS ───────────────
  const equipo = useMemo(() => {
    const conteo = datosReq.porLt
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
  }, [datosReq, personas])

  // ─── Años disponibles por fuente ───────────────────────
  const anosDisponiblesReq = useMemo(() => {
    return anosDisponibles(reqs.flatMap((r) => [
      r.fecha_inicio ?? r.fecha_solicitud_acta, r.fecha_solicitud_acta,
      ...(r.entregas ?? []).map((e) => e.fecha_recepcion ?? e.fecha_comprometida),
    ]), hoy)
  }, [reqs, hoy])

  const anosDisponiblesSop = useMemo(() => {
    return anosDisponibles(registrosSoporte.map((r) => r.Fecha_Fin_Real), hoy)
  }, [registrosSoporte, hoy])

  const MESES_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

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
        <Aviso tono="info">
          Corte al {hoy.split('-').reverse().join('/')} (hora de Colombia). Año inicial: {anoActual}.
          {' '}Se excluyen fechas futuras, ausentes o inválidas según la fecha de cada métrica.
        </Aviso>
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
                  valorInicial={anoActual}
                />
                <FiltroDesplegable
                  label="Mes" icono={<Icono nombre="calendario" />}
                  opciones={MESES_LABELS}
                  activos={mesesReq}
                  setActivos={setMesesReq}
                  esMes
                />
                  <Boton onClick={filtroReq.restablecer}
                    variante="secundario" tamano="sm" icono={<Icono nombre="x" />}>
                    Restablecer
                  </Boton>
            </BarraFiltros>

            {cargando ? (
              <Aviso tono="info">Cargando Requerimientos y Actas…</Aviso>
            ) : errorReq ? (
              <Aviso tono="error">{errorReq}</Aviso>
            ) : (
              <>
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
                        <Chip tono="neutro">{cargandoSoporte || errorSoporte ? '—' : (woPorLt[m.nombreKey] ?? 0)} WO</Chip>
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
              </>
            )}
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
                  valorInicial={anoActual}
                />
                <FiltroDesplegable
                  label="Mes" icono={<Icono nombre="calendario" />}
                  opciones={MESES_LABELS}
                  activos={mesesSop}
                  setActivos={setMesesSop}
                  esMes
                />
                  <Boton onClick={filtroSop.restablecer}
                    variante="secundario" tamano="sm" icono={<Icono nombre="x" />}>
                    Restablecer
                  </Boton>
            </BarraFiltros>

            {cargandoSoporte ? (
              <Aviso tono="info">Cargando Soporte y Work Orders…</Aviso>
            ) : errorSoporte ? (
              <Aviso tono="error">{errorSoporte}</Aviso>
            ) : (
              <>
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
              </>
            )}
          </section>

        </div>
      </div>
    </div>
  )
}
