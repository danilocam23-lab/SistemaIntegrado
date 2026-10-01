// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Tooltip, XAxis, YAxis } from 'recharts'
import {
  ContenedorGrafica,
  TooltipGrafica,
  ejeCategoria,
  ejeValor,
  etiquetaBarra,
  rejilla,
} from '../../components/ui/graficas'
import { fmtNumero } from './constantes'
import type { FilaEstado, Metrica } from './tipos'

interface Props {
  titulo: string
  descripcion: string
  /** Nombre de la serie en cantidad ("Requerimientos", "Entregas"). */
  nombreSerie: string
  filas: FilaEstado[]
  metrica: Metrica
}

/** Barras horizontales por estado (mismo estilo para requerimientos y entregas). */
export default function GraficaBarrasEstado({ titulo, descripcion, nombreSerie, filas, metrica }: Props) {
  const datos = useMemo(() => {
    const base = filas.map((fila) => ({ ...fila, valor: metrica === 'horas' ? fila.horas : fila.cantidad }))
    return metrica === 'horas' ? [...base].sort((a, b) => b.horas - a.horas) : base
  }, [filas, metrica])

  return (
    <ContenedorGrafica
      titulo={titulo}
      descripcion={descripcion}
      alto={320}
      vacio={datos.length === 0}
    >
      <BarChart data={datos} layout="vertical" margin={{ left: 140, right: 60, top: 20, bottom: 20 }}>
        <CartesianGrid {...rejilla('vertical')} />
        <XAxis type="number" {...ejeValor(12)} />
        <YAxis type="category" dataKey="estado" width={130} {...ejeCategoria(12)} />
        <Tooltip content={<TooltipGrafica sufijo={metrica === 'horas' ? 'h' : undefined} />} />
        <Bar
          dataKey="valor"
          name={metrica === 'horas' ? 'Horas' : nombreSerie}
          radius={[0, 12, 12, 0]}
          barSize={28}
        >
          <LabelList
            dataKey="valor"
            formatter={(valor: unknown) => fmtNumero(Number(valor ?? 0))}
            {...etiquetaBarra('right', 12)}
          />
          {datos.map((fila) => (
            <Cell key={`estado-${fila.estado}`} fill={fila.color} />
          ))}
        </Bar>
      </BarChart>
    </ContenedorGrafica>
  )
}
