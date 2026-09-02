import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client'
import { useLista } from '../api/hooks'
import type { Aplicacion, Requerimiento, Squad } from '../types'

interface FilaPredictiva {
  reqId: string
  codigoReq: string
  squad: string
  nombreActa: string
  entregaNum: number
  fechaComprometida: string
  estado: string
  diasRestantes: number
}

const ESTADOS_INCLUIDOS = ['PENDIENTE', 'RECHAZADA']

/** Días de calendario entre hoy (00:00) y la fecha dada. Negativo si ya venció. */
function diasRestantes(fechaISO: string): number {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const fecha = new Date(fechaISO)
  fecha.setHours(0, 0, 0, 0)
  return Math.round((fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
}

export default function Predictivos() {
  const { datos: requerimientos, error, cargando } = useLista<Requerimiento>('/requerimientos')
  const { datos: aplicaciones } = useLista<Aplicacion>('/aplicaciones')
  const [squadsCol, setSquadsCol] = useState<Squad[]>([])

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

  const filas = useMemo<FilaPredictiva[]>(() => {
    const resultado: FilaPredictiva[] = []
    for (const req of requerimientos) {
      const squadNombre = req.solicitud?.squad_id
        ? (squadPorId.get(String(req.solicitud.squad_id)) ?? String(req.solicitud.squad_id))
        : ''
      for (const en of req.entregas ?? []) {
        const estado = (en.estado ?? '').toUpperCase()
        if (!ESTADOS_INCLUIDOS.includes(estado)) continue
        if (!en.fecha_comprometida) continue
        const dias = diasRestantes(en.fecha_comprometida)
        if (dias > 5) continue
        resultado.push({
          reqId: req.id,
          codigoReq: req.codigo_req,
          squad: squadNombre,
          nombreActa: req.nombre ?? '',
          entregaNum: en.numero,
          fechaComprometida: en.fecha_comprometida,
          estado: en.estado ?? '',
          diasRestantes: dias,
        })
      }
    }
    return resultado.sort((a, b) => a.diasRestantes - b.diasRestantes)
  }, [requerimientos, squadPorId])

  const badgeDias = (dias: number) => {
    if (dias < 0) return 'bg-red-100 text-red-700'
    if (dias <= 2) return 'bg-orange-100 text-orange-700'
    return 'bg-amber-100 text-amber-700'
  }

  const badgeEstado = (estado: string) => {
    const s = estado.toUpperCase()
    if (s === 'RECHAZADA') return 'bg-red-100 text-red-700'
    if (s === 'PENDIENTE') return 'bg-amber-100 text-amber-700'
    return 'bg-slate-100 text-slate-700'
  }

  return (
    <div>
      <h1 className="titulo-pagina mb-4">Predictivos</h1>

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="titulo-seccion text-sm mb-1">
          Entregas próximas a vencer (≤ 5 días)
        </h2>
        <p className="text-xs text-slate-500">
          Entregas en estado <strong>Pendiente</strong> o <strong>Rechazada</strong> cuya fecha
          comprometida vence en 5 días o menos (incluye vencidas).
        </p>
      </div>

      {cargando && <p className="text-sm text-slate-500">Cargando...</p>}
      {error && <p className="text-sm text-red-600">Error al cargar los datos.</p>}

      {!cargando && !error && (
        filas.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white p-16 text-center text-slate-500">
            <span className="text-4xl">✅</span>
            <p className="text-sm">No hay entregas próximas a vencer en este momento.</p>
          </div>
        ) : (
          <div className="tabla-scroll">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-2 text-left">Código Req</th>
                  <th className="p-2 text-left">Squad</th>
                  <th className="p-2 text-left">Acta de trabajo</th>
                  <th className="p-2 text-center"># Entrega</th>
                  <th className="p-2 text-center">F. Comprometida</th>
                  <th className="p-2 text-center">Estado</th>
                  <th className="p-2 text-center">Días restantes</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={`${f.reqId}-${f.entregaNum}`} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="p-2">
                      <Link to={`/requerimientos/${f.reqId}`} className="enlace-accion">
                        {f.codigoReq}
                      </Link>
                    </td>
                    <td className="p-2">{f.squad}</td>
                    <td className="p-2">{f.nombreActa}</td>
                    <td className="p-2 text-center">{f.entregaNum}</td>
                    <td className="p-2 text-center">{f.fechaComprometida}</td>
                    <td className="p-2 text-center">
                      <span className={`chip ${badgeEstado(f.estado)}`}>
                        {f.estado}
                      </span>
                    </td>
                    <td className="p-2 text-center">
                      <span className={`chip ${badgeDias(f.diasRestantes)}`}>
                        {f.diasRestantes < 0 ? `Vencida (${Math.abs(f.diasRestantes)}d)` : `${f.diasRestantes}d`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}
