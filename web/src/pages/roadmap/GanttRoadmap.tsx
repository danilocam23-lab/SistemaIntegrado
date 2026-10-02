// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Fragment } from 'react'
import { cx, TablaScroll } from '../../components/ui'
import { posicionHoy } from './CapaTiempo'
import { COLUMNAS_GANTT, FilaCategoria, FilaPersona, FilaRequerimiento } from './FilasGantt'
import type { GrupoRoadmap, RangoRoadmap } from './tipos'

interface Props {
  grupos: GrupoRoadmap[]
  rango: RangoRoadmap
  hoy: Date
  contraidos: Set<string>
  onAlternar: (id: string) => void
  seleccionId: string | null
  onSeleccionar: (id: string) => void
  mostrarPorcentajes: boolean
  cargaDisponible: boolean
}

/** Gantt de escritorio: cabecera de meses proporcionales, línea «hoy» y filas por persona/categoría/requerimiento. */
export function GanttRoadmap({
  grupos, rango, hoy, contraidos, onAlternar, seleccionId, onSeleccionar, mostrarPorcentajes, cargaDisponible,
}: Props) {
  const hoyPct = posicionHoy(hoy, rango)
  return (
    <TablaScroll plano className="rounded-xl border border-slate-200 bg-white">
      <div className="min-w-[880px]">
        <div className={cx(COLUMNAS_GANTT, 'border-b border-slate-200 bg-slate-50 text-[10.5px] font-bold uppercase tracking-wide text-slate-600')}>
          <div className="px-2.5 py-2">Recurso / Proyecto</div>
          <div className="relative flex border-l border-slate-200">
            {rango.columnas.map((c) => (
              <span
                key={c.indice}
                className={cx('overflow-hidden whitespace-nowrap border-r border-slate-200 py-2 text-center last:border-r-0', c.esActual && 'bg-marca-50 text-marca-700')}
                style={{ width: `${c.ancho}%` }}
              >
                {c.etiqueta}
              </span>
            ))}
            {hoyPct !== null && (
              <i
                className="absolute bottom-0 -translate-x-1/2 rounded-t bg-red-600 px-1.5 text-[9px] font-extrabold not-italic tracking-wide text-white"
                style={{ left: `${hoyPct}%` }}
              >
                HOY
              </i>
            )}
          </div>
          <div className="border-l border-slate-200 px-2.5 py-2 text-center">Inicio / Fin</div>
        </div>

        {grupos.map((g) => {
          const abierto = !contraidos.has(g.id)
          return (
            <Fragment key={g.id}>
              <FilaPersona
                grupo={g} abierto={abierto} cargaDisponible={cargaDisponible}
                onAlternar={() => onAlternar(g.id)} rango={rango} hoyPct={hoyPct}
              />
              {abierto && g.categorias.map((c) => (
                <Fragment key={c.id}>
                  <FilaCategoria categoria={c} mostrarPorcentaje={mostrarPorcentajes && !g.sinAsignar && !g.plano} rango={rango} hoyPct={hoyPct} />
                  {c.reqs.map((r) => (
                    <FilaRequerimiento
                      key={r.req.id} r={r} inactiva={g.inactiva} seleccionado={seleccionId === r.req.id}
                      onSeleccionar={onSeleccionar} rango={rango} hoyPct={hoyPct}
                    />
                  ))}
                </Fragment>
              ))}
            </Fragment>
          )
        })}
      </div>
    </TablaScroll>
  )
}
