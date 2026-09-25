// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Bar, BarChart, CartesianGrid, LabelList, Legend, Tooltip, XAxis, YAxis } from 'recharts'
import { Boton } from '../../components/ui'
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
import type { FilaWoMes } from './tipos'
import { fmtNumero } from './utilidades'

interface Props {
  datos: FilaWoMes[]
  hayDetalle: boolean
  onVerDetalle: () => void
}

export default function GraficaWoPorMes({ datos, hayDetalle, onVerDetalle }: Props) {
  return (
    <ContenedorGrafica
      titulo="WO por mes"
      descripcion="Eje X: mes · Eje Y: cantidad de WO y suma de Horas_Aprobadas"
      alto={360}
      vacio={datos.length === 0}
      acciones={
        hayDetalle ? (
          <Boton onClick={onVerDetalle} variante="secundario" tamano="sm">
            Ver detalle
          </Boton>
        ) : null
      }
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
        <Tooltip content={<TooltipGrafica unidades={{ woHoras: 'h' }} />} />
        <Legend verticalAlign="top" height={36} {...leyenda()} />
        <Bar yAxisId="left" dataKey="wo" name="Cantidad WO" fill={PALETA_SERIES[0]} radius={[8, 8, 0, 0]} barSize={18}>
          <LabelList
            dataKey="wo"
            formatter={(valor: unknown) => String(Number(valor ?? 0))}
            {...etiquetaBarra('top', 11)}
          />
        </Bar>
        <Bar yAxisId="right" dataKey="woHoras" name="Horas aprobadas" fill={PALETA_SERIES[1]} radius={[8, 8, 0, 0]} barSize={18}>
          <LabelList
            dataKey="woHoras"
            formatter={(valor: unknown) => `${fmtNumero(Number(valor ?? 0))}h`}
            {...etiquetaBarra('top', 11)}
          />
        </Bar>
      </BarChart>
    </ContenedorGrafica>
  )
}
