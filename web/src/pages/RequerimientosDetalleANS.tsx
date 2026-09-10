import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client'
import { mensajeError, useLista } from '../api/hooks'
import { useAuth } from '../context/AuthContext'
import type { Aplicacion, Persona, Requerimiento, Squad } from '../types'
import { Boton, Chip, EncabezadoPagina, Icono, TablaScroll } from '../components/ui'

type TonoChip = 'neutro' | 'marca' | 'exito' | 'alerta' | 'error'

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
  seLevanto: boolean
  observacionesAns: string
  seguimientoHitss: string | null
  seguimientoEpm: string | null
  tipificacion: string | null
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
  entregaNumero: number
  seLevanto: boolean
  observacionesAns: string
  observacionesEpm: string | null
  observacionesHitss: string | null
  tipificacion: string | null
}

function normalizarAns(valor: string | null | undefined): string {
  const v = (valor ?? '').trim()
  return v || '—'
}

function tonoAns(valor: string | null | undefined): TonoChip {
  const v = (valor ?? '').trim().toUpperCase().replace(/[_-]+/g, ' ')
  if (v === 'CUMPLE') return 'exito'
  if (v === 'NO CUMPLE') return 'error'
  return 'neutro'
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
  const [mesLimite, setMesLimite] = useState<string[]>([])
  const [anoComprometida, setAnoComprometida] = useState('')
  const [mesComprometida, setMesComprometida] = useState<string[]>([])
  const [mostrarRequerimientos, setMostrarRequerimientos] = useState(false)
  const [mostrarEntregas, setMostrarEntregas] = useState(false)
  const [guardandoCheck, setGuardandoCheck] = useState<Set<string>>(new Set())
  const [guardandoObs, setGuardandoObs] = useState<Set<string>>(new Set())
  const [obsEdicion, setObsEdicion] = useState<Record<string, string>>({})
  const [aviso, setAviso] = useState('')
  const { tienePermiso } = useAuth()
  const puedeEditar = tienePermiso('requerimientos.detalle_ans.editar') || tienePermiso('requerimientos.editar')

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
    seLevanto: !!(req as any).se_levanto_ans,
    observacionesAns: (req as any).observaciones_ans ?? '',
    seguimientoHitss: (req as any).seguimiento ?? null,
    seguimientoEpm: (req as any).seguimiento_epm ?? null,
    tipificacion: (req as any).tipificacion ?? null,
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
          entregaNumero: en.numero,
          seLevanto: !!(en as any).se_levanto_ans,
          observacionesAns: (en as any).observaciones_ans ?? '',
          observacionesEpm: (en as any).observaciones ?? null,
          observacionesHitss: (en as any).observaciones_hitss ?? null,
          tipificacion: (en as any).tipificacion ?? null,
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
        if (mesLimite.length && (!fecha || !mesLimite.includes(fecha.slice(5, 7)))) return false
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
        if (mesComprometida.length && (!fecha || !mesComprometida.includes(fecha.slice(5, 7)))) return false
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

  async function guardarCheck(tipo: 'requerimiento' | 'entrega', reqId: string, checked: boolean, entregaNumero?: number) {
    const key = tipo === 'entrega' ? `${reqId}-${entregaNumero}` : reqId
    setGuardandoCheck((s) => new Set(s).add(key))
    try {
      await client.patch('/requerimientos/detalle-ans', {
        tipo,
        req_id: reqId,
        entrega_numero: entregaNumero ?? null,
        se_levanto_ans: checked,
      })
      await recargar()
    } catch (err) { setAviso(mensajeError(err)) }
    finally { setGuardandoCheck((s) => { const n = new Set(s); n.delete(key); return n }) }
  }

  async function guardarObservacion(tipo: 'requerimiento' | 'entrega', reqId: string, entregaNumero?: number) {
    const key = tipo === 'entrega' ? `${reqId}-${entregaNumero}` : reqId
    const obs = obsEdicion[key] ?? ''
    setGuardandoObs((s) => new Set(s).add(key))
    try {
      await client.patch('/requerimientos/detalle-ans', {
        tipo,
        req_id: reqId,
        entrega_numero: entregaNumero ?? null,
        observaciones: obs,
      })
      await recargar()
      setObsEdicion((p) => { const n = { ...p }; delete n[key]; return n })
    } catch (err) { setAviso(mensajeError(err)) }
    finally { setGuardandoObs((s) => { const n = new Set(s); n.delete(key); return n }) }
  }

  return (
    <div className="space-y-4">
      <EncabezadoPagina
        icono={<Icono nombre="check-circulo" />}
        titulo="Detalle ANS"
        descripcion="Vista consolidada de requerimientos y entregas con sus estados ANS."
      />

      {error && <div className="aviso aviso-error">{error}</div>}
      {aviso && <div className="aviso aviso-alerta">{aviso}</div>}

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <label className="w-full text-sm sm:w-auto">
          <span className="mb-1 block text-slate-600">Buscar</span>
          <input
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            placeholder="REQ, SC, squad, ANS…"
            className="campo w-full sm:w-72"
          />
        </label>
        {(filtroTexto || anoLimite || mesLimite.length > 0 || anoComprometida || mesComprometida.length > 0) && (
          <button
            type="button"
            onClick={() => {
              setFiltroTexto('')
              setAnoLimite('')
              setMesLimite([])
              setAnoComprometida('')
              setMesComprometida([])
            }}
            className="enlace-accion enlace-accion-peligro text-xs"
          >
            Limpiar
          </button>
        )}
        <span className="text-xs text-slate-400 sm:ml-auto">
          {requerimientosFiltrados.length} requerimientos · {entregasFiltradas.length} entregas
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="tarjeta tarjeta-pad flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-lg text-indigo-600"><Icono nombre="portafolio" /></span>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Requerimientos con ANS incumplido</p>
            <p className="text-2xl font-bold text-slate-900">{resumenReq.total}</p>
            <p className="text-xs text-slate-400">Cumplimiento ANS (Acta) = No cumple</p>
          </div>
        </div>
        <div className="tarjeta tarjeta-pad flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-lg text-amber-600"><Icono nombre="caja" /></span>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Entregas con ANS incumplido</p>
            <p className="text-2xl font-bold text-slate-900">{resumenEnt.total}</p>
            <p className="text-xs text-slate-400">Cumplimiento ANS (Entrega) = No cumple</p>
          </div>
        </div>
        <div className="tarjeta tarjeta-pad flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-lg text-emerald-600"><Icono nombre="lupa" /></span>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Filtros aplicados</p>
            <p className="text-2xl font-bold text-slate-900">{filtroTexto ? 'Activo' : 'Ninguno'}</p>
            <p className="text-xs text-slate-400">Se aplican a ambas tablas</p>
          </div>
        </div>
      </div>

      <section className="w-full rounded-xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setMostrarRequerimientos((v) => !v)}
          aria-expanded={mostrarRequerimientos}
          className="flex w-full flex-col items-start gap-3 border-b border-slate-200 px-4 py-3 text-left hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-marca">
              <Icono nombre={mostrarRequerimientos ? 'chevron-arriba' : 'chevron-abajo'} />
              {mostrarRequerimientos ? 'Ocultar' : 'Mostrar'}
            </span>
            <div className="min-w-0">
              <h2 className="titulo-seccion text-sm">Requerimientos y su cumplimiento ANS</h2>
              <p className="text-xs text-slate-400">Estimaciones frente a la fecha límite pactada</p>
            </div>
          </div>
          <span className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
            <span className="chip chip-neutro" title="Requerimientos visibles con los filtros actuales">
              {requerimientosFiltrados.length} visibles
            </span>
            <span className="chip chip-error" title="Total con ANS incumplido, sin filtros">
              {requerimientosRows.filter((r) => (r.ansActa ?? '').toUpperCase() === 'NO_CUMPLE').length} incumplen ANS
            </span>
          </span>
        </button>
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
          <DateFilter label="Fecha límite" year={anoLimite} month={mesLimite} years={anosDisponibles}
            onYearChange={setAnoLimite} onMonthChange={setMesLimite} />
        </div>
        {mostrarRequerimientos && (
          <TablaScroll plano>
          <table className="tabla">
            <thead>
            <tr>
                <th>Código REQ</th>
                <th>SC</th>
                <th>Nombre</th>
                <th>Squad</th>
                <th>LT HITSS</th>
                <th>Estado</th>
                <th>Cumplimiento ANS (Acta)</th>
                <th className="text-right">Horas estimadas</th>
                <th>Fecha límite</th>
                <th>F. Real entrega estimación</th>
                <th className="text-right">Días de atraso/adelanto</th>
                <th className="text-center">¿Incumplió ANS?</th>
                <th>Observaciones</th>
                <th>Seguimiento Hitss</th>
                <th>Seguimiento EPM</th>
                <th>Tipificación</th>
              </tr>
            </thead>
            <tbody>
              {requerimientosFiltrados.length === 0 ? (
                <tr>
                    <td className="p-4 text-center text-slate-400" colSpan={16}>Sin registros</td>
                  </tr>
                ) : (
                  requerimientosFiltrados.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link to={`/requerimientos/${r.id}`} className="font-medium text-marca hover:underline">
                        {r.codigoReq}
                      </Link>
                    </td>
                    <td className="text-slate-600">{r.sc || '—'}</td>
                    <td>{r.nombre || '—'}</td>
                    <td>{r.squad || '—'}</td>
                    <td>{r.ltHitss || '—'}</td>
                    <td>{r.estado || '—'}</td>
                    <td>
                      <Chip tono={tonoAns(r.ansActa)}>{normalizarAns(r.ansActa)}</Chip>
                    </td>
                    <td className="text-right">{r.horasEstimadas ?? '—'}</td>
                    <td>{r.fechaLimite ? r.fechaLimite.slice(0, 10) : '—'}</td>
                    <td>
                      {r.fechaRealEntregaEstimacion ? r.fechaRealEntregaEstimacion.slice(0, 10) : '—'}
                    </td>
                    <td className="text-right">
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
                    <td className="text-center">
                      <label className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold ${
                        r.seLevanto ? 'border-green-200 bg-green-50 text-green-700' : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}>
                        <input
                          type="checkbox"
                          checked={r.seLevanto}
                          disabled={!puedeEditar || guardandoCheck.has(r.id)}
                          onChange={(ev) => void guardarCheck('requerimiento', r.id, ev.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-marca focus:ring-marca"
                        />
                        {guardandoCheck.has(r.id) ? '…' : r.seLevanto ? 'Sí' : 'No'}
                      </label>
                    </td>
                    <td>
                      <div className="flex min-w-[220px] gap-1.5">
                        <input
                          value={obsEdicion[r.id] ?? r.observacionesAns}
                          onChange={(ev) => setObsEdicion((p) => ({ ...p, [r.id]: ev.target.value }))}
                          readOnly={!puedeEditar}
                          className="campo campo-sm min-w-0 flex-1"
                          placeholder={puedeEditar ? 'Observaciones…' : ''}
                        />
                        {puedeEditar && (
                          <Boton variante="primario" tamano="sm" className="shrink-0" type="button"
                            onClick={() => void guardarObservacion('requerimiento', r.id)}
                            disabled={guardandoObs.has(r.id)}>
                            {guardandoObs.has(r.id) ? '…' : 'Guardar'}
                          </Boton>
                        )}
                      </div>
                    </td>
                      <td className="max-w-[220px] whitespace-pre-wrap text-xs text-slate-600">{r.seguimientoHitss || '—'}</td>
                      <td className="max-w-[220px] whitespace-pre-wrap text-xs text-slate-600">{r.seguimientoEpm || '—'}</td>
                      <td>{r.tipificacion === 'HITSS' ? 'Hitss' : r.tipificacion === 'EPM' ? 'EPM' : '—'}</td>
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
                <td className="p-2" colSpan={8}></td>
              </tr>
            </tfoot>
          </table>
          </TablaScroll>
        )}
      </section>

      <section className="w-full rounded-xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setMostrarEntregas((v) => !v)}
          aria-expanded={mostrarEntregas}
          className="flex w-full flex-col items-start gap-3 border-b border-slate-200 px-4 py-3 text-left hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-marca">
              <Icono nombre={mostrarEntregas ? 'chevron-arriba' : 'chevron-abajo'} />
              {mostrarEntregas ? 'Ocultar' : 'Mostrar'}
            </span>
            <div className="min-w-0">
              <h2 className="titulo-seccion text-sm">Entregas y su cumplimiento ANS</h2>
              <p className="text-xs text-slate-400">Fecha comprometida frente a fecha real de entrega</p>
            </div>
          </div>
          <span className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
            <span className="chip chip-neutro" title="Entregas visibles con los filtros actuales">
              {entregasFiltradas.length} visibles
            </span>
            <span className="chip chip-error" title="Total con ANS incumplido, sin filtros">
              {entregasRows.filter((e) => (e.ansEntrega ?? '').toUpperCase() === 'NO_CUMPLE').length} incumplen ANS
            </span>
          </span>
        </button>
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
          <DateFilter label="F. comprometida" year={anoComprometida} month={mesComprometida} years={anosDisponibles}
            onYearChange={setAnoComprometida} onMonthChange={setMesComprometida} />
        </div>
        {mostrarEntregas && (
          <TablaScroll plano>
          <table className="tabla">
            <thead>
            <tr>
              <th>Código REQ</th>
              <th>N° Entrega</th>
              <th>SC</th>
              <th>Squad</th>
              <th>LT HITSS</th>
              <th>Horas</th>
              <th className="text-right">% Avance</th>
              <th>F. Comprometida</th>
              <th>F. Real</th>
              <th className="text-right">Días de atraso/adelanto</th>
              <th>Estado</th>
              <th>Cumplimiento ANS (Entrega)</th>
              <th className="text-center">¿Incumplió ANS?</th>
              <th>Observaciones</th>
              <th>Observaciones EPM</th>
              <th>Observaciones Hitss</th>
              <th>Tipificación</th>
            </tr>
            </thead>
            <tbody>
              {entregasFiltradas.length === 0 ? (
                <tr>
                  <td className="p-4 text-center text-slate-400" colSpan={17}>Sin entregas</td>
                </tr>
              ) : (
                entregasFiltradas.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Link to={`/requerimientos/${e.reqId}`} className="font-medium text-marca hover:underline">
                        {e.codigoReq}
                      </Link>
                    </td>
                    <td className="text-center">{e.numero}</td>
                    <td className="text-slate-600">{e.sc || '—'}</td>
                    <td>{e.squad || '—'}</td>
                    <td>{e.ltHitss}</td>
                    <td>{e.horas ?? '—'}</td>
                    <td className="text-right">{e.porcentaje != null ? `${e.porcentaje}%` : '—'}</td>
                    <td>{e.fechaComprometida ? e.fechaComprometida.slice(0, 10) : '—'}</td>
                    <td>{e.fechaReal ? e.fechaReal.slice(0, 10) : '—'}</td>
                    <td className="text-right">
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
                    <td>{e.estado || '—'}</td>
                    <td>
                      <Chip tono={tonoAns(e.ansEntrega)}>{normalizarAns(e.ansEntrega)}</Chip>
                    </td>
                    <td className="text-center">
                      <label className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold ${
                        e.seLevanto ? 'border-green-200 bg-green-50 text-green-700' : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}>
                        <input
                          type="checkbox"
                          checked={e.seLevanto}
                          disabled={!puedeEditar || guardandoCheck.has(e.id)}
                          onChange={(ev) => void guardarCheck('entrega', e.reqId, ev.target.checked, e.entregaNumero)}
                          className="h-4 w-4 rounded border-slate-300 text-marca focus:ring-marca"
                        />
                        {guardandoCheck.has(e.id) ? '…' : e.seLevanto ? 'Sí' : 'No'}
                      </label>
                    </td>
                    <td>
                      <div className="flex min-w-[220px] gap-1.5">
                        <input
                          value={obsEdicion[e.id] ?? e.observacionesAns}
                          onChange={(ev) => setObsEdicion((p) => ({ ...p, [e.id]: ev.target.value }))}
                          readOnly={!puedeEditar}
                          className="campo campo-sm min-w-0 flex-1"
                          placeholder={puedeEditar ? 'Observaciones…' : ''}
                        />
                        {puedeEditar && (
                          <Boton variante="primario" tamano="sm" className="shrink-0" type="button"
                            onClick={() => void guardarObservacion('entrega', e.reqId, e.entregaNumero)}
                            disabled={guardandoObs.has(e.id)}>
                            {guardandoObs.has(e.id) ? '…' : 'Guardar'}
                          </Boton>
                        )}
                      </div>
                    </td>
                    <td className="max-w-[220px] whitespace-pre-wrap text-xs text-slate-600">{e.observacionesEpm || '—'}</td>
                    <td className="max-w-[220px] whitespace-pre-wrap text-xs text-slate-600">{e.observacionesHitss || '—'}</td>
                    <td>{e.tipificacion === 'HITSS' ? 'Hitss' : e.tipificacion === 'EPM' ? 'EPM' : '—'}</td>
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
                <td className="p-2" colSpan={11}></td>
              </tr>
            </tfoot>
          </table>
          </TablaScroll>
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
  month: string[]
  years: string[]
  onYearChange: (value: string) => void
  onMonthChange: (value: string[]) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickFuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', onClickFuera)
    return () => document.removeEventListener('mousedown', onClickFuera)
  }, [])

  function toggleMes(value: string) {
    if (month.includes(value)) onMonthChange(month.filter((m) => m !== value))
    else onMonthChange([...month, value])
  }

  const resumenMeses = month.length === 0
    ? 'Todos los meses'
    : month.length === 1
      ? MESES.find(([value]) => value === month[0])?.[1] ?? month[0]
      : `${month.length} meses`

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-sm">
        <span className="mb-1 block text-slate-600">{label} - año</span>
        <select value={year} onChange={(e) => onYearChange(e.target.value)} className="campo">
          <option value="">Todos los años</option>
          {years.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <div className="relative text-sm" ref={ref}>
        <span className="mb-1 block text-slate-600">{label} - mes</span>
        <Boton
          variante="secundario"
          onClick={() => setAbierto((v) => !v)}
          className="min-w-[160px] text-left"
        >
          {resumenMeses}
        </Boton>
        {abierto && (
          <div className="absolute z-50 mt-1 max-h-64 w-48 overflow-y-auto rounded border bg-white p-2 shadow-lg">
            <label className="flex items-center gap-2 border-b pb-1 text-xs">
              <input
                type="checkbox"
                checked={month.length === 0}
                onChange={() => onMonthChange([])}
              />
              Todos los meses
            </label>
            {MESES.map(([value, name]) => (
              <label key={value} className="flex items-center gap-2 py-1 text-xs">
                <input
                  type="checkbox"
                  checked={month.includes(value)}
                  onChange={() => toggleMes(value)}
                />
                {name}
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
