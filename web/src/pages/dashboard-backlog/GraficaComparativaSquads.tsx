// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Bar, BarChart, CartesianGrid, LabelList, Legend, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts'
import {
  COLOR_GRAFICA,
  ContenedorGrafica,
  PALETA_SERIES,
  TooltipGrafica,
  ejeCategoria,
  ejePorcentaje,
  etiquetaBarra,
  leyenda,
  rejilla,
} from '../../components/ui/graficas'
import type { FilaSquadAnalisis } from './tipos'

interface PuntoComparativa {
  squad: string
  acta: number | null
  entrega: number | null
}

/** Comparativa lado a lado de ANS Acta % y ANS Entrega % por squad. */
export default function GraficaComparativaSquads({ filas }: { filas: FilaSquadAnalisis[] }) {
  const datos: PuntoComparativa[] = filas
    .filter((fila) => fila.porcentajeActa !== null || fila.porcentajeEntrega !== null)
    .map((fila) => ({ squad: fila.squad, acta: fila.porcentajeActa, entrega: fila.porcentajeEntrega }))

  return (
    <ContenedorGrafica
      titulo="Comparativa entre squads"
      descripcion="Cumplimiento ANS Acta y ANS Entrega (%) · la línea marca el umbral de 75%"
      alto={360}
      vacio={datos.length === 0}
    >
      <BarChart data={datos} margin={{ left: 0, right: 20, top: 50, bottom: 30 }}>
        <CartesianGrid {...rejilla()} />
        <XAxis
          dataKey="squad"
          angle={-20}
          textAnchor="end"
          height={60}
          interval={0}
          {...ejeCategoria(11)}
        />
        <YAxis {...ejePorcentaje(11)} />
        <ReferenceLine y={75} stroke={COLOR_GRAFICA.alerta} strokeDasharray="4 4" />
        <Tooltip content={<TooltipGrafica sufijo="%" />} />
        <Legend verticalAlign="top" height={36} {...leyenda()} />
        <Bar dataKey="acta" name="ANS Acta" fill={PALETA_SERIES[0]} radius={[8, 8, 0, 0]} barSize={18}>
          <LabelList
            dataKey="acta"
            formatter={(valor: unknown) => (valor == null ? '' : `${Number(valor)}%`)}
            {...etiquetaBarra('top', 11)}
          />
        </Bar>
        <Bar dataKey="entrega" name="ANS Entrega" fill={PALETA_SERIES[1]} radius={[8, 8, 0, 0]} barSize={18}>
          <LabelList
            dataKey="entrega"
            formatter={(valor: unknown) => (valor == null ? '' : `${Number(valor)}%`)}
            {...etiquetaBarra('top', 11)}
          />
        </Bar>
      </BarChart>
    </ContenedorGrafica>
  )
}
