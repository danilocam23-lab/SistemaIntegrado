// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Campo, Icono } from '../../components/ui'
import { formatearPct } from './carga'
import type { AsignacionItem } from './tipos'
import type { useEscriturasAsignaciones } from './useEscriturasAsignaciones'

interface Props {
  asig: AsignacionItem
  puedeEditar: boolean
  escrituras: ReturnType<typeof useEscriturasAsignaciones>
  /** Alinea el contenido a la derecha (celda de tabla) o al inicio (tarjeta móvil). */
  alinear?: 'derecha' | 'inicio'
}

/**
 * % de carga de una asignación con edición en línea (lápiz, Enter / blur guardan,
 * Esc cancela). El error de validación o del servidor lo muestra la fila.
 */
export function PorcentajeEditable({ asig, puedeEditar, escrituras, alinear = 'derecha' }: Props) {
  const enEdicion = escrituras.edicionInlineId === asig.id
  const justificar = alinear === 'derecha' ? 'justify-end' : 'justify-start'

  if (enEdicion) {
    return (
      <Campo
        autoFocus
        type="number"
        min="0"
        max="100"
        step="any"
        aria-label="% de carga"
        value={escrituras.edicionInlineValor}
        onChange={(e) => escrituras.setEdicionInlineValor(e.target.value)}
        onBlur={() => void escrituras.guardarEdicionInline(asig)}
        onKeyDown={escrituras.onInlineKeyDown}
        compacto
        className={alinear === 'derecha' ? 'ml-auto w-20 text-right' : 'w-20'}
      />
    )
  }

  return (
    <span className={`inline-flex items-center gap-2 ${justificar}`}>
      <span
        aria-hidden="true"
        className="h-1.5 w-11 overflow-hidden rounded-full bg-slate-200"
      >
        <span
          className="block h-full rounded-full bg-marca-600"
          style={{ width: `${Math.min(100, Math.max(0, asig.total_porcentaje))}%` }}
        />
      </span>
      <span className={`tabular-nums ${asig.total_porcentaje === 0 ? 'text-red-600' : ''}`}>
        {formatearPct(asig.total_porcentaje)}%
      </span>
      {puedeEditar && (
        <button
          type="button"
          onClick={() => escrituras.iniciarEdicionInline(asig)}
          title="Editar %"
          aria-label="Editar porcentaje de carga"
          className="text-slate-400 hover:text-marca"
        >
          <Icono nombre="lapiz" tamano={14} />
        </button>
      )}
    </span>
  )
}
