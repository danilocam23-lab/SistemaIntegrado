// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Bar, BarChart, CartesianGrid, LabelList, Tooltip, XAxis, YAxis } from 'recharts'
import { Boton } from '../../components/ui'
import {
  COLOR_GRAFICA,
  ContenedorGrafica,
  TooltipGrafica,
  ejeCategoria,
  ejeValor,
  etiquetaBarra,
  rejilla,
} from '../../components/ui/graficas'
import type { FilaCapacidadSquad } from './tipos'
import { fmtNumero } from './utilidades'

interface Props {
  datos: FilaCapacidadSquad[]
  totalPeriodos: number
  totalFestivosMes: number
  hayDetalle: boolean
  onVerDetalle: () => void
}

export default function GraficaCapacidadSquad({
  datos,
  totalPeriodos,
  totalFestivosMes,
  hayDetalle,
  onVerDetalle,
}: Props) {
  return (
    <ContenedorGrafica
      titulo="Capacidad por Squad"
      descripcion={`Distribución de horas disponibles · ${totalPeriodos} periodo(s) · Festivos: ${totalFestivosMes}`}
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
      <BarChart data={datos} layout="vertical" margin={{ left: 120, right: 60, top: 10, bottom: 10 }}>
        <CartesianGrid {...rejilla('vertical')} />
        <XAxis type="number" {...ejeValor(12)} />
        <YAxis type="category" dataKey="squad" width={120} {...ejeCategoria(12)} />
        <Tooltip content={<TooltipGrafica unidades={{ horas: 'h' }} />} />
        <Bar dataKey="horas" fill={COLOR_GRAFICA.serie} radius={[0, 12, 12, 0]} barSize={26}>
          <LabelList
            dataKey="horas"
            formatter={(valor: unknown) => `${fmtNumero(Number(valor ?? 0))}h`}
            {...etiquetaBarra('right', 12)}
          />
        </Bar>
      </BarChart>
    </ContenedorGrafica>
  )
}
