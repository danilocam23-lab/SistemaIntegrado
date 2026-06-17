import { useMemo } from 'react'
import type { PieLabelRenderProps } from 'recharts'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
  LineChart, Line,
} from 'recharts'
import { useLista } from '../api/hooks'
import { ESTADOS_REQUERIMIENTO } from '../constantes'
import type { Persona, Requerimiento } from '../types'

const COLORES = [
  '#2563eb', '#16a34a', '#ea580c', '#8b5cf6', '#e11d48',
  '#0891b2', '#ca8a04', '#64748b', '#d946ef', '#059669',
  '#dc2626', '#6366f1',
]

const COLORES_KPI = {
  total:    { bg: 'bg-blue-50',   text: 'text-blue-600',   border: 'border-blue-200',   icon: '📋' },
  horas:    { bg: 'bg-green-50',  text: 'text-green-600',  border: 'border-green-200',  icon: '⏱️' },
  entregas: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200', icon: '📦' },
  ansActa:  { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200', icon: '📝' },
  ansEnt:   { bg: 'bg-teal-50',   text: 'text-teal-600',   border: 'border-teal-200',   icon: '✅' },
}

function abreviarEstado(e: string): string {
  return e
    .replace('ESTIMACION EN CURSO POR HITSS', 'Est. Curso')
    .replace('ESTIMACION EN ESPERA DE APROBACION POR EPM', 'Est. Espera')
    .replace('ESTIMACION APROBADA POR LT', 'Est. Aprob. LT')
    .replace('ESTIMACION APROBADA ENTREGA PENDIENTE', 'Est. Aprob.')
    .replace('ENTREGA CARGADA', 'Ent. Cargada')
    .replace('ENTREGA NO CARGADA', 'Ent. No Carg.')
    .replace('CONTROL DE CAMBIOS', 'Ctrl. Cambios')
    .replace('REQUERIMIENTO DEVUELTO A EPM', 'Devuelto')
    .replace('REQUERIMIENTO SUSPENDIDO POR EPM', 'Suspendido')
    .replace('REQUERIMIENTO CANCELADO POR EPM', 'Cancel. EPM')
    .replace('REQUERIMIENTO CANCELADO', 'Cancelado')
    .replace('REQUERIMIENTO REEMPLAZADO', 'Reemplazado')
}

export default function DashboardRequerimientos() {
  const { datos: reqs, cargando } = useLista<Requerimiento>('/requerimientos')
  const { datos: personas } = useLista<Persona>('/personas')

  // ─── KPIs ───────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalHoras = reqs.reduce((s, r) => s + Number(r.total_horas_estimadas ?? 0), 0)
    const allEntregas = reqs.flatMap((r) => r.entregas ?? [])
    const totalEntregas = allEntregas.length

    // ANS Requerimientos: evalúa todos los requerimientos activos
    const reqsActivos = reqs.filter((r) => {
      const normalized = r.estado.toUpperCase()
      return !normalized.includes('CANCELADO') && !normalized.includes('REEMPLAZADO')
    })
    const requerimentosConAns = reqsActivos.filter((r) => r.ans_acta)
    const ansReqCumple = requerimentosConAns.filter((r) => r.ans_acta === 'CUMPLE').length
    const ansReqPct = requerimentosConAns.length > 0 ? Math.round((ansReqCumple / requerimentosConAns.length) * 100) : 0

    // ANS Entregas: campo ans_entrega de cada entrega
    const conAnsEnt    = allEntregas.filter((e) => e.ans_entrega)
    const ansEntCumple = conAnsEnt.filter((e) => e.ans_entrega === 'CUMPLE').length
    const ansEntPct    = conAnsEnt.length > 0 ? Math.round((ansEntCumple / conAnsEnt.length) * 100) : 0

    return {
      total: reqs.length, totalHoras, totalEntregas,
      ansReqPct, ansReqCumple, ansReqTotal: requerimentosConAns.length,
      ansEntPct, ansEntCumple, ansEntTotal: conAnsEnt.length,
    }
  }, [reqs])

  // ─── Requerimientos por estado ──────────────────────────
  const porEstado = useMemo(() => {
    const map: Record<string, number> = {}
    for (const e of ESTADOS_REQUERIMIENTO) map[e] = 0
    for (const r of reqs) {
      map[r.estado] = (map[r.estado] ?? 0) + 1
    }
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .map(([estado, cantidad]) => ({ estado: abreviarEstado(estado), cantidad, full: estado }))
  }, [reqs])

  // ─── Requerimientos por mes (fecha_inicio) ──────────────
  const porMes = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of reqs) {
      const fecha = r.fecha_inicio ?? r.fecha_solicitud_acta
      if (!fecha) continue
      const mes = fecha.substring(0, 7) // YYYY-MM
      map[mes] = (map[mes] ?? 0) + 1
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, cantidad]) => ({ mes, cantidad }))
  }, [reqs])

  // ─── Equipo: solo Líderes Técnicos HITSS ───────────────
  const equipo = useMemo(() => {
    const ids = new Set<string>()
    for (const r of reqs) {
      if (r.solicitud?.lt_hitss_id) ids.add(r.solicitud.lt_hitss_id)
    }
    const conteo: Record<string, number> = {}
    for (const r of reqs) {
      if (r.solicitud?.lt_hitss_id) conteo[r.solicitud.lt_hitss_id] = (conteo[r.solicitud.lt_hitss_id] ?? 0) + 1
    }
    return Array.from(ids).map((id) => {
      const p = personas.find((x) => x.id === id)
      return { id, nombre: p?.nombre ?? id, email: p?.email ?? '', reqs: conteo[id] ?? 0 }
    }).sort((a, b) => b.reqs - a.reqs)
  }, [reqs, personas])

  // ─── Por tipo de costo (pie) ────────────────────────────
  const porTipoCosto = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of reqs) {
      const tipo = r.solicitud?.tipo_costo ?? 'Sin tipo'
      map[tipo] = (map[tipo] ?? 0) + 1
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [reqs])

  // ─── Tendencia mensual (entregas por mes) ───────────────
  const tendencia = useMemo(() => {
    const map: Record<string, { total: number; cumple: number; noCumple: number }> = {}
    for (const r of reqs) {
      for (const e of r.entregas ?? []) {
        const fecha = e.fecha_recepcion ?? e.fecha_comprometida
        if (!fecha) continue
        const mes = fecha.substring(0, 7)
        if (!map[mes]) map[mes] = { total: 0, cumple: 0, noCumple: 0 }
        map[mes].total++
        if (e.ans_entrega === 'CUMPLE') map[mes].cumple++
        else if (e.ans_entrega === 'NO_CUMPLE') map[mes].noCumple++
      }
    }
   return Object.entries(map)
     .sort(([a], [b]) => a.localeCompare(b))
     .map(([mes, v]) => ({ mes, ...v }))
  }, [reqs])

  if (cargando) {
   return <div className="p-8 text-center text-slate-500">Cargando dashboard…</div>
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-marca-osc">Dashboard de Requerimientos</h1>
      <p className="text-sm text-slate-500">
        Métricas y estado general de los requerimientos.
      </p>

      {/* ═══ KPI Cards ═══ */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          icon={COLORES_KPI.total.icon} label="Requerimientos" value={kpis.total}
          sub={`${porEstado.filter((e) => !e.full.includes('CANCELADO') && !e.full.includes('REEMPLAZADO')).reduce((s, e) => s + e.cantidad, 0)} activos`}
          color={COLORES_KPI.total} />
        <KpiCard
          icon={COLORES_KPI.horas.icon} label="Horas estimadas" value={kpis.totalHoras.toLocaleString()}
          sub="total acumulado"
          color={COLORES_KPI.horas} />
        <KpiCard
          icon={COLORES_KPI.entregas.icon} label="Entregas" value={kpis.totalEntregas}
          sub={`de ${reqs.length} requerimientos`}
          color={COLORES_KPI.entregas} />
        <KpiCard
          icon={COLORES_KPI.ansActa.icon} label="ANS Requerimientos" value={`${kpis.ansReqPct}%`}
          sub={`${kpis.ansReqCumple} / ${kpis.ansReqTotal} evaluados`}
          color={COLORES_KPI.ansActa} />
        <KpiCard
          icon={COLORES_KPI.ansEnt.icon} label="ANS Entregas" value={`${kpis.ansEntPct}%`}
          sub={`${kpis.ansEntCumple} / ${kpis.ansEntTotal} evaluados`}
          color={COLORES_KPI.ansEnt} />
      </div>

      {/* ═══ Row 2: Estado + Mes + Equipo ═══ */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Requerimientos por estado */}
        <Panel titulo="Requerimientos por estado">
          {porEstado.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={porEstado} layout="vertical" margin={{ left: 10, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="estado" width={95} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => [v, 'Requerimientos']} />
                <Bar dataKey="cantidad" fill="#2563eb" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Requerimientos por mes */}
        <Panel titulo="Requerimientos por mes">
          {porMes.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={porMes} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [v, 'Requerimientos']} />
                <Bar dataKey="cantidad" fill="#16a34a" radius={[4, 4, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Equipo */}
        <Panel titulo={`LT HITSS (${equipo.length})`}>
          <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
            {equipo.length === 0 ? <Empty /> : equipo.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-marca text-sm font-bold text-white">
                  {m.nombre.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{m.nombre}</div>
                  <div className="truncate text-xs text-slate-400">{m.email || '—'}</div>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {m.reqs}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* ═══ Row 3: Tipo costo + Tendencia ═══ */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Tipo de costo (Pie) */}
        <Panel titulo="Por tipo de costo">
          {porTipoCosto.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={porTipoCosto} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  outerRadius={90} innerRadius={50} paddingAngle={2}
                  label={(props: PieLabelRenderProps) => `${props.name ?? ''} ${(((props.percent as number) ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false} fontSize={11}>
                  {porTipoCosto.map((_, i) => (
                    <Cell key={i} fill={COLORES[i % COLORES.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [v, 'Requerimientos']} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Tendencia entregas */}
        <Panel titulo="Tendencia de entregas">
          {tendencia.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={tendencia} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2} name="Total" dot />
                <Line type="monotone" dataKey="cumple" stroke="#16a34a" strokeWidth={2} name="Cumple" dot />
                <Line type="monotone" dataKey="noCumple" stroke="#dc2626" strokeWidth={2} name="No cumple" dot />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>
    </div>
  )
}

/* ─── Componentes auxiliares ─── */

function KpiCard({ icon, label, value, sub, color }: {
  icon: string; label: string; value: string | number; sub: string
  color: { bg: string; text: string; border: string }
}) {
  return (
    <div className={`flex items-center gap-4 rounded-xl border ${color.border} ${color.bg} p-4`}>
      <span className="text-3xl">{icon}</span>
      <div>
        <div className={`text-2xl font-bold ${color.text}`}>{value}</div>
        <div className="text-sm font-medium text-slate-700">{label}</div>
        <div className="text-xs text-slate-500">{sub}</div>
      </div>
    </div>
  )
}

function Panel({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
      <h3 className="mb-4 text-sm font-semibold text-slate-900 uppercase tracking-wide">{titulo}</h3>
      {children}
    </div>
  )
}

function Empty() {
  return <p className="py-8 text-center text-sm text-slate-400">Sin datos</p>
}
