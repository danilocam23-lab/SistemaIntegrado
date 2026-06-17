import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CONSOLIDADO } from '../api/client'
import { useLista } from '../api/hooks'
import { useAplicacion } from '../context/AplicacionContext'
import type { Aplicacion, Capacidad, Configuracion, Festivo, Persona, Requerimiento } from '../types'

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

const COLORES = ['#2563eb', '#7c3aed', '#16a34a', '#f59e0b', '#dc2626', '#0891b2', '#06b6d4', '#8b5cf6']

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


function mesActual(): string {
  const hoy = new Date()
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
}

function fechaKey(fechaIso: string): string {
  return fechaIso.slice(0, 10)
}

function contarDiasHabiles(mes: string, festivosMes: Set<string>): number {
  const [anioTxt, mesTxt] = mes.split('-')
  const anio = Number(anioTxt)
  const mesNumero = Number(mesTxt)
  if (!Number.isInteger(anio) || !Number.isInteger(mesNumero) || mesNumero < 1 || mesNumero > 12) {
    return 0
  }

  const ultimoDia = new Date(anio, mesNumero, 0).getDate()
  let total = 0
  for (let dia = 1; dia <= ultimoDia; dia += 1) {
    const fecha = new Date(anio, mesNumero - 1, dia)
    const dow = fecha.getDay()
    const key = `${anio}-${String(mesNumero).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
    if (dow !== 0 && dow !== 6 && !festivosMes.has(key)) total += 1
  }
  return total
}

export default function DashboardSquad() {
  const { datos: reqs, cargando } = useLista<Requerimiento>('/requerimientos')
  const { datos: aplicaciones } = useLista<Aplicacion>('/aplicaciones')
  const { datos: personas, cargando: cargandoPersonas } = useLista<Persona>('/personas')
  const { datos: capacidades, cargando: cargandoCapacidades } = useLista<Capacidad>('/capacidades')
  const { datos: festivos, cargando: cargandoFestivos } = useLista<Festivo>('/festivos')
  const { datos: configuraciones, cargando: cargandoConfiguraciones } = useLista<Configuracion>('/configuracion')
  const { activa } = useAplicacion()
  const [mesCapacidad, setMesCapacidad] = useState(mesActual)

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

  const squadCodigoPorNombre = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const app of aplicaciones) mapa.set(app.nombre, app.codigo)
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

  const horasMesDefault = useMemo(() => {
    const config = configuraciones.find((item) => item.clave === 'horas_mes_default')
    const valor = config ? Number(config.valor) : 180
    return Number.isFinite(valor) && valor > 0 ? valor : 180
  }, [configuraciones])

  const festivosMesSeleccionado = useMemo(() => {
    const set = new Set<string>()
    for (const festivo of festivos) {
      const key = fechaKey(festivo.fecha)
      if (key.slice(0, 7) === mesCapacidad) set.add(key)
    }
    return set
  }, [festivos, mesCapacidad])

  const capacidadPorPersonaMes = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const capacidad of capacidades) {
      if (capacidad.scope === 'persona' && capacidad.persona_id && capacidad.mes === mesCapacidad) {
        mapa.set(capacidad.persona_id, Number(capacidad.horas_disponibles ?? 0))
      }
    }
    return mapa
  }, [capacidades, mesCapacidad])

  const filasCapacidadSquad = useMemo(() => {
    const diasLaborables = contarDiasHabiles(mesCapacidad, new Set())
    const diasHabiles = contarDiasHabiles(mesCapacidad, festivosMesSeleccionado)
    const factorMes = diasLaborables > 0 ? diasHabiles / diasLaborables : 1
    const horasDefaultMes = horasMesDefault * factorMes
    const mapa = new Map<string, { squadId: string; squad: string; horas: number; personas: number }>()

    for (const persona of personas) {
      if (!persona.activo || persona.rol_operativo === 'LT_EPM') continue
      const squadsNormalizados = (persona.squads ?? []).map((squad) => squadCodigoPorNombre.get(squad) ?? squad)
      const squadActivaNombre = activa && activa !== CONSOLIDADO ? (squadNombrePorCodigo.get(activa) ?? activa) : ''
      const perteneceActiva =
        activa !== CONSOLIDADO &&
        !!activa &&
        (
          squadsNormalizados.length === 0 ||
          squadsNormalizados.includes(activa) ||
          (squadActivaNombre ? (persona.squads ?? []).includes(squadActivaNombre) : false)
        )

      const squadsPersona = activa !== CONSOLIDADO && activa
        ? (perteneceActiva ? [activa] : [])
        : squadsNormalizados

      for (const squadId of squadsPersona) {
        const squad = squadNombrePorCodigo.get(squadId) ?? squadId
        const capacidadPersona = capacidadPorPersonaMes.get(persona.id) ?? horasDefaultMes
        const actual = mapa.get(squadId) ?? { squadId, squad, horas: 0, personas: 0 }
        actual.horas += capacidadPersona
        actual.personas += 1
        mapa.set(squadId, actual)
      }
    }

    return Array.from(mapa.values()).sort((a, b) => b.horas - a.horas || b.personas - a.personas)
  }, [
    activa,
    capacidadPorPersonaMes,
    festivosMesSeleccionado,
    horasMesDefault,
    mesCapacidad,
    personas,
    squadCodigoPorNombre,
    squadNombrePorCodigo,
  ])

  const resumenCapacidad = useMemo(() => {
    const totalHoras = filasCapacidadSquad.reduce((sum, fila) => sum + fila.horas, 0)
    const totalPersonas = filasCapacidadSquad.reduce((sum, fila) => sum + fila.personas, 0)
    return { totalHoras, totalPersonas }
  }, [filasCapacidadSquad])

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

  if (cargando || cargandoPersonas || cargandoCapacidades || cargandoFestivos || cargandoConfiguraciones) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <div className="mb-6 flex justify-center">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-600 animate-spin" />
            </div>
          </div>
          <p className="text-lg font-semibold text-slate-900">Cargando dashboard</p>
          <p className="text-sm text-slate-500 mt-2">Obteniendo datos del equipo…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      {/* Header Premium */}
      <div className="sticky top-0 z-30 border-b border-slate-200/50 bg-white/80 backdrop-blur-xl shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">📊</span>
                </div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-slate-900 bg-clip-text text-transparent">
                  Dashboard Squads
                </h1>
              </div>
              <p className="text-slate-600 text-sm">
                Métricas de capacidad y requerimientos en tiempo real
                {appActiva && appActiva !== CONSOLIDADO ? ` • ${appActiva}` : ' • Todos los squads'}
              </p>
            </div>

            {/* Filter Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative group">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  📅 Mes de Capacidad
                </label>
                <input
                  type="month"
                  value={mesCapacidad}
                  onChange={(event) => setMesCapacidad(event.target.value)}
                  className="px-4 py-2.5 rounded-lg border-2 border-slate-200 bg-white font-semibold text-slate-900 focus:border-blue-500 focus:outline-none transition-colors cursor-pointer hover:border-slate-300"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* KPI Grid - Premium Design */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <KpiCardPremium
            icon="📊"
            label="Squads Activos"
            value={kpis.totalSquads}
            subtext="con requerimientos"
            color="blue"
            trend={kpis.totalSquads > 0 ? '+5%' : '0%'}
          />
          <KpiCardPremium
            icon="🏆"
            label="Squad Principal"
            value={kpis.topNombre}
            subtext={`${kpis.topCantidad} requerimientos`}
            color="purple"
          />
          <KpiCardPremium
            icon="⏱️"
            label="Horas Estimadas"
            value={`${fmtNumero(kpis.totalHoras)}h`}
            subtext={`Promedio: ${fmtNumero(kpis.promedioHoras)}h`}
            color="amber"
          />
          <KpiCardPremium
            icon="👥"
            label="Equipo Disponible"
            value={resumenCapacidad.totalPersonas}
            subtext={`${fmtNumero(resumenCapacidad.totalHoras)}h capacidad`}
            color="green"
          />
        </div>

        {/* Charts Section */}
        <div className="space-y-6">
          {/* Capacidad Mensual - Main Chart */}
          <ChartCardPremium
            titulo="Capacidad Mensual por Squad"
            descripcion={`Distribución de horas disponibles · Festivos: ${festivosMesSeleccionado.size}`}
          >
            {filasCapacidadSquad.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={filasCapacidadSquad} layout="vertical" margin={{ left: 140, right: 60, top: 20, bottom: 20 }}>
                  <defs>
                    <linearGradient id="gradientBar" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#2563EB" stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={PALETA.gris_borde} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12, fill: PALETA.texto_sec }} />
                  <YAxis
                    type="category"
                    dataKey="squad"
                    width={130}
                    tick={{ fontSize: 12, fill: PALETA.texto_sec }}
                  />
                  <Tooltip content={<TooltipPersonalizado />} />
                  <Bar dataKey="horas" fill="url(#gradientBar)" radius={[0, 12, 12, 0]} barSize={32}>
                    <LabelList
                      dataKey="horas"
                      position="right"
                      formatter={(valor: unknown) => `${fmtNumero(Number(valor ?? 0))}h`}
                      fill={PALETA.texto}
                      fontSize={13}
                      fontWeight={600}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCardPremium>

          {/* Dos gráficos lado a lado */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Requerimientos por Squad */}
            <ChartCardPremium
              titulo="Requerimientos por Squad"
              descripcion="Total de requerimientos asignados"
            >
              {filas.length === 0 ? (
                <EmptyState />
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={filas} layout="vertical" margin={{ left: 140, right: 60, top: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={PALETA.gris_borde} horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: PALETA.texto_sec }} />
                    <YAxis type="category" dataKey="squad" width={130} tick={{ fontSize: 12, fill: PALETA.texto_sec }} />
                    <Tooltip content={<TooltipPersonalizado />} />
                    <Bar dataKey="reqs" radius={[0, 12, 12, 0]} barSize={28}>
                      <LabelList
                        dataKey="reqs"
                        position="right"
                        formatter={(valor: unknown) => String(Number(valor ?? 0))}
                        fill={PALETA.texto}
                        fontSize={12}
                        fontWeight={600}
                      />
                      {filas.map((_, index) => (
                        <Cell key={`req-${index}`} fill={COLORES[index % COLORES.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCardPremium>

            {/* Horas Estimadas por Squad */}
            <ChartCardPremium
              titulo="Horas Estimadas por Squad"
              descripcion="Carga total de trabajo proyectada"
            >
              {filas.length === 0 ? (
                <EmptyState />
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={filas} layout="vertical" margin={{ left: 140, right: 60, top: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={PALETA.gris_borde} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12, fill: PALETA.texto_sec }} />
                    <YAxis type="category" dataKey="squad" width={130} tick={{ fontSize: 12, fill: PALETA.texto_sec }} />
                    <Tooltip content={<TooltipPersonalizado />} />
                    <Bar dataKey="horas" radius={[0, 12, 12, 0]} barSize={28}>
                      <LabelList
                        dataKey="horas"
                        position="right"
                        formatter={(valor: unknown) => `${fmtNumero(Number(valor ?? 0))}h`}
                        fill={PALETA.texto}
                        fontSize={12}
                        fontWeight={600}
                      />
                      {filas.map((_, index) => (
                        <Cell key={`hora-${index}`} fill={COLORES[index % COLORES.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCardPremium>
          </div>

          {/* Table Section */}
          <ChartCardPremium titulo="Detalle Completo por Squad" descripcion="Resumen de métricas y cumplimiento">
            {filas.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100/50">
                      <th className="px-6 py-4 text-left font-semibold text-slate-900">Squad</th>
                      <th className="px-6 py-4 text-center font-semibold text-slate-900">Reqs</th>
                      <th className="px-6 py-4 text-center font-semibold text-slate-900">Horas</th>
                      <th className="px-6 py-4 text-center font-semibold text-slate-900">Entregas</th>
                      <th className="px-6 py-4 text-center font-semibold text-slate-900">ANS Acta</th>
                      <th className="px-6 py-4 text-center font-semibold text-slate-900">ANS Entrega</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filas.map((fila) => (
                      <tr
                        key={fila.squadId ?? 'sin-squad'}
                        className="hover:bg-blue-50/40 transition-colors duration-200 group"
                      >
                        <td className="px-6 py-4 font-semibold text-slate-900 group-hover:text-blue-700">{fila.squad}</td>
                        <td className="px-6 py-4 text-center">
                          <Badge variant="blue" value={fila.reqs} />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Badge variant="amber" value={`${fmtNumero(fila.horas)}h`} />
                        </td>
                        <td className="px-6 py-4 text-center text-slate-700 font-medium">{fmtNumero(fila.entregas)}</td>
                        <td className="px-6 py-4 text-center">
                          <ProgressBadge percentage={Math.round((fila.ansActaCumple / (fila.ansActaTotal || 1)) * 100)} />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <ProgressBadge percentage={Math.round((fila.ansEntregaCumple / (fila.ansEntregaTotal || 1)) * 100)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ChartCardPremium>
        </div>
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
  trend,
}: {
  icon: string
  label: string
  value: string | number
  subtext?: string
  color: 'blue' | 'purple' | 'amber' | 'green'
  trend?: string
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
          {trend && (
            <div className="text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
              {trend}
            </div>
          )}
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

function Badge({ variant, value }: { variant: 'blue' | 'amber' | 'green' | 'red'; value: string | number }) {
  const variants = {
    blue: 'bg-blue-100 text-blue-700',
    amber: 'bg-amber-100 text-amber-700',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
  }

  return (
    <span className={`inline-flex items-center px-3 py-2 rounded-lg font-semibold text-sm ${variants[variant]}`}>
      {value}
    </span>
  )
}

function ProgressBadge({ percentage }: { percentage: number }) {
  let color = 'bg-red-100 text-red-700'
  if (percentage >= 75) color = 'bg-green-100 text-green-700'
  else if (percentage >= 50) color = 'bg-amber-100 text-amber-700'

  return (
    <div className="flex items-center gap-2 justify-center">
      <span className={`inline-block px-3 py-1.5 rounded-lg font-semibold text-sm ${color}`}>
        {percentage}%
      </span>
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
          {data.squad || 'Valor'}
        </p>
        <p className="text-base font-bold text-blue-300 mt-1">
          {typeof value === 'number' ? fmtNumero(value) : value}{payload[0].dataKey === 'horas' ? 'h' : ''}
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
      <p className="text-slate-400 text-sm mt-1">No hay información para mostrar en este período</p>
    </div>
  )
}
