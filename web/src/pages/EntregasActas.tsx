import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client'
import { useLista } from '../api/hooks'
import type { Aplicacion, Requerimiento, Squad } from '../types'

const MESES_NOMBRES: Record<string, string> = {
  ene: 'Enero', feb: 'Febrero', mar: 'Marzo', abr: 'Abril', may: 'Mayo', jun: 'Junio',
  jul: 'Julio', ago: 'Agosto', sep: 'Septiembre', oct: 'Octubre', nov: 'Noviembre', dic: 'Diciembre',
  jan: 'Enero', apr: 'Abril', aug: 'Agosto', dec: 'Diciembre',
}

/**
 * Normaliza `mes_aprobacion` al formato canónico "Enero", "Febrero"...
 * Defensivo: si el dato ya viene normalizado del back, lo retorna tal cual.
 * Si viene en cualquier otro formato (MAYÚS, con año, abreviado) lo convierte.
 */
function normalizarMes(raw: string): string {
  const s = raw.trim()
  // Quitar dígitos y caracteres no alfabéticos, quedarse con la parte de letras
  const soloLetras = s.replace(/[^A-Za-z\u00C0-\u024F]/g, ' ').trim().split(/\s+/)[0] ?? ''
  if (!soloLetras) return s
  // Normalizar tildes y pasar a minúsculas para comparar
  const norm = soloLetras.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const clave = norm.slice(0, 3)
  const nombreCompleto = MESES_NOMBRES[clave]
  if (nombreCompleto) return nombreCompleto
  // Si no reconoce, devuelve primera letra mayúscula del valor original
  return soloLetras.charAt(0).toUpperCase() + soloLetras.slice(1).toLowerCase()
}

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
  fechaReal: string | null
  estado: string | null
  ansEntrega: string | null
  mesAprobacion: string | null
}

