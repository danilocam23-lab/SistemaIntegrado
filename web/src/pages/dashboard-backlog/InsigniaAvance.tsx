// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Chip } from '../../components/ui'
import type { NivelAvance } from './tipos'
import { nivelDeAvance } from './utilidades'

const COLOR_BARRA: Record<NivelAvance, string> = {
  exito: 'bg-green-500',
  alerta: 'bg-amber-500',
  error: 'bg-red-500',
}

/**
 * Chip de porcentaje con mini-barra de refuerzo. Umbrales: >=75 éxito,
 * >=50 alerta, <50 error. Sin datos (`null`) muestra un chip neutro.
 */
export default function InsigniaAvance({ porcentaje }: { porcentaje: number | null }) {
  if (porcentaje === null) {
    return (
      <div className="flex items-center justify-center">
        <Chip tono="neutro" title="Sin registros de ANS en el periodo">Sin datos</Chip>
      </div>
    )
  }

  const tono = nivelDeAvance(porcentaje)

  return (
    <div className="mx-auto flex w-24 flex-col items-center gap-1.5">
      <Chip tono={tono}>{porcentaje}%</Chip>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuenow={porcentaje}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`h-full rounded-full ${COLOR_BARRA[tono]}`} style={{ width: `${Math.min(porcentaje, 100)}%` }} />
      </div>
    </div>
  )
}
