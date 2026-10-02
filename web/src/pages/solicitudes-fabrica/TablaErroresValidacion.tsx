// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { TablaScroll } from '../../components/ui'
import type { ErrorValidacion } from './tiposSolicitudes'

/** Tabla de errores de validación (fila, líder, motivo) de una carga de Excel. */
export function TablaErroresValidacion({ errores }: { errores: ErrorValidacion[] }) {
  return (
    <TablaScroll className="max-h-56 overflow-y-auto">
      <table className="tabla">
        <thead>
          <tr>
            <th>Fila</th>
            <th>Líder</th>
            <th>Motivo</th>
          </tr>
        </thead>
        <tbody>
          {errores.map((e, i) => (
            <tr key={`${e.fila}-${i}`}>
              <td>{e.fila}</td>
              <td>{e.lider ?? '—'}</td>
              <td className="text-red-700">{e.motivo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TablaScroll>
  )
}