export default function EntregasActas() {
  const { datos: requerimientos, error, cargando, recargar } = useLista<Requerimiento>('/requerimientos')
  const { datos: aplicaciones } = useLista<Aplicacion>('/aplicaciones')
  const [squadsCol, setSquadsCol] = useState<Squad[]>([])
  const [filtroTexto, setFiltroTexto] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroAns, setFiltroAns] = useState('')
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('')
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('')
  const [filtroMes, setFiltroMes] = useState('')

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
          fechaReal: en.fecha_recepcion ?? null,
          estado: en.estado ?? null,
          ansEntrega: en.ans_entrega ?? null,
          mesAprobacion: en.mes_aprobacion ? normalizarMes(en.mes_aprobacion) : null,
        })
      }
    }
    return resultado
  }, [requerimientos, squadPorId])

  const filasFiltradas = useMemo(() => {
    return filas
      .filter((f) => {
        if (filtroEstado && (f.estado ?? '').toUpperCase() !== filtroEstado.toUpperCase()) return false
        if (filtroAns === '__SIN_ANS__' && f.ansEntrega) return false
        if (filtroAns && filtroAns !== '__SIN_ANS__' && (f.ansEntrega ?? '') !== filtroAns) return false
        if (filtroMes && (f.mesAprobacion ?? '') !== filtroMes) return false
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
      .sort((a, b) => a.sc.localeCompare(b.sc, 'es', { numeric: true }))
  }, [filas, filtroTexto, filtroEstado, filtroAns, filtroMes, filtroFechaDesde, filtroFechaHasta])

  /** Meses de aprobación únicos presentes en los datos */
  const mesesEnBD = useMemo(() => {
    const set = new Set<string>()
    for (const f of filas) {
      if (f.mesAprobacion) set.add(f.mesAprobacion)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
  }, [filas])

  /** Estados reales que tienen las entregas en la BD */
  const estadosEnBD = useMemo(() => {
    const set = new Set<string>()
    for (const f of filas) {
      if (f.estado) set.add(f.estado)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
  }, [filas])

  const ansEnBD = useMemo(() => {
    const set = new Set<string>()
    for (const f of filas) {
      if (f.ansEntrega) set.add(f.ansEntrega)
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

  const calcularDiasTranscurridos = (fechaComprometida: string | null, fechaReal: string | null): { dias: number; esNegativo: boolean } | null => {
    if (!fechaComprometida) return null

    const hoyLocal = (() => {
      const d = new Date()
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    })()

    const fechaInicio = fechaComprometida.slice(0, 10)
    const fechaFin = fechaReal ? fechaReal.slice(0, 10) : hoyLocal

    const toUtcDate = (ymd: string) => {
      const [y, m, d] = ymd.split('-').map(Number)
      return Date.UTC(y, m - 1, d)
    }

    const diferencia = Math.floor((toUtcDate(fechaFin) - toUtcDate(fechaInicio)) / (1000 * 60 * 60 * 24))

    let esNegativo = false
    if (!fechaReal && hoyLocal > fechaInicio) {
      esNegativo = true
    } else if (fechaReal && fechaReal.slice(0, 10) > fechaInicio) {
      esNegativo = true
    }

    return { dias: Math.abs(diferencia), esNegativo }
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
            <span className="mb-1 block text-slate-600">Mes de aprobación</span>
            <select
              value={filtroMes}
              onChange={(e) => setFiltroMes(e.target.value)}
              className="rounded border px-3 py-2 text-sm w-52"
            >
              <option value="">Todos los meses</option>
              {mesesEnBD.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
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
          <span className="mb-1 block text-slate-600">ANS</span>
          <select
            value={filtroAns}
            onChange={(e) => setFiltroAns(e.target.value)}
            className="rounded border px-3 py-2 text-sm w-44"
          >
            <option value="">Todos</option>
            <option value="__SIN_ANS__">Sin ANS</option>
            {ansEnBD.map((s) => <option key={s} value={s}>{s}</option>)}
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
        {(filtroTexto || filtroEstado || filtroAns || filtroMes || filtroFechaDesde || filtroFechaHasta) && (
          <button
            onClick={() => { setFiltroTexto(''); setFiltroEstado(''); setFiltroAns(''); setFiltroMes(''); setFiltroFechaDesde(''); setFiltroFechaHasta('') }}
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
              <th className="p-2 text-left">Aplicación EPM</th>
              <th className="p-2 text-center">N° Entrega</th>
              <th className="p-2 text-right">Horas</th>
              <th className="p-2 text-right">% Avance</th>
              <th className="p-2 text-left">F. Comprometida</th>
              <th className="p-2 text-left">F. Real</th>
              <th className="p-2 text-right">Días transcurridos</th>
              <th className="p-2 text-center">Estado</th>
              <th className="p-2 text-left">Mes de aprobación</th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={13} className="p-4 text-center text-slate-400">Cargando…</td>
              </tr>
            )}
            {!cargando && filasFiltradas.length === 0 && (
              <tr>
                <td colSpan={13} className="p-4 text-center text-slate-400">Sin entregas.</td>
              </tr>
            )}
            {filasFiltradas.map((f, i) => {
              const diasInfo = calcularDiasTranscurridos(f.fechaComprometida, f.fechaReal)
              const vencida = diasInfo?.esNegativo ?? false
              return (
              <tr key={`${f.codigoReq}-${f.entregaNum}-${i}`}
                className={`border-t ${vencida ? '[&>td]:bg-[#fecfcf]' : '[&>td]:hover:bg-slate-50'}`}>
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
                <td className="p-2 text-slate-600">{f.nombreActa ? f.nombreActa.split('-')[0].trim() : '—'}</td>
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
                <td className="p-2">
                  {f.fechaReal ? f.fechaReal.slice(0, 10) : '—'}
                </td>
                <td className="p-2 text-right">
                  {diasInfo ? (
                    <span className={diasInfo.esNegativo ? 'text-red-600 font-semibold' : 'text-emerald-600'}>
                      {diasInfo.esNegativo ? '-' : '+'}{diasInfo.dias}
                    </span>
                  ) : '—'}
                </td>
                <td className="p-2 text-center">{estadoBadge(f.estado)}</td>
                <td className="p-2">{f.mesAprobacion ? normalizarMes(f.mesAprobacion) : '—'}</td>
              </tr>
              )
            })}
          </tbody>
          {!cargando && filasFiltradas.length > 0 && (() => {
            const totalHoras = filasFiltradas.reduce((s, f) => s + (f.horas ?? 0), 0)
            const filasConPct = filasFiltradas.filter((f) => f.porcentaje != null)
            const promPct = filasConPct.length
              ? Number((filasConPct.reduce((s, f) => s + f.porcentaje!, 0) / filasConPct.length).toFixed(1))
              : null
            return (
              <tfoot>
                <tr className="border-t-2 border-marca-osc bg-slate-50 font-semibold text-slate-700">
                  <td className="p-2" colSpan={5}>Total ({filasFiltradas.length} entregas)</td>
                  <td className="p-2 text-center">—</td>
                  <td className="p-2 text-right">{totalHoras.toLocaleString('es-CO')}</td>
                  <td className="p-2 text-right">{promPct != null ? `${promPct}%` : '—'}</td>
                  <td className="p-2" colSpan={5}></td>
                </tr>
              </tfoot>
            )
          })()}
        </table>
      </div>
    </div>
  )
}
