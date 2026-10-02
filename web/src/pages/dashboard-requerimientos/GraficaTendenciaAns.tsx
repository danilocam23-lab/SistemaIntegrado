// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import type { ReactNode } from 'react'
import { CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import {
  COLOR_GRAFICA,
  ContenedorGrafica,
  ejeCategoria,
  ejePorcentaje,
  leyenda,
  rejilla,
} from '../../components/ui/graficas'
import { TrendPctTooltip } from './TrendPctTooltip'

interface Props {
  titulo: string
  icono: ReactNode
  datos: object[]
  /** dataKey de la serie "Cumple" (en %). */
  claveCumple: string
  /** dataKey de la serie "No cumple" (en %). */
  claveNoCumple: string
}

/** Tendencia mensual de cumplimiento ANS (Cumple vs No cumple, en %). */
export function GraficaTendenciaAns({ titulo, icono, datos, claveCumple, claveNoCumple }: Props) {
  return (
    <ContenedorGrafica titulo={titulo} icono={icono} alto={240} vacio={datos.length === 0}>
      <LineChart data={datos} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
        <CartesianGrid {...rejilla()} />
        <XAxis dataKey="mes" {...ejeCategoria(10)} />
        <YAxis {...ejePorcentaje(11)} />
        <Tooltip content={<TrendPctTooltip />} />
        <Line type="monotone" dataKey={claveCumple} stroke={COLOR_GRAFICA.ok} strokeWidth={2.5} name="Cumple" dot={{ r: 3 }} />
        <Line type="monotone" dataKey={claveNoCumple} stroke={COLOR_GRAFICA.malo} strokeWidth={2.5} name="No cumple" dot={{ r: 3 }} />
        <Legend {...leyenda()} />
      </LineChart>
    </ContenedorGrafica>
  )
}
