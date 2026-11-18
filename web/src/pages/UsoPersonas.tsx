// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Fragment, useState } from 'react'
import { useLista } from '../api/hooks'
import {
  Aviso, Boton, BarraFiltros, Campo, Chip, EncabezadoPagina, Icono, Kpi, Tarjeta, TablaScroll,
} from '../components/ui'

interface PantallaUso {
  screen: string
  module: string
  vistas: number
}
interface InteraccionUso {
  interaction_id: string
  veces: number
}
interface ResumenUsoPersona {
  usuario_id: string
  nombre: string
  ingresos: number
  ingresos_fallidos: number
  ultimo_ingreso: string | null
  pantallas: PantallaUso[]
  acciones_total: number
  /** Opcionales mientras el backend despliega. */
  formularios?: number
  tiempo_total_ms?: number
  interacciones_top: InteraccionUso[]
}

const DIAS_POR_DEFECTO = 90

function formatearDuracion(ms: number | undefined): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return '—'
  const minutos = Math.round(ms / 60_000)
  if (minutos < 1) return '< 1 min'
  if (minutos < 60) return `${minutos} min`
  return `${Math.floor(minutos / 60)} h ${minutos % 60} min`
}

function aFecha(fecha: Date): string {
  return fecha.toISOString().slice(0, 10)
}

function rangoInicial() {
  const hasta = new Date()
  const desde = new Date()
  desde.setDate(desde.getDate() - DIAS_POR_DEFECTO)
  return { desde: aFecha(desde), hasta: aFecha(hasta) }
}

function formatearIngreso(valor: string | null): string {
  if (!valor) return 'Sin ingresos'
  const fecha = new Date(valor)
  return Number.isNaN(fecha.getTime()) ? 'Sin ingresos' : fecha.toLocaleString('es-CO')
}

