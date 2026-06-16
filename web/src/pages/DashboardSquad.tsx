import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CONSOLIDADO } from '../api/client'
import { useLista } from '../api/hooks'
import { useAplicacion } from '../context/AplicacionContext'
import type { Aplicacion, Requerimiento } from '../types'

const COLORES = ['#2563eb', '#16a34a', '#ea580c', '#8b5cf6', '#e11d48', '#0891b2', '#ca8a04', '#64748b']

const COLORES_KPI = {
  squads: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', icon: '👥' },
  lider: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', icon: '🏆' },
  horas: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', icon: '⏱️' },
  promedio: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200', icon: '📊' },
} as const

interface FilaSquad {
  squadId: string | null
  squad: string
  reqs: number
  horas: number
  entregas: number
  ansActaCumple: number
  ansActaTotal: number
  ansEntregaCumple: number
  ansEntregaTotal: number
}

function fmtNumero(valor: number): string {
  return valor.toLocaleString('es-CO', { maximumFractionDigits: 1 })
}

function fmtPorcentaje(cumple: number, total: number): string {
  if (total === 0) return '—'
  return `${Math.round((cumple / total) * 100)}%`
}

export default function DashboardSquad() {
  const { datos: reqs, cargando } = useLista<Requerimiento>('/requerimientos')
  const { datos: aplicaciones } = useLista<Aplicacion>('/aplicaciones')
  const { activa } = useAplicacion()

  const requerimientos = useMemo(() => {
    if (!activa || activa === CONSOLIDADO) return reqs
    return reqs.filter((req) => req.aplicacion_id === activa || req.solicitud?.squad_id === activa)
  }, [reqs, activa])

  const appActiva = useMemo(() => {
    if (activa === CONSOLIDADO) return 'Todos los squads'
    return aplicaciones.find((app) => app.codigo === activa)?.nombre ?? activa
  }, [activa, aplicaciones])

  const squadNombrePorCodigo = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const app of aplicaciones) mapa.set(app.codigo, app.nombre)
    return mapa
  }, [aplicaciones])

  const filas = useMemo<FilaSquad[]>(() => {
    const mapa = new Map<string, FilaSquad>()
    for (const req of requerimientos) {
      const squadId = req.solicitud?.squad_id ?? null
      const key = squadId ?? '__sin_squad__'
      const squad = squadId ? (squadNombrePorCodigo.get(squadId) ?? squadId) : 'Sin squad'
      const actual = mapa.get(key) ?? {
        squadId,
        squad,
        reqs: 0,
        horas: 0,
        entregas: 0,
        ansActaCumple: 0,
        ansActaTotal: 0,
        ansEntregaCumple: 0,
        ansEntregaTotal: 0,
      }
      actual.reqs += 1
      actual.horas += Number(req.total_horas_estimadas ?? 0)
      actual.entregas += Number(req.cantidad_entregas ?? 0)
      if (req.ans_acta) {
        actual.ansActaTotal += 1
        if (req.ans_acta === 'CUMPLE') actual.ansActaCumple += 1
      }
      for (const entrega of req.entregas ?? []) {
        if (!entrega.ans_entrega) continue
        actual.ansEntregaTotal += 1
        if (entrega.ans_entrega === 'CUMPLE') actual.ansEntregaCumple += 1
      }
      mapa.set(key, actual)
    }
    return Array.from(mapa.values()).sort((a, b) => b.reqs - a.reqs || b.horas - a.horas)
  }, [requerimientos, squadNombrePorCodigo])

  const kpis = useMemo(() => {
    const totalHoras = filas.reduce((sum, fila) => sum + fila.horas, 0)
    const top = filas[0]
    return {
      totalSquads: filas.length,
      topNombre: top?.squad ?? '—',
      topCantidad: top?.reqs ?? 0,
      totalHoras,
      promedioHoras: requerimientos.length > 0 ? totalHoras / requerimientos.length : 0,
    }
  }, [filas, requerimientos.length])

  if (cargando) {
    return <div className="p-8 text-center text-slate-500">Cargando dashboard…</div>
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-marca-osc">Dashboard por Squad</h1>
        <p className="text-sm text-slate-500">
          Métricas agrupadas por squad{appActiva ? ` · ${appActiva}` : ''}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={COLORES_KPI.squads.icon} label="Total squads con requerimientos" value={kpis.totalSquads} color={COLORES_KPI.squads} />
        <KpiCard icon={COLORES_KPI.lider.icon} label="Squad con más requerimientos" value={kpis.topNombre} sub={`${kpis.topCantidad} requerimientos`} color={COLORES_KPI.lider} />
        <KpiCard icon={COLORES_KPI.horas.icon} label="Total horas" value={fmtNumero(kpis.totalHoras)} color={COLORES_KPI.horas} />
        <KpiCard icon={COLORES_KPI.promedio.icon} label="Promedio horas por requerimiento" value={fmtNumero(kpis.promedioHoras)} color={COLORES_KPI.promedio} />
      </div>

      <Panel titulo="Tabla por squad">
        {filas.length === 0 ? (
          <Empty />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Squad</th>
                  <th className="px-3 py-2">Reqs</th>
                  <th className="px-3 py-2">Horas</th>
                  <th className="px-3 py-2">Entregas</th>
                  <th className="px-3 py-2">ANS Acta (% CUMPLE)</th>
                  <th className="px-3 py-2">ANS Entrega (% CUMPLE)</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((fila) => (
                  <tr key={fila.squadId ?? 'sin-squad'} className="border-b transition hover:bg-slate-50">
                    <td className="px-3 py-3 font-medium text-slate-700">{fila.squad}</td>
                    <td className="px-3 py-3 text-slate-600">{fila.reqs}</td>
                    <td className="px-3 py-3 text-slate-600">{fmtNumero(fila.horas)}</td>
                    <td className="px-3 py-3 text-slate-600">{fmtNumero(fila.entregas)}</td>
                    <td className="px-3 py-3 text-slate-600">
                      {fmtPorcentaje(fila.ansActaCumple, fila.ansActaTotal)}
                      {fila.ansActaTotal > 0 && (
                        <span className="ml-1 text-xs text-slate-400">({fila.ansActaCumple}/{fila.ansActaTotal})</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {fmtPorcentaje(fila.ansEntregaCumple, fila.ansEntregaTotal)}
                      {fila.ansEntregaTotal > 0 && (
                        <span className="ml-1 text-xs text-slate-400">({fila.ansEntregaCumple}/{fila.ansEntregaTotal})</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel titulo="Cantidad de requerimientos por squad">
          {filas.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, filas.length * 40)}>
              <BarChart data={filas} layout="vertical" margin={{ left: 12, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="squad" width={180} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="reqs" radius={[0, 4, 4, 0]} barSize={18}>
                  {filas.map((fila, index) => (
                    <Cell key={fila.squadId ?? `req-${index}`} fill={COLORES[index % COLORES.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel titulo="Horas estimadas por squad">
          {filas.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, filas.length * 40)}>
              <BarChart data={filas} layout="vertical" margin={{ left: 12, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="squad" width={180} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="horas" radius={[0, 4, 4, 0]} barSize={18}>
                  {filas.map((fila, index) => (
                    <Cell key={fila.squadId ?? `hora-${index}`} fill={COLORES[index % COLORES.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>
    </div>
  )
}

function KpiCard({ icon, label, value, sub, color }: {
  icon: string; label: string; value: string | number; sub?: string
  color: { bg: string; text: string; border: string }
}) {
  return (
    <div className={`flex items-center gap-4 rounded-xl border ${color.border} ${color.bg} p-4`}>
      <span className="text-3xl">{icon}</span>
      <div>
        <div className={`text-2xl font-bold ${color.text}`}>{value}</div>
        <div className="text-sm font-medium text-slate-700">{label}</div>
        {sub && <div className="text-xs text-slate-500">{sub}</div>}
      </div>
    </div>
  )
}

function Panel({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{titulo}</h3>
      {children}
    </div>
  )
}

function Empty() {
  return <p className="py-8 text-center text-sm text-slate-400">Sin datos</p>
}
