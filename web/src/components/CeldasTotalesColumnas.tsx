// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import type { ReactNode } from 'react'

/** Una celda por columna de datos: no presupone que las métricas estén al final. */
export function CeldasTotalesColumnas({
  columnas, metricas, etiqueta, centradas = [],
}: {
  columnas: readonly { key: string }[]
  metricas: Record<string, ReactNode>
  etiqueta: string
  centradas?: readonly string[]
}) {
  const esMetrica = (clave: string) => Object.prototype.hasOwnProperty.call(metricas, clave)
  const columnaEtiqueta = columnas.find((columna) => !esMetrica(columna.key))?.key
  return (
    <>
      {columnas.map((columna, indice) => (
        <td key={columna.key} className={esMetrica(columna.key)
          ? centradas.includes(columna.key) ? 'p-2 text-center' : 'p-2 text-right'
          : 'p-2'}>
          {!columnaEtiqueta && indice === 0 && <span className="sr-only">{etiqueta}: </span>}
          {esMetrica(columna.key) ? metricas[columna.key] : columna.key === columnaEtiqueta ? etiqueta : null}
        </td>
      ))}
    </>
  )
}
