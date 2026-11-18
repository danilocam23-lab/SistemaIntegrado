// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, LabelList, Tooltip, XAxis, YAxis } from 'recharts'
import { useLista } from '../api/hooks'
import type { Persona, Requerimiento } from '../types'
import {
  Aviso, BarraFiltros, Boton, EncabezadoPagina, Icono, Selector, TablaScroll, Tarjeta,
} from '../components/ui'
import {
  COLOR_GRAFICA, ContenedorGrafica, TooltipGrafica, ejeCategoria, ejeValor, etiquetaBarra, rejilla,
} from '../components/ui/graficas'
import { NOTA_ATRIBUCION_EPM } from './dashboard-requerimientos/calculoAns'
import {
  anoInicialAnalistas, anosAnalistas, opcionesAnalistas, prepararRegistrosAnalistas, resumirAnalistas,
} from './dashboard-requerimientos/calculoAnalistas'
import type { FilaAnalista } from './dashboard-requerimientos/calculoAnalistas'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

type MetricaAnalista = Exclude<keyof FilaAnalista, 'id' | 'nombre'>

function EtiquetaAnalista({
  x, y, payload, nombres,
}: {
  x?: number | string
  y?: number | string
  payload?: { value?: string }
  nombres: Map<string, string>
}) {
  const nombre = nombres.get(payload?.value ?? '') ?? ''
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fontSize={11} fill={COLOR_GRAFICA.eje}>
      <title>{nombre}</title>
      {nombre.length > 19 ? `${nombre.slice(0, 18)}…` : nombre}
    </text>
  )
}

function GraficaIncumplimientos({
  titulo, filas, metrica, periodo,
}: {
  titulo: string
  filas: FilaAnalista[]
  metrica: MetricaAnalista
  periodo: string
}) {
  const datos = filas.filter(fila => fila[metrica] > 0)
    .map(fila => ({ id: fila.id, nombre: fila.nombre, cantidad: fila[metrica] }))
    .sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre, 'es'))
  const nombres = new Map(datos.map(fila => [fila.id, fila.nombre]))
  const total = datos.reduce((suma, fila) => suma + fila.cantidad, 0)
  return (
    <section className="min-w-0" aria-label={`${titulo}: ${total} incumplimientos · ${periodo}`}>
      <div className="max-h-[560px] overflow-y-auto">
        <ContenedorGrafica
          titulo={titulo}
          descripcion={`${periodo} · ${total} incumplimientos`}
          alto={Math.max(220, datos.length * 38 + 36)}
          vacio={datos.length === 0}
        >
          <BarChart data={datos} layout="vertical" margin={{ top: 8, right: 36, bottom: 8, left: 0 }}>
            <CartesianGrid {...rejilla('vertical')} />
            <XAxis type="number" domain={[0, 'auto']} {...ejeValor()} />
            <YAxis
              type="category" dataKey="id" width={132} interval={0}
              {...ejeCategoria()}
              tick={<EtiquetaAnalista nombres={nombres} />}
            />
            <Tooltip
              content={<TooltipGrafica sufijo=" incumplimientos" />}
              labelFormatter={valor => nombres.get(String(valor)) ?? 'Analista no disponible'}
            />
            <Bar
              dataKey="cantidad" name="Incumplimientos" fill={COLOR_GRAFICA.malo}
              radius={[0, 6, 6, 0]} barSize={20} isAnimationActive={false}
            >
              <LabelList dataKey="cantidad" {...etiquetaBarra('right', 11)} />
            </Bar>
          </BarChart>
        </ContenedorGrafica>
      </div>
    </section>
  )
}

