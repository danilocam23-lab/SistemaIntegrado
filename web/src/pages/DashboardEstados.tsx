import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
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

function colorEstado(estado: string): string {
  const normalized = estado.toUpperCase()
  if (normalized.includes('CANCELADO')) return PALETA.rojo
  if (normalized.includes('PENDIENTE') || normalized.includes('ESPERA')) return PALETA.naranja
  if (normalized.includes('APROBADA') || normalized.includes('APROBADO')) return PALETA.verde
  if (normalized.includes('CARGADA')) return PALETA.azul_primario
  return PALETA.morado
}

function estadoNormalizado(estado: string): string {
  return estado.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function esActivo(estado: string): boolean {
  const normalized = estado.toUpperCase()
  return !normalized.includes('CANCELADO') && !normalized.includes('REEMPLAZADO')
}

function fmtNumero(valor: number): string {
  return valor.toLocaleString('es-CO', { maximumFractionDigits: 1 })
}

interface DetalleGarantia {
  reqId: string
  codigoReq: string
  nombreReq: string
  estadoEntrega: string
  numeroEntrega: number
  horas: number
  fechaComprometida: string | null
  fechaRecepcion: string | null
  observaciones: string | null
}

export default function DashboardEstados() {
  const { datos: reqs, cargando } = useLista<Requerimiento>('/requerimientos')
  const { datos: aplicaciones } = useLista<Aplicacion>('/aplicaciones')
  const { activa } = useAplicacion()
  const [detalleGarantias, setDetalleGarantias] = useState<{ titulo: string; filas: DetalleGarantia[] } | null>(null)
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
    const totalEntregas = requerimientos.reduce((sum, req) => sum + (req.entregas?.length ?? 0), 0)
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
      actual.entregas += req.entregas?.length ?? 0
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

  const porEstadoEntregas = useMemo(() => {
    const mapa = new Map<string, { estado: string; cantidad: number; horas: number; garantias: number; garantiasDetalle: DetalleGarantia[] }>()
    for (const req of requerimientos) {
      for (const entrega of req.entregas ?? []) {
        const estado = entrega.estado?.trim() || 'Sin estado'
        const actual = mapa.get(estado) ?? { estado, cantidad: 0, horas: 0, garantias: 0, garantiasDetalle: [] }
        actual.cantidad += 1
        actual.horas += Number(entrega.horas ?? 0)
        if (entrega.garantia) {
          actual.garantias += 1
          actual.garantiasDetalle.push({
            reqId: req.id,
            codigoReq: req.codigo_req,
            nombreReq: req.nombre ?? '—',
            estadoEntrega: estado,
            numeroEntrega: entrega.numero,
            horas: Number(entrega.horas ?? 0),
            fechaComprometida: entrega.fecha_comprometida,
            fechaRecepcion: entrega.fecha_recepcion,
            observaciones: entrega.observaciones,
          })
        }
        mapa.set(estado, actual)
      }
    }
    const total = requerimientos.reduce((sum, req) => sum + (req.entregas?.length ?? 0), 0) || 1
    return Array.from(mapa.values())
      .map((fila) => ({
        ...fila,
        porcentaje: (fila.cantidad / total) * 100,
        color: colorEstado(fila.estado),
      }))
      .sort((a, b) => b.cantidad - a.cantidad || b.horas - a.horas)
  }, [requerimientos])

  const porEstadoEntregasAprobacion = useMemo(() => {
    const filas = porEstadoEntregas.filter((fila) => {
      const estado = estadoNormalizado(fila.estado)
      return estado === 'APROBADA' || estado === 'EN ESPERA DE APROBACION'
    })
    const total = filas.reduce((sum, fila) => sum + fila.cantidad, 0) || 1
    return filas.map((fila) => ({
      ...fila,
      porcentaje: (fila.cantidad / total) * 100,
    }))
  }, [porEstadoEntregas])

  const totalesEntregasAprobacion = useMemo(() => (
    porEstadoEntregasAprobacion.reduce(
      (acc, fila) => {
        acc.cantidad += fila.cantidad
        acc.horas += fila.horas
        acc.garantias += fila.garantias
        return acc
      },
      { cantidad: 0, horas: 0, garantias: 0 },
    )
  ), [porEstadoEntregasAprobacion])


  const totalesEstados = useMemo(() => {
    return porEstado.reduce(
      (acc, fila) => {
        acc.cantidad += fila.cantidad
        acc.horas += fila.horas
        return acc
      },
      { cantidad: 0, horas: 0 }
    )
  }, [porEstado])

  const totalesEntregas = useMemo(() => {
    return porEstadoEntregas.reduce(
      (acc, fila) => {
        acc.cantidad += fila.cantidad
        acc.horas += fila.horas
        acc.garantias += fila.garantias
        return acc
      },
      { cantidad: 0, horas: 0, garantias: 0 }
    )
  }, [porEstadoEntregas])

  const detalleGarantiasTotal = useMemo(
    () => porEstadoEntregas.flatMap((fila) => fila.garantiasDetalle),
    [porEstadoEntregas],
  )

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
          <p className="text-sm text-slate-500 mt-2">Obteniendo datos de estados…</p>
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
                  Estados de Requerimientos
                </h1>
              </div>
              <p className="text-slate-600 text-sm">
                Análisis detallado de estados
                {appActiva && appActiva !== CONSOLIDADO ? ` • ${appActiva}` : ' • Consolidado'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* KPI Grid - Premium Design */}
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4 mb-8">
          <KpiCardPremium
            icon="📋"
            label="Total de Requerimientos"
            value={kpis.total}
            subtext="en el sistema"
            color="blue"
          />
          <KpiCardPremium
            icon="🟢"
            label="Requerimientos Activos"
            value={kpis.activos}
            subtext={`${kpis.total > 0 ? Math.round((kpis.activos / kpis.total) * 100) : 0}% del total`}
            color="green"
          />
          <KpiCardPremium
            icon="⏱️"
            label="Horas Estimadas"
            value={`${fmtNumero(kpis.totalHoras)}h`}
            subtext={`Promedio: ${fmtNumero(kpis.total > 0 ? kpis.totalHoras / kpis.total : 0)}h`}
            color="amber"
          />
          <KpiCardPremium
            icon="📦"
            label="Total de Entregas"
            value={fmtNumero(kpis.totalEntregas)}
            subtext="proyectadas"
            color="purple"
          />
        </div>

        {/* Charts Section */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Tabla de estados de requerimientos */}
          <ChartCardPremium
            titulo="Análisis por Estado de Requerimientos"
            descripcion="Distribución de requerimientos y métricas por estado"
          >
            {porEstado.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="overflow-hidden">
                <table className="w-full table-fixed text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100/50">
                      <th className="px-3 py-3 text-left font-semibold text-slate-900">Estado</th>
                      <th className="px-3 py-3 text-center font-semibold text-slate-900">Cantidad</th>
                      <th className="px-3 py-3 text-center font-semibold text-slate-900">% del total</th>
                      <th className="px-3 py-3 text-center font-semibold text-slate-900">Horas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {porEstado.map((fila) => (
                      <tr
                        key={fila.estado}
                        className="hover:bg-blue-50/40 transition-colors duration-200 group"
                      >
                        <td className="px-3 py-3 font-semibold text-slate-900 group-hover:text-blue-700 break-words">
                          <div className="flex items-center gap-3">
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: fila.color }}
                            />
                            {fila.estado}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <Badge variant="blue" value={fila.cantidad} />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-12">
                              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full transition-all duration-300"
                                  style={{ width: `${fila.porcentaje}%`, backgroundColor: fila.color }}
                                />
                              </div>
                            </div>
                            <span className="w-10 text-right text-sm font-medium text-slate-600">
                              {fila.porcentaje.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <Badge variant="amber" value={`${fmtNumero(fila.horas)}h`} />
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                      <td className="px-3 py-3 text-slate-900">Total</td>
                      <td className="px-3 py-3 text-center">
                        <Badge variant="blue" value={totalesEstados.cantidad} />
                      </td>
                      <td className="px-3 py-3 text-center text-slate-700">100.0%</td>
                      <td className="px-3 py-3 text-center">
                        <Badge variant="amber" value={`${fmtNumero(totalesEstados.horas)}h`} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </ChartCardPremium>

          <div className="space-y-6">
            {/* Tabla de estados de entregas */}
            <ChartCardPremium
              titulo="Análisis por Estado de Entregas"
              descripcion="Distribución y métricas de las entregas por estado"
            >
            {porEstadoEntregas.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="overflow-hidden">
                <table className="w-full table-fixed text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100/50">
                      <th className="px-3 py-3 text-left font-semibold text-slate-900">Estado</th>
                      <th className="px-3 py-3 text-center font-semibold text-slate-900">Entregas</th>
                      <th className="px-3 py-3 text-center font-semibold text-slate-900">% del total</th>
                      <th className="px-3 py-3 text-center font-semibold text-slate-900">Horas</th>
                      <th className="px-3 py-3 text-center font-semibold text-slate-900">Garantías</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {porEstadoEntregas.map((fila) => (
                      <tr
                        key={fila.estado}
                        className="hover:bg-blue-50/40 transition-colors duration-200 group"
                      >
                        <td className="px-3 py-3 font-semibold text-slate-900 group-hover:text-blue-700 break-words">
                          <div className="flex items-center gap-3">
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: fila.color }}
                            />
                            {fila.estado}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <Badge variant="blue" value={fila.cantidad} />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-12">
                              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full transition-all duration-300"
                                  style={{ width: `${fila.porcentaje}%`, backgroundColor: fila.color }}
                                />
                              </div>
                            </div>
                            <span className="w-10 text-right text-sm font-medium text-slate-600">
                              {fila.porcentaje.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <Badge variant="amber" value={`${fmtNumero(fila.horas)}h`} />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <GarantiasButton
                            value={fila.garantias}
                            onClick={() => setDetalleGarantias({
                              titulo: `Garantías · ${fila.estado}`,
                              filas: fila.garantiasDetalle,
                            })}
                          />
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                      <td className="px-3 py-3 text-slate-900">Total</td>
                      <td className="px-3 py-3 text-center">
                        <Badge variant="blue" value={totalesEntregas.cantidad} />
                      </td>
                      <td className="px-3 py-3 text-center text-slate-700">100.0%</td>
                      <td className="px-3 py-3 text-center">
                        <Badge variant="amber" value={`${fmtNumero(totalesEntregas.horas)}h`} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <GarantiasButton
                          value={totalesEntregas.garantias}
                          onClick={() => setDetalleGarantias({
                            titulo: 'Garantías · Total',
                            filas: detalleGarantiasTotal,
                          })}
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            </ChartCardPremium>

            <ChartCardPremium
              titulo="Entregas aprobadas y en espera de aprobación"
              descripcion="Distribución de entregas con estos estados"
            >
              {porEstadoEntregasAprobacion.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="overflow-hidden">
                  <table className="w-full table-fixed text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100/50">
                        <th className="px-3 py-3 text-left font-semibold text-slate-900">Estado</th>
                        <th className="px-3 py-3 text-center font-semibold text-slate-900">Entregas</th>
                        <th className="px-3 py-3 text-center font-semibold text-slate-900">% del total</th>
                        <th className="px-3 py-3 text-center font-semibold text-slate-900">Horas</th>
                        <th className="px-3 py-3 text-center font-semibold text-slate-900">Garantías</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {porEstadoEntregasAprobacion.map((fila) => (
                        <tr key={fila.estado} className="hover:bg-blue-50/40 transition-colors duration-200 group">
                          <td className="px-3 py-3 font-semibold text-slate-900 group-hover:text-blue-700 break-words">
                            <div className="flex items-center gap-3">
                              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: fila.color }} />
                              {fila.estado}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center"><Badge variant="blue" value={fila.cantidad} /></td>
                          <td className="px-3 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-12">
                                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${fila.porcentaje}%`, backgroundColor: fila.color }} />
                                </div>
                              </div>
                              <span className="w-10 text-right text-sm font-medium text-slate-600">{fila.porcentaje.toFixed(1)}%</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center"><Badge variant="amber" value={`${fmtNumero(fila.horas)}h`} /></td>
                          <td className="px-3 py-3 text-center"><Badge variant="green" value={fila.garantias} /></td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                        <td className="px-3 py-3 text-slate-900">Total</td>
                        <td className="px-3 py-3 text-center"><Badge variant="blue" value={totalesEntregasAprobacion.cantidad} /></td>
                        <td className="px-3 py-3 text-center text-slate-700">100.0%</td>
                        <td className="px-3 py-3 text-center"><Badge variant="amber" value={`${fmtNumero(totalesEntregasAprobacion.horas)}h`} /></td>
                        <td className="px-3 py-3 text-center"><Badge variant="green" value={totalesEntregasAprobacion.garantias} /></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </ChartCardPremium>
          </div>
        </div>

        {/* Dos gráficos lado a lado */}
        <div className="grid gap-6 lg:grid-cols-2 mt-6">
          {/* Requerimientos por estado */}
          <ChartCardPremium
            titulo="Requerimientos por Estado"
            descripcion="Cantidad de requerimientos agrupados por estado"
          >
            {porEstado.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={porEstado} layout="vertical" margin={{ left: 140, right: 60, top: 20, bottom: 20 }}>
                  <defs>
                    <linearGradient id="gradientEstados" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={PALETA.azul_brillante} stopOpacity={0.8} />
                      <stop offset="100%" stopColor={PALETA.azul_primario} stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={PALETA.gris_borde} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: PALETA.texto_sec }} />
                  <YAxis
                    type="category"
                    dataKey="estado"
                    width={130}
                    tick={{ fontSize: 12, fill: PALETA.texto_sec }}
                  />
                  <Tooltip content={<TooltipPersonalizado />} />
                  <Bar dataKey="cantidad" radius={[0, 12, 12, 0]} barSize={28}>
                    <LabelList
                      dataKey="cantidad"
                      position="right"
                      formatter={(valor: unknown) => String(Number(valor ?? 0))}
                      fill={PALETA.texto}
                      fontSize={12}
                      fontWeight={600}
                    />
                    {porEstado.map((fila) => (
                      <Cell key={`estado-${fila.estado}`} fill={fila.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCardPremium>

          {/* Evolución mensual */}
          <ChartCardPremium
            titulo="Evolución Mensual"
            descripcion="Tendencia de requerimientos en el tiempo"
          >
            {porMes.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={porMes} margin={{ left: 0, right: 16, top: 8, bottom: 4 }}>
                  <defs>
                    <linearGradient id="colorCantidad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={PALETA.azul_primario} stopOpacity={0.8} />
                      <stop offset="100%" stopColor={PALETA.azul_primario} stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={PALETA.gris_borde} vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 12, fill: PALETA.texto_sec }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: PALETA.texto_sec }} />
                  <Tooltip content={<TooltipPersonalizado />} />
                  <Line
                    type="monotone"
                    dataKey="cantidad"
                    stroke={PALETA.azul_primario}
                    strokeWidth={3}
                    dot={{ r: 5, fill: PALETA.azul_primario }}
                    activeDot={{ r: 7 }}
                    name="Requerimientos"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCardPremium>
        </div>
      </div>

      {detalleGarantias && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{detalleGarantias.titulo}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {fmtNumero(detalleGarantias.filas.length)} entrega(s) marcadas como garantía.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetalleGarantias(null)}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Cerrar detalle de garantías"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto p-6">
              {detalleGarantias.filas.length === 0 ? (
                <EmptyState />
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-4 py-3 text-left font-semibold text-slate-900">REQ</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-900">Nombre</th>
                      <th className="px-4 py-3 text-center font-semibold text-slate-900">Entrega</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-900">Estado</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-900">Horas</th>
                      <th className="px-4 py-3 text-center font-semibold text-slate-900">Comprometida</th>
                      <th className="px-4 py-3 text-center font-semibold text-slate-900">Recepción</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-900">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detalleGarantias.filas.map((fila) => (
                      <tr key={`${fila.reqId}-${fila.numeroEntrega}`} className="hover:bg-blue-50/40">
                        <td className="px-4 py-3 font-mono font-semibold text-blue-700">{fila.codigoReq}</td>
                        <td className="px-4 py-3 text-slate-700">{fila.nombreReq}</td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-900">{fila.numeroEntrega}</td>
                        <td className="px-4 py-3 text-slate-700">{fila.estadoEntrega}</td>
                        <td className="px-4 py-3 text-right font-semibold text-amber-700">{fmtNumero(fila.horas)}h</td>
                        <td className="px-4 py-3 text-center text-slate-600">{fila.fechaComprometida?.slice(0, 10) ?? '—'}</td>
                        <td className="px-4 py-3 text-center text-slate-600">{fila.fechaRecepcion?.slice(0, 10) ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{fila.observaciones || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
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
    <div className="group relative min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-lg hover:border-slate-300 transition-all duration-300">
      <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-5 transition-opacity duration-300" />

      <div className="relative p-5 xl:p-6">
        <div className="flex items-start justify-between mb-4">
          <div className={`shrink-0 text-3xl xl:text-4xl p-3 rounded-xl ${theme.light}`}>{icon}</div>
        </div>

        <div className="min-w-0 space-y-1">
          <div className="text-sm font-medium text-slate-600 uppercase tracking-wider">{label}</div>
          <div className={`break-words text-2xl font-bold ${theme.text} xl:text-3xl`}>{value}</div>
          {subtext && <div className="mt-2 break-words text-xs text-slate-500">{subtext}</div>}
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
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md">
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

function GarantiasButton({ value, onClick }: { value: number; onClick: () => void }) {
  if (value <= 0) return <Badge variant="green" value={value} />

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center rounded-lg bg-green-100 px-3 py-2 text-sm font-semibold text-green-700 underline-offset-2 transition-colors hover:bg-green-200 hover:underline focus:outline-none focus:ring-2 focus:ring-green-300"
      title="Ver detalle de garantías"
    >
      {value}
    </button>
  )
}

function TooltipPersonalizado({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    const value = payload[0].value

    return (
      <div className="rounded-lg bg-slate-900 p-3 shadow-xl border border-slate-700">
        <p className="text-sm font-semibold text-slate-100">
          {data.estado || data.mes || 'Valor'}
        </p>
        <p className="text-base font-bold text-blue-300 mt-1">
          {typeof value === 'number' ? fmtNumero(value) : value}
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
