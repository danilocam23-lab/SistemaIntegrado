import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import client from '../api/client'
import { useAplicacion } from '../context/AplicacionContext'

// Paleta de colores premium
const PALETA = {
  azul_profundo: '#0F172A',
  azul_primario: '#2563EB',
  azul_brillante: '#3B82F6',
  morado: '#7C3AED',
  verde: '#16A34A',
  naranja: '#F59E0B',
  rojo: '#DC2626',
  gris_fondo: '#F8FAFC',
  gris_borde: '#E2E8F0',
  texto: '#0F172A',
  texto_sec: '#64748B',
}

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      {/* Header Premium */}
      <div className="sticky top-0 z-30 border-b border-slate-200/50 bg-white/80 backdrop-blur-xl shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-600 to-purple-700 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">📊</span>
                </div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 via-purple-800 to-slate-900 bg-clip-text text-transparent">
                  Cifras y ANS
                </h1>
              </div>
              <p className="text-slate-600 text-sm">
                Análisis detallado de estados, ANS y liquidación
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-700">
            ⚠️ {error}
          </div>
        )}

        {/* Requerimientos por estado */}
        <ChartCardPremium
          titulo="Requerimientos por Estado"
          descripcion="Distribución de requerimientos agrupados por estado"
        >
          {estado.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(320, estado.length * 40)}>
              <BarChart data={estado} layout="vertical" margin={{ left: 150, right: 60, top: 20, bottom: 20 }}>
                <defs>
                  <linearGradient id="gradientEstado" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={PALETA.azul_brillante} stopOpacity={0.8} />
                    <stop offset="100%" stopColor={PALETA.azul_primario} stopOpacity={1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={PALETA.gris_borde} horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: PALETA.texto_sec }} />
                <YAxis type="category" dataKey="estado" width={140} tick={{ fontSize: 12, fill: PALETA.texto_sec }} />
                <Tooltip content={<TooltipPersonalizado />} />
                <Bar dataKey="cantidad" fill="url(#gradientEstado)" radius={[0, 12, 12, 0]} barSize={28}>
                  <LabelList 
                    dataKey="cantidad" 
                    position="right" 
                    formatter={(valor: unknown) => String(Number(valor ?? 0))}
                    fill={PALETA.texto}
                    fontSize={12}
                    fontWeight={600}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCardPremium>

        {/* Dos gráficos lado a lado */}
        <div className="grid gap-6 lg:grid-cols-2 mt-6">
          {/* Requerimientos por squad */}
          <ChartCardPremium
            titulo="Requerimientos por Squad"
            descripcion="Cantidad de requerimientos por equipo"
          >
            {squad.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={squad} layout="vertical" margin={{ left: 100, right: 60, top: 20, bottom: 20 }}>
                  <defs>
                    <linearGradient id="gradientSquad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={PALETA.morado} stopOpacity={0.8} />
                      <stop offset="100%" stopColor={PALETA.azul_primario} stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={PALETA.gris_borde} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: PALETA.texto_sec }} />
                  <YAxis type="category" dataKey="squad" width={90} tick={{ fontSize: 12, fill: PALETA.texto_sec }} />
                  <Tooltip content={<TooltipPersonalizado />} />
                  <Bar dataKey="cantidad" fill="url(#gradientSquad)" radius={[0, 12, 12, 0]} barSize={28}>
                    <LabelList 
                      dataKey="cantidad" 
                      position="right" 
                      formatter={(valor: unknown) => String(Number(valor ?? 0))}
                      fill={PALETA.texto}
                      fontSize={12}
                      fontWeight={600}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCardPremium>

          {/* Cumplimiento de ANS */}
          <ChartCardPremium
            titulo="Cumplimiento de ANS"
            descripcion="Comparativa de ANS por tipo de evaluación"
          >
            {ansData.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={ansData} margin={{ left: 0, right: 16, top: 20, bottom: 20 }}>
                  <defs>
                    <linearGradient id="gradientCumple" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={PALETA.verde} stopOpacity={0.8} />
                      <stop offset="100%" stopColor={PALETA.verde} stopOpacity={1} />
                    </linearGradient>
                    <linearGradient id="gradientNoCumple" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={PALETA.rojo} stopOpacity={0.8} />
                      <stop offset="100%" stopColor={PALETA.rojo} stopOpacity={1} />
                    </linearGradient>
                    <linearGradient id="gradientSinAns" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={PALETA.gris_borde} stopOpacity={0.8} />
                      <stop offset="100%" stopColor={PALETA.gris_borde} stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={PALETA.gris_borde} />
                  <XAxis dataKey="tipo" tick={{ fontSize: 12, fill: PALETA.texto_sec }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: PALETA.texto_sec }} />
                  <Tooltip content={<TooltipPersonalizado />} />
                  <Legend />
                  <Bar dataKey="CUMPLE" fill="url(#gradientCumple)" radius={[8, 8, 0, 0]} barSize={40}>
                    <LabelList 
                      dataKey="CUMPLE" 
                      position="top" 
                      formatter={(valor: unknown) => String(Number(valor ?? 0))}
                      fill={PALETA.texto}
                      fontSize={12}
                      fontWeight={600}
                    />
                  </Bar>
                  <Bar dataKey="NO_CUMPLE" fill="url(#gradientNoCumple)" radius={[8, 8, 0, 0]} barSize={40}>
                    <LabelList 
                      dataKey="NO_CUMPLE" 
                      position="top" 
                      formatter={(valor: unknown) => String(Number(valor ?? 0))}
                      fill={PALETA.texto}
                      fontSize={12}
                      fontWeight={600}
                    />
                  </Bar>
                  <Bar dataKey="SIN_ANS" fill="url(#gradientSinAns)" radius={[8, 8, 0, 0]} barSize={40}>
                    <LabelList 
                      dataKey="SIN_ANS" 
                      position="top" 
                      formatter={(valor: unknown) => String(Number(valor ?? 0))}
                      fill={PALETA.texto}
                      fontSize={12}
                      fontWeight={600}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCardPremium>
        </div>

        {/* Liquidación Section */}
        {liq && (
          <div className="mt-8 space-y-6">
            {/* KPI Cards */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCardPremium
                icon="📋"
                label="Requerimientos"
                value={liq.total_reqs}
                subtext={`${liq.con_monto} con monto pactado`}
                color="blue"
              />
              <KpiCardPremium
                icon="💰"
                label="Monto Pactado Total"
                value={fmtCOP(liq.total_monto)}
                subtext={`${liq.total_entregas} entregas`}
                color="green"
              />
              <KpiCardPremium
                icon="⏱️"
                label="Horas Estimadas"
                value={liq.total_horas.toLocaleString('es-CO', { maximumFractionDigits: 1 })}
                subtext="horas totales"
                color="amber"
              />
              <KpiCardPremium
                icon="📊"
                label="Promedio por Req"
                value={liq.total_reqs > 0
                  ? (liq.total_horas / liq.total_reqs).toLocaleString('es-CO', { maximumFractionDigits: 1 })
                  : '0'}
                subtext="horas por requerimiento"
                color="purple"
              />
            </div>

            {/* Monto por squad */}
            {liq.por_squad.length > 0 && (
              <ChartCardPremium
                titulo="Monto Pactado por Squad"
                descripcion="Distribución de presupuesto por equipo"
              >
                <ResponsiveContainer width="100%" height={Math.max(280, liq.por_squad.length * 50)}>
                  <BarChart data={liq.por_squad} layout="vertical" margin={{ left: 120, right: 60, top: 20, bottom: 20 }}>
                    <defs>
                      <linearGradient id="gradientMonto" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={PALETA.verde} stopOpacity={0.8} />
                        <stop offset="100%" stopColor={PALETA.verde} stopOpacity={1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={PALETA.gris_borde} horizontal={false} />
                    <XAxis 
                      type="number" 
                      tickFormatter={(v) => `$${(v / 1_000_000).toFixed(0)}M`} 
                      tick={{ fontSize: 12, fill: PALETA.texto_sec }}
                    />
                    <YAxis type="category" dataKey="squad" width={110} tick={{ fontSize: 12, fill: PALETA.texto_sec }} />
                    <Tooltip content={<TooltipCOP />} />
                    <Bar dataKey="monto" fill="url(#gradientMonto)" radius={[0, 12, 12, 0]} barSize={32}>
                      <LabelList 
                        dataKey="monto" 
                        position="right" 
                        formatter={(valor: unknown) => fmtCOP(Number(valor ?? 0))}
                        fill={PALETA.texto}
                        fontSize={11}
                        fontWeight={600}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCardPremium>
            )}

            {/* Horas por squad */}
            {liq.por_squad.length > 0 && (
              <ChartCardPremium
                titulo="Horas Estimadas por Squad"
                descripcion="Carga de trabajo proyectada por equipo"
              >
                <ResponsiveContainer width="100%" height={Math.max(280, liq.por_squad.length * 50)}>
                  <BarChart data={liq.por_squad} layout="vertical" margin={{ left: 120, right: 60, top: 20, bottom: 20 }}>
                    <defs>
                      <linearGradient id="gradientHoras" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={PALETA.naranja} stopOpacity={0.8} />
                        <stop offset="100%" stopColor={PALETA.naranja} stopOpacity={1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={PALETA.gris_borde} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12, fill: PALETA.texto_sec }} />
                    <YAxis type="category" dataKey="squad" width={110} tick={{ fontSize: 12, fill: PALETA.texto_sec }} />
                    <Tooltip content={<TooltipHoras />} />
                    <Bar dataKey="horas" fill="url(#gradientHoras)" radius={[0, 12, 12, 0]} barSize={32}>
                      <LabelList 
                        dataKey="horas" 
                        position="right" 
                        formatter={(valor: unknown) => Number(valor ?? 0).toLocaleString('es-CO', { maximumFractionDigits: 1 })}
                        fill={PALETA.texto}
                        fontSize={11}
                        fontWeight={600}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCardPremium>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function KpiCardPremium({
  icon,
  label,
  value,
  subtext,
  color,
}: {
  icon: string
  label: string
  value: string | number
  subtext?: string
  color: 'blue' | 'purple' | 'amber' | 'green'
}) {
  const colors = {
    blue: {
      bg: 'from-blue-600 to-blue-700',
      light: 'bg-blue-50',
      text: 'text-blue-900',
      border: 'border-blue-200',
    },
    purple: {
      bg: 'from-purple-600 to-purple-700',
      light: 'bg-purple-50',
      text: 'text-purple-900',
      border: 'border-purple-200',
    },
    amber: {
      bg: 'from-amber-500 to-amber-600',
      light: 'bg-amber-50',
      text: 'text-amber-900',
      border: 'border-amber-200',
    },
    green: {
      bg: 'from-green-600 to-green-700',
      light: 'bg-green-50',
      text: 'text-green-900',
      border: 'border-green-200',
    },
  }

  const theme = colors[color]

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-lg hover:border-slate-300 transition-all duration-300">
      <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-5 transition-opacity duration-300" />

      <div className="relative p-6">
        <div className="flex items-start justify-between mb-4">
          <div className={`text-4xl p-3 rounded-xl ${theme.light}`}>{icon}</div>
        </div>

        <div className="space-y-1">
          <div className="text-sm font-medium text-slate-600 uppercase tracking-wider">{label}</div>
          <div className={`text-3xl font-bold ${theme.text}`}>{value}</div>
          {subtext && <div className="text-xs text-slate-500 mt-2">{subtext}</div>}
        </div>
      </div>
    </div>
  )
}

function ChartCardPremium({
  titulo,
  descripcion,
  children,
}: {
  titulo: string
  descripcion?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-slate-900">{titulo}</h3>
        {descripcion && <p className="text-sm text-slate-500 mt-1">{descripcion}</p>}
      </div>
      <div className="relative">{children}</div>
    </div>
  )
}

function TooltipPersonalizado({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    const value = payload[0].value

    return (
      <div className="rounded-lg bg-slate-900 p-3 shadow-xl border border-slate-700">
        <p className="text-sm font-semibold text-slate-100">
          {data.estado || data.squad || 'Valor'}
        </p>
        <p className="text-base font-bold text-blue-300 mt-1">
          {typeof value === 'number' ? String(value) : value}
        </p>
      </div>
    )
  }
  return null
}

function TooltipCOP({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    const value = payload[0].value

    return (
      <div className="rounded-lg bg-slate-900 p-3 shadow-xl border border-slate-700">
        <p className="text-sm font-semibold text-slate-100">{data.squad}</p>
        <p className="text-base font-bold text-green-300 mt-1">{fmtCOP(Number(value ?? 0))}</p>
      </div>
    )
  }
  return null
}

function TooltipHoras({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    const value = payload[0].value

    return (
      <div className="rounded-lg bg-slate-900 p-3 shadow-xl border border-slate-700">
        <p className="text-sm font-semibold text-slate-100">{data.squad}</p>
        <p className="text-base font-bold text-amber-300 mt-1">
          {Number(value ?? 0).toLocaleString('es-CO', { maximumFractionDigits: 1 })}h
        </p>
      </div>
    )
  }
  return null
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="text-6xl mb-4 opacity-20">📭</div>
      <p className="text-slate-600 font-semibold">Sin datos disponibles</p>
      <p className="text-slate-400 text-sm mt-1">No hay información para mostrar</p>
    </div>
  )
}
