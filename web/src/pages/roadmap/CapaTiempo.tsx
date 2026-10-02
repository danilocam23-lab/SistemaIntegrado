// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { fechaEnRango, posicionPct } from './derivados'
import type { RangoRoadmap } from './tipos'

/** Posición de la línea «hoy» (0-100 %) o `null` si hoy queda fuera del rango visible. */
export function posicionHoy(hoy: Date, rango: RangoRoadmap): number | null {
  return fechaEnRango(hoy, rango) ? posicionPct(hoy, rango) : null
}

/**
 * Capa de fondo de una celda de tiempo: separadores de mes (proporcionales a los
 * días de cada mes) y la línea «hoy». Va dentro de un contenedor `relative`.
 */
export function CapaTiempo({ rango, hoyPct }: { rango: RangoRoadmap; hoyPct: number | null }) {
  let acumulado = 0
  return (
    <>
      {rango.columnas.slice(0, -1).map((c) => {
        acumulado += c.ancho
        return (
          <i
            key={c.indice}
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 border-l border-slate-100"
            style={{ left: `${acumulado}%` }}
          />
        )
      })}
      {hoyPct !== null && (
        <i
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 z-[1] w-0.5 bg-red-600/75"
          style={{ left: `${hoyPct}%` }}
        />
      )}
    </>
  )
}