export default function DashboardAnalistas() {
  const requerimientos = useLista<Requerimiento>('/requerimientos')
  const personas = useLista<Persona>('/personas')
  const [anoElegido, setAnoElegido] = useState('')
  const [mes, setMes] = useState('')
  const [analista, setAnalista] = useState('')
  const registros = useMemo(() => prepararRegistrosAnalistas(requerimientos.datos), [requerimientos.datos])
  const anos = useMemo(() => anosAnalistas(registros), [registros])
  const opciones = useMemo(
    () => opcionesAnalistas(requerimientos.datos, personas.datos),
    [requerimientos.datos, personas.datos],
  )
  const actual = String(new Date().getFullYear())
  const ano = anoElegido || anoInicialAnalistas(anos, actual)
  const resumen = useMemo(
    () => resumirAnalistas(registros, opciones, { ano, mes, analista }),
    [registros, opciones, ano, mes, analista],
  )
  const periodo = mes ? `${MESES[Number(mes) - 1]} de ${ano}` : `Todos los meses de ${ano}`
  const cargando = requerimientos.cargando || personas.cargando
  const hayError = !!(requerimientos.error || personas.error)
  const totalReal = resumen.filas.reduce((suma, fila) => suma + fila.requerimientosReal + fila.entregasReal, 0)

  function recargar() {
    requerimientos.recargar()
    personas.recargar()
  }

  return (
    <div className="min-w-0">
      <EncabezadoPagina
        titulo="Analista de requerimientos"
        icono={<Icono nombre="personas" />}
        descripcion="Incumplimientos ANS de requerimientos y entregas por analista"
        acciones={(
          <Boton data-analytics-id="dashboard_analistas.recargar" onClick={recargar} disabled={cargando}>
            Actualizar
          </Boton>
        )}
      />
      <div className="pagina space-y-5">
        {cargando ? (
          <div role="status"><Aviso>Cargando requerimientos y personas…</Aviso></div>
        ) : hayError ? (
          <div role="alert">
            <Aviso tono="error">
              {requerimientos.error && <p>Requerimientos: {requerimientos.error}.</p>}
              {personas.error && <p>Personas: {personas.error}.</p>}
              <p>No se muestran conteos parciales. Usa «Actualizar» para reintentar.</p>
            </Aviso>
          </div>
        ) : (
          <>
            <BarraFiltros titulo="Periodo y analista">
              <Selector
                etiqueta="Año" value={ano} data-analytics-id="dashboard_analistas.ano"
                onChange={evento => setAnoElegido(evento.target.value)}
              >
                {Array.from(new Set([ano, ...anos])).sort().reverse().map(valor => (
                  <option key={valor} value={valor}>{valor}</option>
                ))}
              </Selector>
              <Selector
                etiqueta="Mes" value={mes} data-analytics-id="dashboard_analistas.mes"
                onChange={evento => setMes(evento.target.value)}
              >
                <option value="">Todos los meses</option>
                {MESES.map((nombre, indice) => (
                  <option key={nombre} value={String(indice + 1).padStart(2, '0')}>{nombre}</option>
                ))}
              </Selector>
              <Selector
                etiqueta="Analista" value={analista} data-analytics-id="dashboard_analistas.analista"
                onChange={evento => setAnalista(evento.target.value)}
              >
                <option value="">Todos los analistas</option>
                {analista && !opciones.some(opcion => opcion.id === analista) && (
                  <option value={analista}>Analista fuera de los datos actuales</option>
                )}
                {opciones.map(opcion => (
                  <option key={opcion.id} value={opcion.id}>{opcion.nombre}</option>
                ))}
              </Selector>
            </BarraFiltros>
            <Aviso>
              <p><strong>{periodo}.</strong> Año inicial: actual si tiene datos; en caso contrario, último disponible.</p>
              <p>Requerimientos: ANS acta y fecha de solicitud de acta, uno por requerimiento.
                Entregas: ANS entrega y fecha de recepción o, si es nula, comprometida; cada entrega cuenta por separado.</p>
              <p>Se excluyen requerimientos cancelados o reemplazados y sus entregas. No se excluyen fechas futuras.
                Solo se cuentan valores NO_CUMPLE; los ANS vacíos o inválidos no son incumplimientos.</p>
              <p><strong>HITSS:</strong> {NOTA_ATRIBUCION_EPM} Las entregas usan su propia tipificación.</p>
            </Aviso>
            {(resumen.requerimientosSinFecha > 0 || resumen.entregasSinFecha > 0) && (
              <div role="status">
                <Aviso tono="alerta">
                  Fuera de las gráficas por fecha ausente o inválida: {resumen.requerimientosSinFecha} requerimientos
                  y {resumen.entregasSinFecha} entregas con NO_CUMPLE real.
                  Este aviso abarca todos los años del analista seleccionado; no se les asigna un mes.
                </Aviso>
              </div>
            )}
            <div role="status">
              {resumen.registrosPeriodo === 0 ? (
                <Aviso>No hay registros con fecha y ANS válido para los filtros seleccionados.</Aviso>
              ) : totalReal === 0 ? (
                <Aviso tono="exito">Sin incumplimientos ANS en {periodo.toLowerCase()} para la selección.</Aviso>
              ) : (
                <Aviso tono="alerta">
                  Se encontraron {totalReal} incumplimientos reales entre requerimientos y entregas.
                  Son conteos de elementos distintos, no de requerimientos únicos combinados.
                </Aviso>
              )}
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-2">
              <GraficaIncumplimientos titulo="Requerimientos · real" filas={resumen.filas} metrica="requerimientosReal" periodo={periodo} />
              <GraficaIncumplimientos titulo="Requerimientos · HITSS" filas={resumen.filas} metrica="requerimientosHitss" periodo={periodo} />
              <GraficaIncumplimientos titulo="Entregas · real" filas={resumen.filas} metrica="entregasReal" periodo={periodo} />
              <GraficaIncumplimientos titulo="Entregas · HITSS" filas={resumen.filas} metrica="entregasHitss" periodo={periodo} />
            </div>
            {resumen.filas.length > 0 && (
              <Tarjeta>
                <details>
                  <summary className="cursor-pointer titulo-seccion">Ver nombres completos y conteos</summary>
                  <TablaScroll>
                    <table className="tabla">
                      <caption className="sr-only">Incumplimientos por analista · {periodo}</caption>
                      <thead><tr>
                        <th scope="col">Analista</th>
                        <th scope="col">Requerimientos real</th><th scope="col">Requerimientos HITSS</th>
                        <th scope="col">Entregas real</th><th scope="col">Entregas HITSS</th>
                      </tr></thead>
                      <tbody>{resumen.filas.map(fila => (
                        <tr key={fila.id}>
                          <th scope="row" className="whitespace-normal break-words">{fila.nombre}</th>
                          <td>{fila.requerimientosReal}</td><td>{fila.requerimientosHitss}</td>
                          <td>{fila.entregasReal}</td><td>{fila.entregasHitss}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </TablaScroll>
                </details>
              </Tarjeta>
            )}
          </>
        )}
      </div>
    </div>
  )
}
