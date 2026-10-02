// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import type { Persona, PlanAccion } from '../../types'
import { ChipEstadoPlan, FechaPlan, ResponsablePlan } from './PiezasPlan'
import { esAbierto } from './tipos'
import type { PlanConVencimiento } from './useDerivadosPlanes'

const COLUMNAS = 'md:grid-cols-[minmax(230px,2.3fr)_minmax(150px,1fr)_150px_130px_110px]'

interface Props {
  filas: PlanConVencimiento[]
  personas: Map<string, Persona>
  puedeEditar: boolean
  guardando: Set<string>
  onEditar: (plan: PlanAccion) => void
  onEliminar: (plan: PlanAccion) => void
  onCambiarEstado: (plan: PlanAccion) => void
}

/** Lista de planes: filas en escritorio, tarjetas apiladas en móvil. */
export function ListaPlanes({ filas, personas, puedeEditar, guardando, onEditar, onEliminar, onCambiarEstado }: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className={`hidden gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 md:grid ${COLUMNAS}`}>
        {['Título', 'Responsable', 'Fecha límite', 'Estado', ''].map((t, i) => (
          <span key={i} className="text-2xs font-bold uppercase tracking-wider text-slate-500">{t}</span>
        ))}
      </div>
      <ul>
        {filas.map((item) => {
          const { plan, vencido } = item
          return (
            <li
              key={plan.id}
              className={`grid items-center gap-x-3 gap-y-2 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50 ${COLUMNAS} ${
                vencido ? 'shadow-[inset_3px_0_0_#dc2626]' : ''
              }`}
            >
              <div className="min-w-0">
                {puedeEditar ? (
                  <button
                    type="button"
                    onClick={() => onEditar(plan)}
                    className={`block max-w-full text-left text-sm font-semibold hover:underline ${
                      esAbierto(plan.estado) ? 'text-slate-900' : 'text-slate-500'
                    }`}
                  >
                    {plan.titulo}
                  </button>
                ) : (
                  <span className={`block text-sm font-semibold ${esAbierto(plan.estado) ? 'text-slate-900' : 'text-slate-500'}`}>
                    {plan.titulo}
                  </span>
                )}
                <span className="block truncate text-xs text-slate-500" title={plan.descripcion ?? undefined}>
                  {plan.descripcion || 'Sin descripción'}
                </span>
              </div>
              <div className="min-w-0"><ResponsablePlan id={plan.responsable_id} personas={personas} /></div>
              <div><FechaPlan item={item} /></div>
              <div>
                <ChipEstadoPlan
                  plan={plan}
                  puedeEditar={puedeEditar}
                  ocupado={guardando.has(plan.id)}
                  onCambiar={onCambiarEstado}
                />
              </div>
              <div className="flex justify-end gap-3 whitespace-nowrap">
                {puedeEditar && (
                  <>
                    <button type="button" onClick={() => onEditar(plan)} className="enlace-accion">Editar</button>
                    <button
                      type="button"
                      onClick={() => onEliminar(plan)}
                      className="enlace-accion enlace-accion-peligro"
                    >
                      Eliminar
                    </button>
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