export default function UsoPersonas() {
  const [inicial] = useState(rangoInicial)
  const [desde, setDesde] = useState(inicial.desde)
  const [hasta, setHasta] = useState(inicial.hasta)
  const [consulta, setConsulta] = useState(inicial)
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())

  const parametros = new URLSearchParams({ desde: consulta.desde, hasta: consulta.hasta })
  const { datos, cargando, error } = useLista<ResumenUsoPersona>(`/auditoria/resumen-uso?${parametros.toString()}`)

  const rangoInvalido = !desde || !hasta || desde > hasta
  const totalIngresos = datos.reduce((suma, p) => suma + p.ingresos, 0)
  const totalFallidos = datos.reduce((suma, p) => suma + p.ingresos_fallidos, 0)
  const totalTiempo = datos.reduce((suma, p) => suma + (p.tiempo_total_ms ?? 0), 0)

  function alternar(id: string) {
    setAbiertos((previo) => {
      const siguiente = new Set(previo)
      if (siguiente.has(id)) siguiente.delete(id)
      else siguiente.add(id)
      return siguiente
    })
  }

  return (
    <div className="space-y-4">
      <EncabezadoPagina
        icono={<Icono nombre="personas" />}
        titulo="Uso por personas"
        descripcion="Ingresos, pantallas visitadas y acciones registradas por persona (auditoría interna)."
      />

      <BarraFiltros>
        <Campo
          data-analytics-id="uso.desde"
          etiqueta="Desde"
          type="date"
          value={desde}
          max={hasta || undefined}
          onChange={(e) => setDesde(e.target.value)}
        />
        <Campo
          data-analytics-id="uso.hasta"
          etiqueta="Hasta"
          type="date"
          value={hasta}
          min={desde || undefined}
          onChange={(e) => setHasta(e.target.value)}
        />
        <Boton
          data-analytics-id="uso.consultar"
          disabled={rangoInvalido}
          onClick={() => setConsulta({ desde, hasta })}
        >
          Consultar
        </Boton>
      </BarraFiltros>

      <p className="text-sm text-slate-500">
        Periodo consultado: {consulta.desde} a {consulta.hasta} (por defecto, los últimos {DIAS_POR_DEFECTO} días).
      </p>

      {rangoInvalido && <Aviso tono="alerta">La fecha inicial debe ser anterior o igual a la final.</Aviso>}
      {error && <Aviso tono="error">{error}</Aviso>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi rotulo="Personas con registro" valor={datos.length} />
        <Kpi rotulo="Ingresos" valor={totalIngresos} />
        <Kpi rotulo="Ingresos fallidos" valor={totalFallidos} />
        <Kpi rotulo="Tiempo total de uso" valor={formatearDuracion(totalTiempo)} />
      </div>

      <Tarjeta>
        {cargando ? (
          <p className="p-6 text-sm text-slate-500" role="status">Cargando uso…</p>
        ) : datos.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No hay registros de uso en el periodo seleccionado.</p>
        ) : (
          <TablaScroll>
            <table className="tabla">
              <thead>
                <tr>
                  <th>Persona</th>
                  <th className="text-right">Ingresos</th>
                  <th className="text-right">Fallidos</th>
                  <th>Último ingreso</th>
                  <th className="text-right">Acciones</th>
                  <th className="text-right">Formularios</th>
                  <th className="text-right">Tiempo total</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {datos.map((persona) => {
                  const abierto = abiertos.has(persona.usuario_id)
                  return (
                    <Fragment key={persona.usuario_id}>
                      <tr>
                        <td className="font-medium text-slate-900">{persona.nombre}</td>
                        <td className="text-right tabular-nums">{persona.ingresos}</td>
                        <td className="text-right tabular-nums">
                          {persona.ingresos_fallidos > 0 ? (
                            <Chip tono="alerta">{`${persona.ingresos_fallidos} fallidos`}</Chip>
                          ) : (
                            0
                          )}
                        </td>
                        <td>{formatearIngreso(persona.ultimo_ingreso)}</td>
                        <td className="text-right tabular-nums">{persona.acciones_total}</td>
                        <td className="text-right tabular-nums">{persona.formularios ?? 0}</td>
                        <td className="text-right tabular-nums">{formatearDuracion(persona.tiempo_total_ms)}</td>
                        <td>
                          <Boton
                            data-analytics-id="uso.detalle"
                            variante="fantasma"
                            tamano="sm"
                            aria-expanded={abierto}
                            onClick={() => alternar(persona.usuario_id)}
                          >
                            {abierto ? 'Ocultar' : 'Ver detalle'}
                          </Boton>
                        </td>
                      </tr>
                      {abierto && (
                        <tr>
                          <td colSpan={8} className="bg-slate-50">
                            <div className="grid gap-4 p-3 md:grid-cols-2">
                              <div>
                                <p className="mb-1 text-2xs font-bold uppercase tracking-wider text-slate-500">
                                  Pantallas más visitadas
                                </p>
                                {persona.pantallas.length === 0 ? (
                                  <p className="text-sm text-slate-500">Sin vistas registradas.</p>
                                ) : (
                                  <ul className="space-y-1 text-sm">
                                    {[...persona.pantallas].sort((a, b) => b.vistas - a.vistas).map((p) => (
                                      <li key={`${p.module}/${p.screen}`} className="flex justify-between gap-3">
                                        <span className="min-w-0 truncate">
                                          {p.screen} <span className="text-slate-400">({p.module})</span>
                                        </span>
                                        <span className="tabular-nums">{p.vistas}</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                              <div>
                                <p className="mb-1 text-2xs font-bold uppercase tracking-wider text-slate-500">
                                  Interacciones principales
                                </p>
                                {persona.interacciones_top.length === 0 ? (
                                  <p className="text-sm text-slate-500">Sin interacciones registradas.</p>
                                ) : (
                                  <ul className="space-y-1 text-sm">
                                    {persona.interacciones_top.map((i) => (
                                      <li key={i.interaction_id} className="flex justify-between gap-3">
                                        <span className="min-w-0 truncate" title={i.interaction_id}>{i.interaction_id}</span>
                                        <span className="tabular-nums">{i.veces}</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </TablaScroll>
        )}
      </Tarjeta>
    </div>
  )
}
