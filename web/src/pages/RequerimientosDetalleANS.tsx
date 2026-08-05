import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client'
import { useLista } from '../api/hooks'
import type { Aplicacion, Persona, Requerimiento, Squad } from '../types'

interface FilaRequerimiento {
  id: string
  sc: string
  codigoReq: string
  nombre: string
  squad: string
  ltHitss: string
  estado: string
  ansActa: string | null
  horasEstimadas: number | null
  fechaLimite: string | null
  fechaRealEntregaEstimacion: string | null
}

interface FilaEntrega {
  id: string
  reqId: string
  codigoReq: string
  nombreReq: string
  sc: string
  squad: string
  ltHitss: string
  numero: number
  horas: number | null
  porcentaje: number | null
  fechaComprometida: string | null
  fechaReal: string | null
  estado: string | null
  ansEntrega: string | null
}

function normalizarAns(valor: string | null | undefined): string {
  const v = (valor ?? '').trim()
  return v || '—'
}

function badgeAns(valor: string | null | undefined): string {
  const v = (valor ?? '').trim().toUpperCase().replace(/[_-]+/g, ' ')
  if (v === 'CUMPLE') return 'bg-emerald-100 text-emerald-700'
  if (v === 'NO CUMPLE') return 'bg-red-100 text-red-700'
  return 'bg-slate-100 text-slate-600'
}

function calcularDiasTranscurridos(fechaLimite: string | null, fechaReal: string | null): { dias: number; esNegativo: boolean } | null {
  if (!fechaLimite) return null

  const hoy = new Date().toISOString().slice(0, 10)
  const inicio = fechaLimite.slice(0, 10)
  const fin = fechaReal ? fechaReal.slice(0, 10) : hoy

  const fecha1 = new Date(inicio)
  const fecha2 = new Date(fin)
  const diferencia = Math.floor((fecha2.getTime() - fecha1.getTime()) / (1000 * 60 * 60 * 24))

  let esNegativo = false
  if (!fechaReal && hoy > inicio) {
    esNegativo = true
  } else if (fechaReal && fechaReal.slice(0, 10) > inicio) {
    esNegativo = true
  }

  return { dias: Math.abs(diferencia), esNegativo }
}

const MESES = [
  ['01', 'Enero'], ['02', 'Febrero'], ['03', 'Marzo'], ['04', 'Abril'],
  ['05', 'Mayo'], ['06', 'Junio'], ['07', 'Julio'], ['08', 'Agosto'],
  ['09', 'Septiembre'], ['10', 'Octubre'], ['11', 'Noviembre'], ['12', 'Diciembre'],
] as const

