import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client'
import { useLista } from '../api/hooks'
import type { Aplicacion, Requerimiento, Squad } from '../types'

interface FilaEntrega {
  reqId: string
  codigoReq: string
  sc: string
  squad: string
  nombreActa: string
  entregaNum: number
  horas: number | null
  porcentaje: number | null
  fechaComprometida: string | null
  estado: string | null
}

export default function EntregasActas() {
  const { datos: requerimientos, error, cargando, recargar } = useLista<Requerimiento>('/requerimientos')
  const { datos: aplicaciones } = useLista<Aplicacion>('/aplicaciones')
  const [squadsCol, setSquadsCol] = useState<Squad[]>([])
  const [filtroTexto, setFiltroTexto] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('PENDIENTE')
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('')
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('')

  // Auto-refresca cuando el usuario vuelve a esta pestaña/vista
  useEffect(() => {
    const handleVisible = () => {
      if (document.visibilityState === 'visible') recargar()
    }
    document.addEventListener('visibilitychange', handleVisible)
    return () => document.removeEventListener('visibilitychange', handleVisible)
  }, [recargar])

  useEffect(() => {
    client
      .get<Squad[]>('/squads', { headers: { 'X-Aplicacion': '__todas__' } })
      .then((r) => setSquadsCol(r.data))
      .catch(() => {
        client
          .get<Squad[]>('/squads')
          .then((r) => setSquadsCol(r.data))
          .catch(() => {})
      })
  }, [])

  const squadPorId = useMemo(() => {
    const m = new Map<string, string>()
    squadsCol.forEach((s) => m.set(String(s.id), s.nombre))
    aplicaciones.forEach((a) => m.set(String(a.codigo), a.nombre))
    return m
  }, [squadsCol, aplicaciones])

  const filas = useMemo<FilaEntrega[]>(() => {
    const resultado: FilaEntrega[] = []
    for (const req of requerimientos) {
      const squadNombre = req.solicitud?.squad_id
        ? (squadPorId.get(String(req.solicitud.squad_id)) ?? String(req.solicitud.squad_id))
        : ''
      for (const en of req.entregas ?? []) {
        const porcentaje =
          en.porcentaje != null
            ? en.porcentaje
            : en.horas != null && req.total_horas_estimadas
            ? Number(((Number(en.horas) * 100) / Number(req.total_horas_estimadas)).toFixed(1))
            : null
        resultado.push({
          reqId: req.id,
          codigoReq: req.codigo_req,
          sc: req.solicitud?.codigo_sc ?? '',
          squad: squadNombre,
          nombreActa: req.nombre ?? '',
          entregaNum: en.numero,
          horas: en.horas ?? null,
          porcentaje,
          fechaComprometida: en.fecha_comprometida ?? null,
          estado: en.estado ?? null,
        })
      }
    }
    return resultado
  }, [requerimientos, squadPorId])

  const filasFiltradas = useMemo(() => {
    return filas
      .filter((f) => {
        if (filtroEstado && (f.estado ?? '').toUpperCase() !== filtroEstado.toUpperCase()) return false
        if (filtroTexto) {
          const t = filtroTexto.toLowerCase()
          if (
            !f.codigoReq.toLowerCase().includes(t) &&
            !f.sc.toLowerCase().includes(t) &&
            !f.nombreActa.toLowerCase().includes(t)
          )
            return false
        }
        if (filtroFechaDesde || filtroFechaHasta) {
          const fc = f.fechaComprometida ? f.fechaComprometida.slice(0, 10) : null
          if (!fc) return false
          if (filtroFechaDesde && fc < filtroFechaDesde) return false
          if (filtroFechaHasta && fc > filtroFechaHasta) return false
        }
        return true
      })
      .sort((a, b) => {
        if (!a.fechaComprometida && !b.fechaComprometida) return 0
        if (!a.fechaComprometida) return 1
        if (!b.fechaComprometida) return -1
        return a.fechaComprometida.localeCompare(b.fechaComprometida)
      })
  }, [filas, filtroTexto, filtroEstado, filtroFechaDesde, filtroFechaHasta])

  /** Estados reales que tienen las entregas en la BD */
  const estadosEnBD = useMemo(() => {
    const set = new Set<string>()
    for (const f of filas) {
      if (f.estado) set.add(f.estado)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
  }, [filas])

  const estadoBadge = (estado: string | null) => {
    const s = estado ?? ''
    const cls =
      s.toUpperCase() === 'PENDIENTE' ? 'bg-amber-100 text-amber-700' :
      s.toUpperCase() === 'APROBADA' ? 'bg-green-100 text-green-700' :
      s.toUpperCase() === 'RECHAZADA' ? 'bg-red-100 text-red-700' :
      s.toUpperCase() === 'ENTREGA CARGADA' ? 'bg-blue-100 text-blue-700' :
      s.toUpperCase() === 'ENTREGA NO CARGADA' ? 'bg-orange-100 text-orange-700' :
      s.toUpperCase() === 'EN GARANTIA' ? 'bg-purple-100 text-purple-700' :
      'bg-slate-100 text-slate-600'
    return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{s || '—'}</span>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-marca-osc">Entregas de Actas</h1>
          <p className="mt-1 text-sm text-slate-500">
            Entregas ordenadas de la más próxima a la más lejana.
          </p>
        </div>
        <button
          onClick={recargar}
          disabled={cargando}
          title="Recargar estados desde Requerimientos"
          className="flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <span className={cargando ? 'animate-spin' : ''}>↺</span>
          Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-3">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Buscar</span>
          <input
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            placeholder="REQ, SC o acta…"
            className="rounded border px-3 py-2 text-sm w-48"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Estado</span>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="rounded border px-3 py-2 text-sm w-52"
          >
            <option value="">Todos los estados</option>
            {estadosEnBD.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">F. Comprometida</span>
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={filtroFechaDesde}
              onChange={(e) => setFiltroFechaDesde(e.target.value)}
              className="rounded border px-2 py-2 text-sm"
            />
            <span className="text-xs text-slate-400">–</span>
            <input
              type="date"
              value={filtroFechaHasta}
              onChange={(e) => setFiltroFechaHasta(e.target.value)}
              className="rounded border px-2 py-2 text-sm"
            />
          </div>
        </label>
        {(filtroTexto || filtroEstado || filtroFechaDesde || filtroFechaHasta) && (
          <button
            onClick={() => { setFiltroTexto(''); setFiltroEstado(''); setFiltroFechaDesde(''); setFiltroFechaHasta('') }}
            className="text-xs text-red-500 hover:underline self-end pb-2"
          >
            Limpiar
          </button>
        )}
        <span className="ml-auto text-xs text-slate-400 self-end pb-2">
          {filasFiltradas.length} entregas
        </span>
      </div>

      {error && <div className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>}

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-marca-osc text-white">
            <tr>
              <th className="p-2 text-left">Código REQ</th>
              <th className="p-2 text-left">SC</th>
              <th className="p-2 text-left">Squad</th>
              <th className="p-2 text-left">Nombre de acta</th>
              <th className="p-2 text-center">N° Entrega</th>
              <th className="p-2 text-right">Horas</th>
              <th className="p-2 text-right">% Avance</th>
              <th className="p-2 text-left">F. Comprometida</th>
              <th className="p-2 text-center">Estado</th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={9} className="p-4 text-center text-slate-400">Cargando…</td>
              </tr>
            )}
            {!cargando && filasFiltradas.length === 0 && (
              <tr>
                <td colSpan={9} className="p-4 text-center text-slate-400">Sin entregas.</td>
              </tr>
            )}
            {filasFiltradas.map((f, i) => {
              const hoy = new Date().toISOString().slice(0, 10)
              const vencida = f.fechaComprometida ? f.fechaComprometida.slice(0, 10) < hoy : false
              return (
              <tr key={`${f.codigoReq}-${f.entregaNum}-${i}`}
                className={`border-t ${vencida ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-slate-50'}`}>
                <td className="p-2">
                  <Link
                    to={`/requerimientos/${f.reqId}`}
                    className="text-marca hover:underline font-medium"
                  >
                    {f.codigoReq}
                  </Link>
                </td>
                <td className="p-2 text-slate-600">{f.sc || '—'}</td>
                <td className="p-2">{f.squad || '—'}</td>
                <td className="p-2">{f.nombreActa || '—'}</td>
                <td className="p-2 text-center">{f.entregaNum}</td>
                <td className="p-2 text-right">{f.horas != null ? f.horas : '—'}</td>
                <td className="p-2 text-right">
                  {f.porcentaje != null ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="w-16 overflow-hidden rounded-full bg-slate-100 h-2 inline-block align-middle">
                        <span
                          className="block h-2 rounded-full bg-marca"
                          style={{ width: `${Math.min(f.porcentaje, 100)}%` }}
                        />
                      </span>
                      {f.porcentaje}%
                    </span>
                  ) : '—'}
                </td>
                <td className={`p-2 font-medium ${vencida ? 'text-red-700' : ''}`}>
                  {f.fechaComprometida ? f.fechaComprometida.slice(0, 10) : '—'}
                  {vencida && <span className="ml-1 text-xs">⚠</span>}
                </td>
                <td className="p-2 text-center">{estadoBadge(f.estado)}</td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
