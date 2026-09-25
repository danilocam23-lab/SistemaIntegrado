// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Bar, BarChart, CartesianGrid, LabelList, Legend, Tooltip, XAxis, YAxis } from 'recharts'
import {
  ContenedorGrafica,
  PALETA_SERIES,
  TooltipGrafica,
  ejeCategoria,
  ejeValor,
  etiquetaBarra,
  leyenda,
  rejilla,
} from '../../components/ui/graficas'
import type { FilaEntregasMes } from './tipos'
import { fmtNumero } from './utilidades'

export default function GraficaEntregasPorMes({ datos }: { datos: FilaEntregasMes[] }) {
  return (
    <ContenedorGrafica
      titulo="Entregas por mes"
      descripcion="Cantidad de entregas y horas de entregas por periodo seleccionado"
      alto={360}
      vacio={datos.length === 0}
    >
      <BarChart data={datos} margin={{ left: 10, right: 30, top: 50, bottom: 30 }}>
        <CartesianGrid {...rejilla()} />
        <XAxis
          dataKey="label"
          angle={-20}
          textAnchor="end"
          height={60}
          interval={0}
          {...ejeCategoria(11)}
        />
        <YAxis yAxisId="left" {...ejeValor(11)} />
        <YAxis yAxisId="right" orientation="right" {...ejeValor(11)} />
        <Tooltip content={<TooltipGrafica unidades={{ horas: 'h' }} />} />
        <Legend verticalAlign="top" height={36} {...leyenda()} />
        <Bar yAxisId="left" dataKey="entregas" name="Entregas" fill={PALETA_SERIES[0]} radius={[8, 8, 0, 0]} barSize={16}>
          <LabelList
            dataKey="entregas"
            formatter={(valor: unknown) => String(Number(valor ?? 0))}
            {...etiquetaBarra('top', 11)}
          />
        </Bar>
        <Bar yAxisId="right" dataKey="horas" name="Horas entregas" fill={PALETA_SERIES[1]} radius={[8, 8, 0, 0]} barSize={16}>
          <LabelList
            dataKey="horas"
            formatter={(valor: unknown) => `${fmtNumero(Number(valor ?? 0))}h`}
            {...etiquetaBarra('top', 11)}
          />
        </Bar>
      </BarChart>
    </ContenedorGrafica>
  )
}
