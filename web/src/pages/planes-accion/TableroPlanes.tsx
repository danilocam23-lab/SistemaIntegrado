// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Boton, Chip } from '../../components/ui'
import type { Persona, PlanAccion } from '../../types'
import { FechaPlan, ResponsablePlan } from './PiezasPlan'
import { ESTADOS, ESTADO_LABEL, ESTADO_TONO, siguienteEstado } from './tipos'
import type { PlanConVencimiento } from './useDerivadosPlanes'

interface Props {
  filas: PlanConVencimiento[]
  personas: Map<string, Persona>
  puedeEditar: boolean
  guardando: Set<string>
  onEditar: (plan: PlanAccion) => void
  onCambiarEstado: (plan: PlanAccion) => void
}

/** Tablero con una columna por estado; "→" pasa el plan al estado siguiente. */
export function TableroPlanes({ filas, personas, puedeEditar, guardando, onEditar, onCambiarEstado }: Props) {
  return (
    <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {ESTADOS.map((estado) => {
        const columna = filas.filter((f) => f.plan.estado === estado)
        return (
          <section key={estado} aria-label={ESTADO_LABEL[estado]} className="rounded-xl bg-slate-50 p-2">
            <h3 className="mb-2 flex items-center justify-between px-1 text-xs font-bold uppercase tracking-wider text-slate-600">
              <Chip tono={ESTADO_TONO[estado]}>{ESTADO_LABEL[estado]}</Chip>
              <span className="text-slate-500">{columna.length}</span>
            </h3>
            <div className="grid gap-2">
              {columna.map((item) => {
                const { plan, vencido } = item
                return (
                  <article
                    key={plan.id}
                    className={`grid gap-1.5 rounded-xl border bg-white p-3 shadow-sm ${
                      vencido ? 'border-red-200 shadow-[inset_3px_0_0_#dc2626]' : 'border-slate-200'
                    }`}
                  >
                    {puedeEditar ? (
                      <button
                        type="button"
                        onClick={() => onEditar(plan)}
                        className="text-left text-sm font-semibold text-slate-900 hover:underline"
                      >
                        {plan.titulo}
                      </button>
                    ) : (
                      <h4 className="text-sm font-semibold text-slate-900">{plan.titulo}</h4>
                    )}
                    {plan.descripcion && <p className="text-xs leading-snug text-slate-500">{plan.descripcion}</p>}
                    <ResponsablePlan id={plan.responsable_id} personas={personas} />
                    <div className="flex items-end justify-between gap-2">
                      <FechaPlan item={item} />
                      {puedeEditar && estado !== 'CANCELADO' && (
                        <Boton
                          tamano="sm"
                          disabled={guardando.has(plan.id)}
                          onClick={() => onCambiarEstado(plan)}
                          aria-label={`Pasar «${plan.titulo}» a ${ESTADO_LABEL[siguienteEstado(estado)]}`}
                        >
                          → {ESTADO_LABEL[siguienteEstado(estado)]}
                        </Boton>
                      )}
                    </div>
                  </article>
                )
              })}
              {columna.length === 0 && <p className="px-1 py-2 text-xs text-slate-400">Sin planes</p>}
            </div>
          </section>
        )
      })}
    </div>
  )
}
