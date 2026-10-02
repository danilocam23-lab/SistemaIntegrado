// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Chip } from '../../components/ui'
import type { Persona, PlanAccion } from '../../types'
import { formatearFecha, textoVencimiento } from './fechas'
import { ESTADO_LABEL, ESTADO_TONO, esAbierto, iniciales, infoResponsable, siguienteEstado } from './tipos'
import type { PlanConVencimiento } from './useDerivadosPlanes'

/** Responsable con avatar de iniciales. Inactivo o con otro rol se sigue mostrando por su nombre. */
export function ResponsablePlan({ id, personas }: { id: string | null; personas: Map<string, Persona> }) {
  const info = infoResponsable(id, personas)
  if (!info) return <span className="text-xs italic text-slate-400">Sin responsable</span>
  return (
    <span className="flex min-w-0 items-center gap-2 text-sm text-slate-800">
      <span
        aria-hidden="true"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-marca-50 text-2xs font-bold text-marca-700"
      >
        {info.desconocido ? '?' : iniciales(info.nombre)}
      </span>
      <span className="min-w-0">
        <span className="block truncate">
          {info.nombre}
          {info.inactivo && <span className="text-slate-500"> (inactivo)</span>}
        </span>
        {info.rol && <span className="block text-2xs text-slate-400">{info.rol}</span>}
      </span>
    </span>
  )
}

/** Fecha límite y vencimiento dicho con palabras (no solo con color). */
export function FechaPlan({ item }: { item: PlanConVencimiento }) {
  const { plan, dias, vencido, proximo } = item
  const relativo = esAbierto(plan.estado) ? textoVencimiento(dias) : ''
  const tono = vencido ? 'text-red-700' : proximo ? 'text-amber-700' : 'text-slate-500'
  return (
    <span className="block text-xs tabular-nums">
      <span className={vencido ? 'block font-semibold text-red-700' : 'block font-medium text-slate-800'}>
        {formatearFecha(plan.fecha_limite)}
      </span>
      {relativo && (
        <span className={tono}>
          {vencido && <span aria-hidden="true">⚠ </span>}
          {relativo}
        </span>
      )}
    </span>
  )
}

interface PropsChip {
  plan: PlanAccion
  puedeEditar: boolean
  ocupado: boolean
  onCambiar: (plan: PlanAccion) => void
}

/** Chip de estado; con permiso es el control para pasar al estado siguiente en un clic. */
export function ChipEstadoPlan({ plan, puedeEditar, ocupado, onCambiar }: PropsChip) {
  const chip = (
    <Chip tono={ESTADO_TONO[plan.estado] ?? 'neutro'}>
      {ESTADO_LABEL[plan.estado] ?? plan.estado}
      {puedeEditar && <span aria-hidden="true" className="ml-1 text-2xs opacity-70">▾</span>}
    </Chip>
  )
  if (!puedeEditar) return chip
  const siguiente = ESTADO_LABEL[siguienteEstado(plan.estado)]
  return (
    <button
      type="button"
      disabled={ocupado}
      onClick={() => onCambiar(plan)}
      title={`Cambiar a ${siguiente}`}
      aria-label={`Estado: ${ESTADO_LABEL[plan.estado] ?? plan.estado}. Cambiar a ${siguiente}`}
      className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-600 disabled:opacity-50"
    >
      {chip}
    </button>
  )
}
