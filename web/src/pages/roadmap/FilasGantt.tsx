// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Chip, cx } from '../../components/ui'
import { AvatarPersona } from '../asignaciones/AvatarPersona'
import { MedidorCarga } from '../asignaciones/MedidorCarga'
import { formatearPct } from '../asignaciones/carga'
import { CapaTiempo } from './CapaTiempo'
import { geometriaBarra } from './derivados'
import { fechaCorta } from './fechas'
import { HitosEntrega } from './HitosEntrega'
import type { GrupoCategoria, GrupoRoadmap, RangoRoadmap, ReqRoadmap } from './tipos'

export const COLUMNAS_GANTT = 'grid grid-cols-[232px_minmax(0,1fr)_124px]'

interface PropsCapa {
  rango: RangoRoadmap
  hoyPct: number | null
}

interface PropsPersona extends PropsCapa {
  grupo: GrupoRoadmap
  abierto: boolean
  cargaDisponible: boolean
  onAlternar: () => void
}

/** Fila de persona (o «Sin asignar» / «Todos»): botón accesible que contrae sus requerimientos. */
export function FilaPersona({ grupo, abierto, cargaDisponible, onAlternar, rango, hoyPct }: PropsPersona) {
  const mostrarCarga = !grupo.sinAsignar && !grupo.plano && !grupo.inactiva
  return (
    <div className={cx(COLUMNAS_GANTT, 'min-h-[46px] border-b border-slate-100 bg-white')}>
      <div className="flex min-w-0 items-center px-2.5 py-1">
        <button
          type="button"
          onClick={onAlternar}
          aria-expanded={abierto}
          aria-label={`${abierto ? 'Contraer' : 'Expandir'} ${grupo.nombre}`}
          className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-600"
        >
          <span aria-hidden="true" className={cx('w-2.5 text-[10px] text-slate-400 transition-transform', abierto && 'rotate-90')}>▸</span>
          <span className={cx(grupo.inactiva && 'opacity-50 grayscale')}><AvatarPersona nombre={grupo.sinAsignar ? '?' : grupo.nombre} /></span>
          <span className="min-w-0">
            <b className={cx('block truncate text-[12.5px] text-slate-900', grupo.inactiva && 'italic text-slate-500')}>{grupo.nombre}</b>
            <small className="block truncate text-[10px] text-slate-500">{grupo.rol}</small>
          </span>
        </button>
      </div>
      <div className="relative border-l border-slate-100">
        <CapaTiempo rango={rango} hoyPct={hoyPct} />
        <div className="absolute inset-0 flex items-center gap-3 px-3 text-[11px] text-slate-500">
          <span className="shrink-0 tabular-nums">
            <b className="text-slate-800">{grupo.totalReqs}</b> proy · <b className="text-slate-800">{grupo.totalEntregas}</b> entregas
          </span>
          {mostrarCarga && grupo.carga !== null && (
            <>
              <MedidorCarga activa={grupo.carga} tamano="sm" etiqueta={grupo.nombre} className="w-[110px] shrink-0" />
              <b className="tabular-nums text-slate-800">{formatearPct(grupo.carga)} %</b>
              {grupo.carga > 100 && <Chip tono="error">sobrecarga</Chip>}
            </>
          )}
          {mostrarCarga && grupo.carga === null && !cargaDisponible && <span>carga N/D</span>}
        </div>
      </div>
      <div className="border-l border-slate-100" />
    </div>
  )
}

/** Fila de categoría con su color y el % que la persona tiene asignado en ella. */
export function FilaCategoria({ categoria, mostrarPorcentaje, rango, hoyPct }: PropsCapa & {
  categoria: GrupoCategoria
  mostrarPorcentaje: boolean
}) {
  return (
    <div className={cx(COLUMNAS_GANTT, 'min-h-[32px] border-b border-slate-100 bg-white')}>
      <div className="flex min-w-0 items-center gap-2 py-1 pl-[30px] pr-2.5 text-[11.5px] font-bold text-slate-900">
        <i aria-hidden="true" className="h-[9px] w-[9px] shrink-0 rounded-full" style={{ backgroundColor: categoria.color }} />
        <span className="truncate">{categoria.nombre}</span>
        {mostrarPorcentaje && categoria.porcentaje > 0 && (
          <span className="rounded-full bg-slate-100 px-1.5 text-[9.5px] font-bold text-slate-600">
            {formatearPct(categoria.porcentaje)} %
          </span>
        )}
      </div>
      <div className="relative border-l border-slate-100"><CapaTiempo rango={rango} hoyPct={hoyPct} /></div>
      <div className="border-l border-slate-100" />
    </div>
  )
}

/** Fila de requerimiento: barra (botón) con hitos ◆ y fechas de inicio y fin. */
export function FilaRequerimiento({ r, inactiva, seleccionado, onSeleccionar, rango, hoyPct }: PropsCapa & {
  r: ReqRoadmap
  inactiva: boolean
  seleccionado: boolean
  onSeleccionar: (id: string) => void
}) {
  const { izquierda, ancho } = geometriaBarra(r, rango)
  const etiqueta = `${r.req.codigo_req} – ${r.req.nombre ?? ''}`
  return (
    <div className={cx(COLUMNAS_GANTT, 'min-h-[36px] border-b border-slate-100 bg-white')}>
      <div className="flex min-w-0 items-center gap-2 py-1 pl-11 pr-2.5">
        <span className="whitespace-nowrap font-mono text-[11px] font-bold text-marca-700">{r.req.codigo_req}</span>
        <span className="min-w-0 flex-1 truncate text-[11px] text-slate-500" title={r.req.nombre ?? ''}>{r.req.nombre}</span>
        {r.vencido && <Chip tono="error">vencido</Chip>}
      </div>
      <div className="relative border-l border-slate-100">
        <CapaTiempo rango={rango} hoyPct={hoyPct} />
        <button
          type="button"
          onClick={() => onSeleccionar(r.req.id)}
          aria-label={`${etiqueta}, del ${fechaCorta(r.inicio)} al ${fechaCorta(r.fin)}${r.vencido ? ', vencido' : ''}. Abrir detalle`}
          aria-haspopup="dialog"
          title={`${etiqueta}\n${fechaCorta(r.inicio)} → ${fechaCorta(r.fin)}`}
          className={cx(
            'absolute top-[9px] z-[2] flex h-[18px] items-center overflow-hidden whitespace-nowrap rounded-full px-2.5 text-left text-[9.5px] font-bold text-white shadow-sm hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900',
            r.vencido && 'ring-2 ring-red-600',
            inactiva && 'opacity-55',
            seleccionado && 'outline outline-2 outline-offset-2 outline-slate-900',
          )}
          style={{ left: `${izquierda}%`, width: `${ancho}%`, minWidth: 12, backgroundColor: r.color }}
        >
          <span className="truncate">{etiqueta}</span>
        </button>
        <HitosEntrega hitos={r.hitos} rango={rango} />
      </div>
      <div className="flex flex-col justify-center gap-0.5 border-l border-slate-100 px-2.5 py-1 text-[10.5px] tabular-nums text-slate-500">
        <span>Ini <b className="font-semibold text-slate-900">{fechaCorta(r.inicio)}</b></span>
        <span>Fin <b className="font-semibold text-slate-900">{fechaCorta(r.fin)}</b></span>
      </div>
    </div>
  )
}
