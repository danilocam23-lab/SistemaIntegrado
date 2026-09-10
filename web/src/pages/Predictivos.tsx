import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client'
import { useLista } from '../api/hooks'
import { Chip, EncabezadoPagina, Icono, TablaScroll } from '../components/ui'
import type { Aplicacion, Persona, Requerimiento, Squad } from '../types'

type TonoChip = 'neutro' | 'marca' | 'exito' | 'alerta' | 'error'

interface FilaPredictiva {
  reqId: string
  codigoReq: string
  squad: string
  nombreActa: string
  entregaNum: number
  fechaComprometida: string
  estado: string
  diasRestantes: number
  analista: string
}

interface FilaEstadoReq {
  reqId: string
  codigoReq: string
  squad: string
  nombreActa: string
  analista: string
  estado: string
  fechaSolicitud: string
}

const ESTADOS_INCLUIDOS = ['PENDIENTE', 'RECHAZADA']

/** Normaliza (mayúsculas, sin tildes) para comparar estados de forma flexible. */
function normalizarEstado(valor: string): string {
  return valor
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** Etiquetas visibles de la sección "Requerimientos en riesgo" y el filtro que detecta cada una. */
const ESTADOS_REQ_RIESGO: { label: string; coincide: (estadoNorm: string) => boolean }[] = [
  { label: 'En curso por Hitss', coincide: (e) => e.includes('CURSO POR HITSS') },
  { label: 'Estimación rechazada', coincide: (e) => e.includes('ESTIMACION') && e.includes('RECHAZAD') },
]

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
  const { datos: personas } = useLista<Persona>('/personas')
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

  const personaPorId = useMemo(() => {
    const m = new Map<string, string>()
    personas.forEach((p) => m.set(String(p.id), p.nombre))
    return m
  }, [personas])

  const filas = useMemo<FilaPredictiva[]>(() => {
    const resultado: FilaPredictiva[] = []
    for (const req of requerimientos) {
      const squadNombre = req.solicitud?.squad_id
        ? (squadPorId.get(String(req.solicitud.squad_id)) ?? String(req.solicitud.squad_id))
        : ''
      const analistaId = req.solicitud?.analista_requerimientos_id
      const analistaNombre = analistaId ? (personaPorId.get(String(analistaId)) ?? String(analistaId)) : '—'
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
          analista: analistaNombre,
        })
      }
    }
    return resultado.sort((a, b) => a.diasRestantes - b.diasRestantes)
  }, [requerimientos, squadPorId, personaPorId])

  const filasEstadoReq = useMemo<FilaEstadoReq[]>(() => {
    const resultado: FilaEstadoReq[] = []
    for (const req of requerimientos) {
      const estadoNorm = normalizarEstado(req.estado ?? '')
      const match = ESTADOS_REQ_RIESGO.find((r) => r.coincide(estadoNorm))
      if (!match) continue
      const squadNombre = req.solicitud?.squad_id
        ? (squadPorId.get(String(req.solicitud.squad_id)) ?? String(req.solicitud.squad_id))
        : ''
      const analistaId = req.solicitud?.analista_requerimientos_id
      const analistaNombre = analistaId ? (personaPorId.get(String(analistaId)) ?? String(analistaId)) : '—'
      resultado.push({
        reqId: req.id,
        codigoReq: req.codigo_req,
        squad: squadNombre,
        nombreActa: req.nombre ?? '',
        analista: analistaNombre,
        estado: match.label,
        fechaSolicitud: req.solicitud?.fecha_solicitud ?? '',
      })
    }
    return resultado.sort((a, b) => a.estado.localeCompare(b.estado) || a.codigoReq.localeCompare(b.codigoReq))
  }, [requerimientos, squadPorId, personaPorId])

  const tonoEstadoReq = (estado: string): TonoChip => {
    if (estado === 'Estimación rechazada') return 'error'
    if (estado === 'En curso por Hitss') return 'marca'
    return 'neutro'
  }

  const tonoDias = (dias: number): TonoChip => {
    if (dias < 0) return 'error'
    return 'alerta'
  }

  const tonoEstado = (estado: string): TonoChip => {
    const s = estado.toUpperCase()
    if (s === 'RECHAZADA') return 'error'
    if (s === 'PENDIENTE') return 'alerta'
    return 'neutro'
  }

  return (
    <div>
      <EncabezadoPagina icono={<Icono nombre="tendencia" />} titulo="Predictivos" />

      <div className="mb-4 mt-4 rounded-xl border border-slate-200 bg-white p-4">
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
            <Icono nombre="check-circulo" className="h-10 w-10 text-emerald-500" />
            <p className="text-sm">No hay entregas próximas a vencer en este momento.</p>
          </div>
        ) : (
          <TablaScroll>
            <table className="tabla">
              <thead>
                <tr>
                  <th>Código Req</th>
                  <th>Squad</th>
                  <th>Acta de trabajo</th>
                  <th>Analista</th>
                  <th className="text-center"># Entrega</th>
                  <th className="text-center">F. Comprometida</th>
                  <th className="text-center">Estado</th>
                  <th className="text-center">Días restantes</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={`${f.reqId}-${f.entregaNum}`}>
                    <td>
                      <Link to={`/requerimientos/${f.reqId}`} className="enlace-accion">
                        {f.codigoReq}
                      </Link>
                    </td>
                    <td>{f.squad}</td>
                    <td>{f.nombreActa}</td>
                    <td>{f.analista}</td>
                    <td className="text-center">{f.entregaNum}</td>
                    <td className="text-center">{f.fechaComprometida}</td>
                    <td className="text-center">
                      <Chip tono={tonoEstado(f.estado)}>{f.estado}</Chip>
                    </td>
                    <td className="text-center">
                      <Chip tono={tonoDias(f.diasRestantes)}>
                        {f.diasRestantes < 0 ? `Vencida (${Math.abs(f.diasRestantes)}d)` : `${f.diasRestantes}d`}
                      </Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TablaScroll>
        )
      )}

      <div className="mb-4 mt-8 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="titulo-seccion text-sm mb-1">
          Requerimientos en riesgo
        </h2>
        <p className="text-xs text-slate-500">
          Requerimientos cuyo estado general es <strong>En curso por Hitss</strong> o <strong>Estimación rechazada</strong>.
        </p>
      </div>

      {!cargando && !error && (
        filasEstadoReq.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white p-16 text-center text-slate-500">
            <Icono nombre="check-circulo" className="h-10 w-10 text-emerald-500" />
            <p className="text-sm">No hay requerimientos en estos estados en este momento.</p>
          </div>
        ) : (
          <TablaScroll>
            <table className="tabla">
              <thead>
                <tr>
                  <th>Código Req</th>
                  <th>Squad</th>
                  <th>Acta de trabajo</th>
                  <th>Analista</th>
                  <th className="text-center">F. Solicitud</th>
                  <th className="text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filasEstadoReq.map((f) => (
                  <tr key={f.reqId}>
                    <td>
                      <Link to={`/requerimientos/${f.reqId}`} className="enlace-accion">
                        {f.codigoReq}
                      </Link>
                    </td>
                    <td>{f.squad}</td>
                    <td>{f.nombreActa}</td>
                    <td>{f.analista}</td>
                    <td className="text-center">{f.fechaSolicitud ? f.fechaSolicitud.slice(0, 10) : '—'}</td>
                    <td className="text-center">
                      <Chip tono={tonoEstadoReq(f.estado)}>{f.estado}</Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TablaScroll>
        )
      )}
    </div>
  )
}
