// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { cx } from '../../components/ui'
import { CLASE_BARRA_NIVEL, ETIQUETA_NIVEL, formatearPct, nivelCarga } from './carga'

const ESCALA_MAXIMA = 120

interface Props {
  /** % en requerimientos activos. */
  activa: number
  /** % en asignaciones sin requerimiento (cuenta en la carga). */
  sinReq?: number
  /** % en requerimientos no activos (solo informativo; no cuenta en la carga). */
  otros?: number
  tamano?: 'sm' | 'md'
  /** Muestra la leyenda de segmentos bajo la barra (solo si hay más de un tipo). */
  leyenda?: boolean
  /** Nombre accesible de la persona (para el lector de pantalla). */
  etiqueta?: string
  className?: string
}

/**
 * Medidor de carga de una persona: barra con una línea en el 100% y escala hasta
 * 120%. El color sale del umbral de la carga que cuenta (activa + sin
 * requerimiento); el nivel también se dice con texto (`aria-label`), no solo con
 * color.
 */
export function MedidorCarga({
  activa,
  sinReq = 0,
  otros = 0,
  tamano = 'md',
  leyenda = false,
  etiqueta,
  className,
}: Props) {
  const total = activa + sinReq
  const nivel = nivelCarga(total)
  const ancho = (valor: number) => `${Math.min(100, (Math.max(0, valor) / ESCALA_MAXIMA) * 100)}%`
  const restoEscala = Math.max(0, ESCALA_MAXIMA - total)
  const anchoOtros = Math.min(otros, restoEscala)

  return (
    <div className={className}>
      <div className="relative">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(total)}
          aria-label={`${etiqueta ? `${etiqueta}: ` : ''}carga ${formatearPct(total)}% (${ETIQUETA_NIVEL[nivel]})`}
          className={cx(
            'flex overflow-hidden rounded-full bg-slate-200',
            tamano === 'sm' ? 'h-1.5' : 'h-2.5',
            nivel === 'sobrecarga' && 'ring-1 ring-red-600',
          )}
        >
          <div className={cx('h-full', CLASE_BARRA_NIVEL[nivel])} style={{ width: ancho(activa) }} />
          {sinReq > 0 && <div className="h-full bg-sky-400" style={{ width: ancho(sinReq) }} />}
          {anchoOtros > 0 && <div className="h-full bg-slate-400" style={{ width: ancho(anchoOtros) }} />}
        </div>
        <span
          aria-hidden="true"
          className="absolute -bottom-0.5 -top-0.5 w-0.5 rounded bg-slate-700/50"
          style={{ left: `${(100 / ESCALA_MAXIMA) * 100}%` }}
        />
      </div>
      {leyenda && (sinReq > 0 || otros > 0) && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <i className={cx('inline-block h-2 w-2 rounded-sm', CLASE_BARRA_NIVEL[nivel])} />
            Requerimientos activos {formatearPct(activa)}%
          </span>
          {sinReq > 0 && (
            <span className="inline-flex items-center gap-1">
              <i className="inline-block h-2 w-2 rounded-sm bg-sky-400" />
              Sin requerimiento {formatearPct(sinReq)}%
            </span>
          )}
          {otros > 0 && (
            <span className="inline-flex items-center gap-1">
              <i className="inline-block h-2 w-2 rounded-sm bg-slate-400" />
              Otros estados {formatearPct(otros)}% (no cuenta)
            </span>
          )}
        </div>
      )}
    </div>
  )
}
