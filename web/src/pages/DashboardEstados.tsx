import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CONSOLIDADO } from '../api/client'
import { useLista } from '../api/hooks'
import { useAplicacion } from '../context/AplicacionContext'
import type { Aplicacion, Requerimiento } from '../types'

const COLORES_KPI = {
  total: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', icon: '📋' },
  activos: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', icon: '🟢' },
  horas: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', icon: '⏱️' },
  entregas: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200', icon: '📦' },
} as const

function colorEstado(estado: string): string {
  const normalized = estado.toUpperCase()
  if (normalized.includes('CANCELADO')) return '#ef4444'
  if (normalized.includes('PENDIENTE') || normalized.includes('ESPERA')) return '#f59e0b'
  if (normalized.includes('APROBADA') || normalized.includes('APROBADO')) return '#22c55e'
  if (normalized.includes('CARGADA')) return '#3b82f6'
  return '#6366f1'
}

function esActivo(estado: string): boolean {
  const normalized = estado.toUpperCase()
  return !normalized.includes('CANCELADO') && !normalized.includes('REEMPLAZADO')
}

function fmtNumero(valor: number): string {
  return valor.toLocaleString('es-CO', { maximumFractionDigits: 1 })
}

export default function DashboardEstados() {
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

  const kpis = useMemo(() => {
    const totalHoras = requerimientos.reduce((sum, req) => sum + Number(req.total_horas_estimadas ?? 0), 0)
    const totalEntregas = requerimientos.reduce((sum, req) => sum + Number(req.cantidad_entregas ?? 0), 0)
    const activos = requerimientos.filter((req) => esActivo(req.estado)).length
    return {
      total: requerimientos.length,
      activos,
      totalHoras,
      totalEntregas,
    }
  }, [requerimientos])

  const porEstado = useMemo(() => {
    const mapa = new Map<string, { estado: string; cantidad: number; horas: number; entregas: number }>()
    for (const req of requerimientos) {
      const actual = mapa.get(req.estado) ?? { estado: req.estado, cantidad: 0, horas: 0, entregas: 0 }
      actual.cantidad += 1
      actual.horas += Number(req.total_horas_estimadas ?? 0)
      actual.entregas += Number(req.cantidad_entregas ?? 0)
      mapa.set(req.estado, actual)
    }
    const total = requerimientos.length || 1
    return Array.from(mapa.values())
      .map((fila) => ({
        ...fila,
        porcentaje: (fila.cantidad / total) * 100,
        color: colorEstado(fila.estado),
      }))
      .sort((a, b) => b.cantidad - a.cantidad || b.horas - a.horas)
  }, [requerimientos])

  const porMes = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const req of requerimientos) {
      if (!req.fecha_solicitud_acta) continue
      const mes = req.fecha_solicitud_acta.substring(0, 7)
      mapa.set(mes, (mapa.get(mes) ?? 0) + 1)
    }
    return Array.from(mapa.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, cantidad]) => ({ mes, cantidad }))
  }, [requerimientos])

  if (cargando) {
    return <div className="p-8 text-center text-slate-500">Cargando dashboard…</div>
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-marca-osc">Dashboard de Estados</h1>
        <p className="text-sm text-slate-500">
          Vista por estado de requerimiento{appActiva ? ` · ${appActiva}` : ''}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={COLORES_KPI.total.icon} label="Total requerimientos" value={kpis.total} color={COLORES_KPI.total} />
        <KpiCard icon={COLORES_KPI.activos.icon} label="Reqs activos" value={kpis.activos} color={COLORES_KPI.activos} />
        <KpiCard icon={COLORES_KPI.horas.icon} label="Total horas estimadas" value={fmtNumero(kpis.totalHoras)} color={COLORES_KPI.horas} />
        <KpiCard icon={COLORES_KPI.entregas.icon} label="Total entregas" value={fmtNumero(kpis.totalEntregas)} color={COLORES_KPI.entregas} />
      </div>

      <Panel titulo="Tabla de estados">
        {porEstado.length === 0 ? (
          <Empty />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Cantidad</th>
                  <th className="px-3 py-2">% del total</th>
                  <th className="px-3 py-2">Horas estimadas</th>
                  <th className="px-3 py-2">Entregas</th>
                </tr>
              </thead>
              <tbody>
                {porEstado.map((fila) => (
                  <tr key={fila.estado} className="border-b transition hover:bg-slate-50">
                    <td className="px-3 py-3 font-medium text-slate-700">{fila.estado}</td>
                    <td className="px-3 py-3 text-slate-600">{fila.cantidad}</td>
                    <td className="px-3 py-3">
                      <div className="w-40 max-w-full">
                        <div className="mb-1 flex items-center justify-between gap-2 text-xs text-slate-500">
                          <span>{fila.porcentaje.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${fila.porcentaje}%`, backgroundColor: fila.color }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-600">{fmtNumero(fila.horas)}</td>
                    <td className="px-3 py-3 text-slate-600">{fmtNumero(fila.entregas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel titulo="Requerimientos por estado">
          {porEstado.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, porEstado.length * 40)}>
              <BarChart data={porEstado} layout="vertical" margin={{ left: 12, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="estado" width={220} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="cantidad" radius={[0, 4, 4, 0]} barSize={18}>
                  {porEstado.map((fila) => (
                    <Cell key={fila.estado} fill={fila.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel titulo="Evolución mensual">
          {porMes.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={porMes} margin={{ left: 0, right: 16, top: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="cantidad" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} name="Requerimientos" />
              </LineChart>
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
