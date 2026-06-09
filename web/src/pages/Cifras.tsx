import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import client from '../api/client'
import { useAplicacion } from '../context/AplicacionContext'

interface FilaEstado {
  estado: string
  cantidad: number
  horas: number
}
interface FilaSquad {
  squad: string
  cantidad: number
  horas: number
}
interface ConteoAns {
  CUMPLE: number
  NO_CUMPLE: number
  SIN_ANS: number
}
interface LiquidacionResumen {
  total_monto: number
  total_horas: number
  total_reqs: number
  con_monto: number
  total_entregas: number
  por_squad: { squad: string; monto: number; horas: number; cantidad: number }[]
}

function fmtCOP(n: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}

export default function Cifras() {
  const { activa } = useAplicacion()
  const [estado, setEstado] = useState<FilaEstado[]>([])
  const [squad, setSquad] = useState<FilaSquad[]>([])
  const [ans, setAns] = useState<{ estimacion: ConteoAns; entrega: ConteoAns } | null>(null)
  const [liq, setLiq] = useState<LiquidacionResumen | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!activa) return
    setError('')
    Promise.all([
      client.get<{ cifras: FilaEstado[] }>('/cifras/estado'),
      client.get<{ cifras: FilaSquad[] }>('/cifras/squad'),
      client.get<{ estimacion: ConteoAns; entrega: ConteoAns }>('/cifras/ans'),
      client.get<LiquidacionResumen>('/cifras/liquidacion'),
    ])
      .then(([e, s, a, l]) => {
        setEstado(e.data.cifras)
        setSquad(s.data.cifras)
        setAns(a.data)
        setLiq(l.data)
      })
      .catch(() => setError('No fue posible cargar las cifras.'))
  }, [activa])

  const ansData = ans
    ? [
        { tipo: 'Estimación', ...ans.estimacion },
        { tipo: 'Entrega', ...ans.entrega },
      ]
    : []

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-marca-osc">Cifras y ANS</h1>
      {error && <div className="rounded bg-amber-50 p-3 text-sm text-amber-700">{error}</div>}

      <section className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Requerimientos por estado
        </h2>
        <ResponsiveContainer width="100%" height={Math.max(220, estado.length * 40)}>
          <BarChart data={estado} layout="vertical" margin={{ left: 20, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="estado" width={230} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="cantidad" fill="#1e5fa8" name="Requerimientos" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Requerimientos por squad
        </h2>
        <ResponsiveContainer width="100%" height={Math.max(220, squad.length * 40)}>
          <BarChart data={squad} layout="vertical" margin={{ left: 20, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="squad" width={180} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="cantidad" fill="#6d3fa8" name="Requerimientos" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Cumplimiento de ANS
        </h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={ansData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="tipo" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="CUMPLE" fill="#0f9d58" name="Cumple" />
            <Bar dataKey="NO_CUMPLE" fill="#c0392b" name="No cumple" />
            <Bar dataKey="SIN_ANS" fill="#94a3b8" name="Sin ANS" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* ─── Liquidación ─── */}
      <section className="space-y-4 rounded-xl border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Liquidación
        </h2>

        {/* KPIs */}
        {liq && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <div className="text-xs text-blue-500">Requerimientos</div>
              <div className="text-2xl font-bold text-blue-700">{liq.total_reqs}</div>
              <div className="text-xs text-blue-400">{liq.con_monto} con monto pactado</div>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <div className="text-xs text-emerald-500">Monto pactado total</div>
              <div className="text-xl font-bold text-emerald-700">{fmtCOP(liq.total_monto)}</div>
              <div className="text-xs text-emerald-400">{liq.total_entregas} entregas</div>
            </div>
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
              <div className="text-xs text-orange-500">Horas estimadas totales</div>
              <div className="text-2xl font-bold text-orange-700">
                {liq.total_horas.toLocaleString('es-CO', { maximumFractionDigits: 1 })}
              </div>
              <div className="text-xs text-orange-400">horas</div>
            </div>
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
              <div className="text-xs text-purple-500">Promedio horas / req</div>
              <div className="text-2xl font-bold text-purple-700">
                {liq.total_reqs > 0
                  ? (liq.total_horas / liq.total_reqs).toLocaleString('es-CO', { maximumFractionDigits: 1 })
                  : '0'}
              </div>
              <div className="text-xs text-purple-400">horas por requerimiento</div>
            </div>
          </div>
        )}

        {/* Monto por squad */}
        {liq && liq.por_squad.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-slate-500">Monto pactado por squad</p>
            <ResponsiveContainer width="100%" height={Math.max(180, liq.por_squad.length * 38)}>
              <BarChart data={liq.por_squad} layout="vertical" margin={{ left: 10, right: 60 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => `$${(v / 1_000_000).toFixed(0)}M`} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="squad" width={160} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [fmtCOP(v), 'Monto pactado']} />
                <Bar dataKey="monto" fill="#059669" name="Monto pactado" radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Horas por squad */}
        {liq && liq.por_squad.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-slate-500">Horas estimadas por squad</p>
            <ResponsiveContainer width="100%" height={Math.max(180, liq.por_squad.length * 38)}>
              <BarChart data={liq.por_squad} layout="vertical" margin={{ left: 10, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="squad" width={160} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [v.toLocaleString('es-CO', { maximumFractionDigits: 1 }), 'Horas']} />
                <Bar dataKey="horas" fill="#f97316" name="Horas estimadas" radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {!liq && <p className="py-6 text-center text-sm text-slate-400">Cargando…</p>}
      </section>
    </div>
  )
}