export default function RequerimientosDetalleANS() {
  const { datos: requerimientos, error, cargando, recargar } = useLista<Requerimiento>('/requerimientos')
  const { datos: personas } = useLista<Persona>('/personas')
  const { datos: aplicaciones } = useLista<Aplicacion>('/aplicaciones')
  const [squadsCol, setSquadsCol] = useState<Squad[]>([])
  const [filtroTexto, setFiltroTexto] = useState('')
  const [anoLimite, setAnoLimite] = useState('')
  const [mesLimite, setMesLimite] = useState('')
  const [anoComprometida, setAnoComprometida] = useState('')
  const [mesComprometida, setMesComprometida] = useState('')
  const [mostrarRequerimientos, setMostrarRequerimientos] = useState(false)
  const [mostrarEntregas, setMostrarEntregas] = useState(false)

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') recargar()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [recargar])

  useEffect(() => {
    client
      .get<Squad[]>('/squads', { headers: { 'X-Aplicacion': '__todas__' } })
      .then((r) => setSquadsCol(r.data))
      .catch(() => {
        client.get<Squad[]>('/squads').then((r) => setSquadsCol(r.data)).catch(() => {})
      })
  }, [])

  const squadPorId = useMemo(() => {
    const m = new Map<string, string>()
    squadsCol.forEach((s) => m.set(String(s.id), s.nombre))
    aplicaciones.forEach((a) => m.set(String(a.codigo), a.nombre))
    return m
  }, [squadsCol, aplicaciones])

  const nombrePersona = useMemo(() => {
    const m = new Map<string, string>()
    personas.forEach((p) => m.set(p.id, p.nombre))
    return (id: string | null): string => (id ? (m.get(id) ?? id) : '—')
  }, [personas])

  const requerimientosRows = useMemo<FilaRequerimiento[]>(() => {
    return requerimientos.map((req) => ({
      id: req.id,
      sc: req.solicitud?.codigo_sc ?? '',
      codigoReq: req.codigo_req,
      nombre: req.nombre ?? '',
      squad: req.solicitud?.squad_id
        ? (squadPorId.get(String(req.solicitud.squad_id)) ?? String(req.solicitud.squad_id))
        : '',
    ltHitss: nombrePersona(req.solicitud?.lt_hitss_id ?? null),
      estado: req.estado ?? '',
      ansActa: req.ans_acta ?? null,
      horasEstimadas: req.total_horas_estimadas ?? null,
    fechaLimite: req.fecha_limite ?? null,
    fechaRealEntregaEstimacion: req.fecha_real_entrega_estimacion ?? null,
    }))
  }, [requerimientos, squadPorId, nombrePersona])

  const entregasRows = useMemo<FilaEntrega[]>(() => {
    const rows: FilaEntrega[] = []
    for (const req of requerimientos) {
      const squad = req.solicitud?.squad_id
        ? (squadPorId.get(String(req.solicitud.squad_id)) ?? String(req.solicitud.squad_id))
        : ''
      const ltHitss = nombrePersona(req.solicitud?.lt_hitss_id ?? null)
      for (const en of req.entregas ?? []) {
        const porcentaje =
          en.porcentaje != null
            ? en.porcentaje
            : en.horas != null && req.total_horas_estimadas
            ? Number(((Number(en.horas) * 100) / Number(req.total_horas_estimadas)).toFixed(1))
            : null
        rows.push({
          id: `${req.id}-${en.numero}`,
          reqId: req.id,
          codigoReq: req.codigo_req,
          nombreReq: req.nombre ?? '',
          sc: req.solicitud?.codigo_sc ?? '',
          squad,
          ltHitss,
          numero: en.numero,
          horas: en.horas ?? null,
          porcentaje,
          fechaComprometida: en.fecha_comprometida ?? null,
          fechaReal: en.fecha_recepcion ?? null,
          estado: en.estado ?? null,
          ansEntrega: en.ans_entrega ?? null,
        })
      }
    }
    return rows
  }, [requerimientos, squadPorId, nombrePersona])

  const anosDisponibles = useMemo(() => {
    const anos = new Set<string>()
    requerimientosRows.forEach((r) => {
      if (r.fechaLimite) anos.add(r.fechaLimite.slice(0, 4))
    })
    entregasRows.forEach((e) => {
      if (e.fechaComprometida) anos.add(e.fechaComprometida.slice(0, 4))
    })
    return Array.from(anos).sort()
  }, [requerimientosRows, entregasRows])

  const requerimientosFiltrados = useMemo(() => {
    const t = filtroTexto.trim().toLowerCase()
    const base = requerimientosRows
      .filter((r) => (r.ansActa ?? '').toUpperCase() === 'NO_CUMPLE')
      .filter((r) => {
        const fecha = r.fechaLimite?.slice(0, 10) ?? ''
        if (anoLimite && (!fecha || fecha.slice(0, 4) !== anoLimite)) return false
        if (mesLimite && (!fecha || fecha.slice(5, 7) !== mesLimite)) return false
        return true
      })
    if (!t) return base
    return base.filter((r) =>
      [r.sc, r.codigoReq, r.nombre, r.squad, r.ltHitss, r.estado, r.ansActa ?? '']
        .join(' ')
        .toLowerCase()
        .includes(t),
    )
  }, [requerimientosRows, filtroTexto, anoLimite, mesLimite])

  const entregasFiltradas = useMemo(() => {
    const t = filtroTexto.trim().toLowerCase()
    const base = entregasRows.filter((e) => (e.ansEntrega ?? '').toUpperCase() === 'NO_CUMPLE')
      .filter((e) => {
        const fecha = e.fechaComprometida?.slice(0, 10) ?? ''
        if (anoComprometida && (!fecha || fecha.slice(0, 4) !== anoComprometida)) return false
        if (mesComprometida && (!fecha || fecha.slice(5, 7) !== mesComprometida)) return false
        return true
      })
    if (!t) return base
    return base.filter((e) =>
      [e.codigoReq, e.nombreReq, e.sc, e.squad, String(e.numero), e.estado ?? '', e.ansEntrega ?? '']
        .join(' ')
        .toLowerCase()
        .includes(t),
    )
  }, [entregasRows, filtroTexto, anoComprometida, mesComprometida])

  const resumenReq = useMemo(() => {
    const total = requerimientosRows.filter((r) => (r.ansActa ?? '').toUpperCase() === 'NO_CUMPLE').length
    return { total }
  }, [requerimientosRows])

  const resumenEnt = useMemo(() => {
    const total = entregasRows.filter((e) => (e.ansEntrega ?? '').toUpperCase() === 'NO_CUMPLE').length
    return { total }
  }, [entregasRows])

  if (cargando) return <div className="p-6 text-slate-500">Cargando detalle ANS…</div>

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-marca-osc">Detalle ANS</h1>
          <p className="mt-1 text-sm text-slate-500">
            Vista consolidada de requerimientos y entregas con sus estados ANS.
          </p>
        </div>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Buscar</span>
          <input
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            placeholder="REQ, SC, squad, ANS…"
            className="w-72 rounded border px-3 py-2 text-sm"
          />
        </label>
        {(filtroTexto || anoLimite || mesLimite || anoComprometida || mesComprometida) && (
          <button
            type="button"
            onClick={() => {
              setFiltroTexto('')
              setAnoLimite('')
              setMesLimite('')
              setAnoComprometida('')
              setMesComprometida('')
            }}
            className="text-xs text-red-500 hover:underline"
          >
            Limpiar
          </button>
        )}
        <span className="ml-auto text-xs text-slate-400">
          {requerimientosFiltrados.length} requerimientos · {entregasFiltradas.length} entregas
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-500">Requerimientos</p>
          <p className="text-2xl font-bold text-slate-900">{resumenReq.total}</p>
          <p className="text-xs text-slate-500">solo ANS acta no cumple</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-500">Entregas</p>
          <p className="text-2xl font-bold text-slate-900">{resumenEnt.total}</p>
          <p className="text-xs text-slate-500">solo ANS entrega no cumple</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-500">Filtrado</p>
          <p className="text-2xl font-bold text-slate-900">{filtroTexto ? 'Activo' : 'Sin filtros'}</p>
          <p className="text-xs text-slate-500">Aplica a ambas tablas</p>
        </div>
      </div>

      <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => setMostrarRequerimientos((v) => !v)}
          aria-expanded={mostrarRequerimientos}
          className="flex w-full items-center justify-between border-b border-slate-200 px-4 py-3 text-left"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
            Requerimientos
          </h2>
          <span className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {requerimientosFiltrados.length} / {requerimientosRows.filter((r) => (r.ansActa ?? '').toUpperCase() === 'NO_CUMPLE').length}
            </span>
            <span className="text-xs text-slate-400">{mostrarRequerimientos ? 'Ocultar' : 'Mostrar'}</span>
          </span>
        </button>
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
          <DateFilter label="Fecha límite" year={anoLimite} month={mesLimite} years={anosDisponibles}
            onYearChange={setAnoLimite} onMonthChange={setMesLimite} />
        </div>
        {mostrarRequerimientos && (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-700">
            <tr>
                <th className="p-2">Código REQ</th>
                <th className="p-2">SC</th>
                <th className="p-2">Nombre</th>
                <th className="p-2">Squad</th>
                <th className="p-2">Lt hitss</th>
                <th className="p-2">Estado</th>
                <th className="p-2">ANS Acta</th>
                <th className="p-2 text-right">Horas estimadas</th>
                <th className="p-2">Fecha límite</th>
                <th className="p-2">Fecha real entrega de estimaciones</th>
                <th className="p-2 text-right">Días transcurridos</th>
              </tr>
            </thead>
            <tbody>
              {requerimientosFiltrados.length === 0 ? (
                <tr className="border-t">
                    <td className="p-4 text-center text-slate-400" colSpan={11}>Sin registros</td>
                  </tr>
                ) : (
                  requerimientosFiltrados.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">
                      <Link to={`/requerimientos/${r.id}`} className="font-medium text-marca hover:underline">
                        {r.codigoReq}
                      </Link>
                    </td>
                    <td className="p-2 text-slate-600">{r.sc || '—'}</td>
                    <td className="p-2">{r.nombre || '—'}</td>
                    <td className="p-2">{r.squad || '—'}</td>
                    <td className="p-2">{r.ltHitss || '—'}</td>
                    <td className="p-2">{r.estado || '—'}</td>
                    <td className="p-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeAns(r.ansActa)}`}>
                        {normalizarAns(r.ansActa)}
                      </span>
                    </td>
                    <td className="p-2 text-right">{r.horasEstimadas ?? '—'}</td>
                    <td className="p-2">{r.fechaLimite ? r.fechaLimite.slice(0, 10) : '—'}</td>
                    <td className="p-2">
                      {r.fechaRealEntregaEstimacion ? r.fechaRealEntregaEstimacion.slice(0, 10) : '—'}
                    </td>
                    <td className="p-2 text-right">
                      {(() => {
                        const result = calcularDiasTranscurridos(r.fechaLimite, r.fechaRealEntregaEstimacion)
                        if (!result) return '—'
                        const color = result.esNegativo ? 'text-red-600 font-semibold' : 'text-emerald-600'
                        return (
                          <span className={color}>
                            {result.esNegativo ? '-' : '+'}{result.dias}
                          </span>
                        )
                      })()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold text-slate-700">
                <td className="p-2" colSpan={7}>Total ({requerimientosFiltrados.length} requerimientos)</td>
                <td className="p-2 text-right">
                  {requerimientosFiltrados.reduce((total, r) => total + Number(r.horasEstimadas ?? 0), 0)}
                </td>
                <td className="p-2" colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        )}
      </section>

      <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => setMostrarEntregas((v) => !v)}
          aria-expanded={mostrarEntregas}
          className="flex w-full items-center justify-between border-b border-slate-200 px-4 py-3 text-left"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
            Entregas
          </h2>
          <span className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {entregasFiltradas.length} / {entregasRows.filter((e) => (e.ansEntrega ?? '').toUpperCase() === 'NO_CUMPLE').length}
            </span>
            <span className="text-xs text-slate-400">{mostrarEntregas ? 'Ocultar' : 'Mostrar'}</span>
          </span>
        </button>
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
          <DateFilter label="F. comprometida" year={anoComprometida} month={mesComprometida} years={anosDisponibles}
            onYearChange={setAnoComprometida} onMonthChange={setMesComprometida} />
        </div>
        {mostrarEntregas && (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-700">
            <tr>
              <th className="p-2">Código REQ</th>
              <th className="p-2">N° Entrega</th>
              <th className="p-2">SC</th>
              <th className="p-2">Squad</th>
              <th className="p-2">LT hitss</th>
              <th className="p-2">Horas</th>
              <th className="p-2 text-right">% Avance</th>
              <th className="p-2">F. Comprometida</th>
              <th className="p-2">F. Real</th>
              <th className="p-2 text-right">Días transcurridos</th>
              <th className="p-2">Estado</th>
              <th className="p-2">ANS Entrega</th>
            </tr>
            </thead>
            <tbody>
              {entregasFiltradas.length === 0 ? (
                <tr className="border-t">
                  <td className="p-4 text-center text-slate-400" colSpan={12}>Sin entregas</td>
                </tr>
              ) : (
                entregasFiltradas.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="p-2">
                      <Link to={`/requerimientos/${e.reqId}`} className="font-medium text-marca hover:underline">
                        {e.codigoReq}
                      </Link>
                    </td>
                    <td className="p-2 text-center">{e.numero}</td>
                    <td className="p-2 text-slate-600">{e.sc || '—'}</td>
                    <td className="p-2">{e.squad || '—'}</td>
                    <td className="p-2">{e.ltHitss}</td>
                    <td className="p-2">{e.horas ?? '—'}</td>
                    <td className="p-2 text-right">{e.porcentaje != null ? `${e.porcentaje}%` : '—'}</td>
                    <td className="p-2">{e.fechaComprometida ? e.fechaComprometida.slice(0, 10) : '—'}</td>
                    <td className="p-2">{e.fechaReal ? e.fechaReal.slice(0, 10) : '—'}</td>
                    <td className="p-2 text-right">
                      {(() => {
                        const result = calcularDiasTranscurridos(e.fechaComprometida, e.fechaReal)
                        if (!result) return '—'
                        const color = result.esNegativo ? 'text-red-600 font-semibold' : 'text-emerald-600'
                        return (
                          <span className={color}>
                            {result.esNegativo ? '-' : '+'}{result.dias}
                          </span>
                        )
                      })()}
                    </td>
                    <td className="p-2">{e.estado || '—'}</td>
                    <td className="p-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeAns(e.ansEntrega)}`}>
                        {normalizarAns(e.ansEntrega)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold text-slate-700">
                <td className="p-2" colSpan={5}>Total ({entregasFiltradas.length} entregas)</td>
                <td className="p-2 text-right">
                  {entregasFiltradas.reduce((total, e) => total + Number(e.horas ?? 0), 0)}
                </td>
                <td className="p-2" colSpan={6}></td>
              </tr>
            </tfoot>
          </table>
        )}
      </section>
    </div>
  )
}

function DateFilter({
  label,
  year,
  month,
  years,
  onYearChange,
  onMonthChange,
}: {
  label: string
  year: string
  month: string
  years: string[]
  onYearChange: (value: string) => void
  onMonthChange: (value: string) => void
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-sm">
        <span className="mb-1 block text-slate-600">{label} - año</span>
        <select value={year} onChange={(e) => onYearChange(e.target.value)} className="rounded border px-3 py-2 text-sm">
          <option value="">Todos los años</option>
          {years.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-slate-600">{label} - mes</span>
        <select value={month} onChange={(e) => onMonthChange(e.target.value)} className="rounded border px-3 py-2 text-sm">
          <option value="">Todos los meses</option>
          {MESES.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
        </select>
      </label>
    </div>
  )
}
