import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CONSOLIDADO } from '../api/client'
import { useLista } from '../api/hooks'
import { useAplicacion } from '../context/AplicacionContext'
import type { Aplicacion, Requerimiento } from '../types'
import { Chip, EncabezadoPagina, Icono, Kpi, Tarjeta, TablaScroll } from '../components/ui'
import {
  COLOR_GRAFICA,
  ContenedorGrafica,
  TooltipGrafica,
  ejeCategoria,
  ejeValor,
  etiquetaBarra,
  rejilla,
} from '../components/ui/graficas'

function colorEstado(estado: string): string {
  const normalizado = estado.toUpperCase()
  if (normalizado.includes('CANCELADO')) return COLOR_GRAFICA.malo
  if (normalizado.includes('PENDIENTE') || normalizado.includes('ESPERA')) return COLOR_GRAFICA.alerta
  if (normalizado.includes('APROBADA') || normalizado.includes('APROBADO')) return COLOR_GRAFICA.ok
  return COLOR_GRAFICA.serie
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
    <div className="min-h-screen bg-slate-50">
      <EncabezadoPagina
        icono={<Icono nombre="grafico-barras" />}
        titulo="Estados de Requerimientos"
        descripcion={`Análisis detallado de estados${
          appActiva && appActiva !== CONSOLIDADO ? ` · ${appActiva}` : ' · Consolidado'
        }`}
      />

      {/* Main Content */}
      <div className="pagina">
        {/* KPI Grid - Premium Design */}
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4 mb-8">
          <Kpi
            rotulo="Total de Requerimientos"
            valor={kpis.total}
            nota="en el sistema"
            acento={COLOR_GRAFICA.serie}
          />
          <Kpi
            rotulo="Requerimientos Activos"
            valor={kpis.activos}
            nota={`${kpis.total > 0 ? Math.round((kpis.activos / kpis.total) * 100) : 0}% del total`}
            acento={COLOR_GRAFICA.serie}
          />
          <Kpi
            rotulo="Horas Estimadas"
            valor={`${fmtNumero(kpis.totalHoras)}h`}
            nota={`Promedio: ${fmtNumero(kpis.total > 0 ? kpis.totalHoras / kpis.total : 0)}h`}
            acento={COLOR_GRAFICA.serie}
          />
          <Kpi
            rotulo="Total de Entregas"
            valor={fmtNumero(kpis.totalEntregas)}
            nota="proyectadas"
            acento={COLOR_GRAFICA.serie}
          />
        </div>

        {/* Charts Section */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Tabla de estados de requerimientos */}
          <Tarjeta padding={false} className="min-w-0">
            <div className="tarjeta-encabezado">
              <div className="min-w-0">
                <h3 className="titulo-seccion truncate">Análisis por Estado de Requerimientos</h3>
                <p className="subtitulo-pagina">
                  Distribución de requerimientos y métricas por estado
                </p>
              </div>
            </div>
            <div className="tarjeta-pad">
            {porEstado.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">
                Sin datos para el filtro actual
              </p>
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
                          <Chip tono="marca">{fila.cantidad}</Chip>
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
                          <Chip tono="alerta">{`${fmtNumero(fila.horas)}h`}</Chip>
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                      <td className="px-3 py-3 text-slate-900">Total</td>
                      <td className="px-3 py-3 text-center">
                        <Chip tono="marca">{totalesEstados.cantidad}</Chip>
                      </td>
                      <td className="px-3 py-3 text-center text-slate-700">100.0%</td>
                      <td className="px-3 py-3 text-center">
                        <Chip tono="alerta">{`${fmtNumero(totalesEstados.horas)}h`}</Chip>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            </div>
          </Tarjeta>

          {/* Tabla de estados de entregas */}
          <Tarjeta padding={false} className="min-w-0">
            <div className="tarjeta-encabezado">
              <div className="min-w-0">
                <h3 className="titulo-seccion truncate">Análisis por Estado de Entregas</h3>
                <p className="subtitulo-pagina">
                  Distribución y métricas de las entregas por estado
                </p>
              </div>
            </div>
            <div className="tarjeta-pad">
            {porEstadoEntregas.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">
                Sin datos para el filtro actual
              </p>
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
                          <Chip tono="marca">{fila.cantidad}</Chip>
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
                          <Chip tono="alerta">{`${fmtNumero(fila.horas)}h`}</Chip>
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
                        <Chip tono="marca">{totalesEntregas.cantidad}</Chip>
                      </td>
                      <td className="px-3 py-3 text-center text-slate-700">100.0%</td>
                      <td className="px-3 py-3 text-center">
                        <Chip tono="alerta">{`${fmtNumero(totalesEntregas.horas)}h`}</Chip>
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
            </div>
          </Tarjeta>
        </div>

        {/* Dos gráficos lado a lado */}
        <div className="grid gap-6 lg:grid-cols-2 mt-6">
          {/* Requerimientos por estado */}
          <ContenedorGrafica
            titulo="Requerimientos por Estado"
            descripcion="Cantidad de requerimientos agrupados por estado"
            alto={320}
            vacio={porEstado.length === 0}
          >
            <BarChart data={porEstado} layout="vertical" margin={{ left: 140, right: 60, top: 20, bottom: 20 }}>
              <CartesianGrid {...rejilla('vertical')} />
              <XAxis type="number" {...ejeValor(12)} />
              <YAxis type="category" dataKey="estado" width={130} {...ejeCategoria(12)} />
              <Tooltip content={<TooltipGrafica />} />
              <Bar dataKey="cantidad" radius={[0, 12, 12, 0]} barSize={28}>
                <LabelList
                  dataKey="cantidad"
                  formatter={(valor: unknown) => String(Number(valor ?? 0))}
                  {...etiquetaBarra('right', 12)}
                />
                {porEstado.map((fila) => (
                  <Cell key={`estado-${fila.estado}`} fill={fila.color} />
                ))}
              </Bar>
            </BarChart>
          </ContenedorGrafica>

          {/* Evolución mensual */}
          <ContenedorGrafica
            titulo="Evolución Mensual"
            descripcion="Tendencia de requerimientos en el tiempo"
            alto={320}
            vacio={porMes.length === 0}
          >
            <LineChart data={porMes} margin={{ left: 0, right: 16, top: 8, bottom: 4 }}>
              <CartesianGrid {...rejilla('horizontal')} />
              <XAxis dataKey="mes" {...ejeCategoria(12)} />
              <YAxis {...ejeValor(12)} />
              <Tooltip content={<TooltipGrafica />} />
              <Line
                type="monotone"
                dataKey="cantidad"
                stroke={COLOR_GRAFICA.serie}
                strokeWidth={3}
                dot={{ r: 5, fill: COLOR_GRAFICA.serie }}
                activeDot={{ r: 7 }}
                name="Requerimientos"
              />
            </LineChart>
          </ContenedorGrafica>
        </div>
      </div>

      {detalleGarantias && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="titulo-seccion">{detalleGarantias.titulo}</h2>
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

            <div className="p-6">
              {detalleGarantias.filas.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">
                  Sin garantías para mostrar.
                </p>
              ) : (
                <TablaScroll className="max-h-[70vh] overflow-y-auto">
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
                </TablaScroll>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function GarantiasButton({ value, onClick }: { value: number; onClick: () => void }) {
  if (value <= 0) return <Chip tono="exito">{value}</Chip>

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

