// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Chip, cx } from '../../components/ui'
import { AvatarPersona } from '../asignaciones/AvatarPersona'
import { MedidorCarga } from '../asignaciones/MedidorCarga'
import { formatearPct } from '../asignaciones/carga'
import { posicionHoy } from './CapaTiempo'
import { geometriaBarra } from './derivados'
import { fechaCorta } from './fechas'
import type { GrupoRoadmap, RangoRoadmap } from './tipos'

interface Props {
  grupos: GrupoRoadmap[]
  rango: RangoRoadmap
  hoy: Date
  onSeleccionar: (id: string) => void
  cargaDisponible: boolean
}

/** Agenda móvil: por persona, una tarjeta por requerimiento con su franja de tiempo (toca para abrir el detalle). */
export function AgendaMovil({ grupos, rango, hoy, onSeleccionar, cargaDisponible }: Props) {
  const hoyPct = posicionHoy(hoy, rango)
  return (
    <div className="grid gap-4">
      {grupos.map((g) => (
        <section key={g.id} aria-label={g.nombre}>
          <div className="flex items-center gap-2">
            <span className={cx(g.inactiva && 'opacity-50 grayscale')}><AvatarPersona nombre={g.sinAsignar ? '?' : g.nombre} pequeno /></span>
            <b className={cx('min-w-0 truncate text-[12.5px]', g.inactiva && 'italic text-slate-500')}>{g.nombre}</b>
            <span className="ml-auto flex shrink-0 items-center gap-2">
              {g.carga !== null && (
                <>
                  <MedidorCarga activa={g.carga} tamano="sm" etiqueta={g.nombre} className="w-14" />
                  <Chip tono={g.carga > 100 ? 'error' : g.carga >= 90 ? 'alerta' : 'neutro'}>{formatearPct(g.carga)} %</Chip>
                </>
              )}
              {g.carga === null && !g.sinAsignar && !g.plano && !g.inactiva && !cargaDisponible && <Chip>carga N/D</Chip>}
              {g.inactiva && <Chip>inactiva</Chip>}
            </span>
          </div>
          <div className="mt-1.5 grid gap-1.5">
            {g.categorias.flatMap((c) => c.reqs).map((r) => {
              const { izquierda, ancho } = geometriaBarra(r, rango)
              return (
                <button
                  key={r.req.id}
                  type="button"
                  onClick={() => onSeleccionar(r.req.id)}
                  aria-label={`${r.req.codigo_req} ${r.req.nombre ?? ''}, del ${fechaCorta(r.inicio)} al ${fechaCorta(r.fin)}${r.vencido ? ', vencido' : ''}. Abrir detalle`}
                  className={cx(
                    'grid gap-1.5 rounded-xl border bg-white p-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-600',
                    r.vencido ? 'border-red-300' : 'border-slate-200',
                  )}
                >
                  <span className="flex items-center justify-between gap-2 text-[11.5px]">
                    <b className="font-mono text-[11px] text-marca-700">{r.req.codigo_req}</b>
                    <span className={cx('tabular-nums', r.vencido ? 'font-bold text-red-700' : 'text-slate-500')}>
                      {r.vencido ? 'vencido · ' : ''}{fechaCorta(r.inicio)} → {fechaCorta(r.fin)}
                    </span>
                  </span>
                  {r.req.nombre && <span className="truncate text-[11px] text-slate-500">{r.req.nombre}</span>}
                  <span aria-hidden="true" className="relative block h-3.5 overflow-hidden rounded-full bg-slate-100">
                    <i
                      className="absolute inset-y-0 rounded-full"
                      style={{ left: `${izquierda}%`, width: `${ancho}%`, backgroundColor: r.color }}
                    />
                    {hoyPct !== null && <i className="absolute inset-y-0 w-0.5 bg-red-600" style={{ left: `${hoyPct}%` }} />}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
