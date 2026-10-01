// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import {
  COLOR_GRAFICA,
  ContenedorGrafica,
  TooltipGrafica,
  ejeCategoria,
  ejeValor,
  rejilla,
} from '../../components/ui/graficas'

/** Evolución mensual de requerimientos por fecha de solicitud del acta. */
export default function GraficaEvolucion({ datos }: { datos: Array<{ mes: string; cantidad: number }> }) {
  return (
    <ContenedorGrafica
      titulo="Evolución Mensual"
      descripcion="Tendencia de requerimientos en el tiempo"
      alto={320}
      vacio={datos.length === 0}
    >
      <LineChart data={datos} margin={{ left: 0, right: 16, top: 8, bottom: 4 }}>
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
  )
}
