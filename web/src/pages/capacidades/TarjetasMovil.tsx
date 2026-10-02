// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Chip, cx, Icono } from '../../components/ui'
import { AvatarPersona } from '../asignaciones/AvatarPersona'
import { MedidorCarga } from '../asignaciones/MedidorCarga'
import { formatearPct } from '../asignaciones/carga'
import { CLASE_TONO, ETIQUETA_TONO, formatearHoras, textoCelda } from './base'
import { MESES_ABREV, MESES_LARGO } from './tipos'
import type { FilaCapacidad } from './tipos'

interface Props {
  filas: FilaCapacidad[]
  modo: 'horas' | 'pct'
  editable: boolean
  modoConsolidado: boolean
  nombreAplicacion: (persona: FilaCapacidad['persona']) => string
  indiceMesActual: number
  /** Tocar un mes abre el panel (hoja inferior). */
  onAbrirMes: (fila: FilaCapacidad, indice: number) => void
}

/**
 * Móvil (menos de 768 px): una tarjeta por persona con los 12 meses en una
 * cuadrícula de 4 columnas. Tocar un mes abre el panel como hoja inferior.
 */
export function TarjetasMovil({
  filas, modo, editable, modoConsolidado, nombreAplicacion, indiceMesActual, onAbrirMes,
}: Props) {
  if (filas.length === 0) {
    return <p className="tarjeta tarjeta-pad text-center text-sm text-slate-500">Ninguna persona coincide con los filtros.</p>
  }
  return (
    <ul className="grid gap-3">
      {filas.map((fila) => {
        const puedeTocar = editable && !fila.inactiva
        return (
          <li key={fila.persona.id} className="tarjeta tarjeta-pad">
            <div className="flex items-start gap-2">
              <AvatarPersona nombre={fila.persona.nombre} />
              <div className="min-w-0 flex-1">
                <p className={cx('truncate text-sm font-semibold', fila.inactiva ? 'text-slate-400' : 'text-slate-800')}>
                  {fila.persona.nombre}
                </p>
                <p className="truncate text-[11px] text-slate-500">
                  {fila.persona.rol_operativo}
                  {fila.persona.squads?.length > 0 && ` · ${fila.persona.squads.join(', ')}`}
                </p>
              </div>
              {fila.inactiva && <Chip>Inactiva</Chip>}
              {modoConsolidado && <Chip tono="marca">{nombreAplicacion(fila.persona) || '—'}</Chip>}
              {fila.sobrecarga && (
                <Chip tono="error"><Icono nombre="alerta" /> Sobrecarga</Chip>
              )}
            </div>
            {fila.carga && (
              <div className="mt-2">
                <div className="flex justify-between text-[11px] font-semibold text-slate-700">
                  <span>Carga hoy {formatearPct(fila.carga.pct)} %</span>
                  <span className="font-normal text-slate-500">Total año {formatearHoras(fila.total)} h</span>
                </div>
                <MedidorCarga activa={fila.carga.pct} tamano="sm" etiqueta={fila.persona.nombre} className="mt-1" />
              </div>
            )}
            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {fila.celdas.map((celda, i) => {
                const valor = celda.horas ?? celda.base
                const descripcion = `${fila.persona.nombre}, ${MESES_LARGO[i]}: ${formatearHoras(valor)} h, ${ETIQUETA_TONO[celda.tono]}`
                const clases = cx(
                  'rounded-md px-1 py-1.5 text-center text-xs font-semibold tabular-nums',
                  CLASE_TONO[celda.tono],
                  i === indiceMesActual && 'outline outline-2 outline-marca',
                )
                const contenido = (
                  <>
                    <small className="block text-[9px] font-bold uppercase opacity-70">{MESES_ABREV[i]}</small>
                    {textoCelda(valor, celda.base, modo)}{celda.horas === null ? '*' : ''}
                  </>
                )
                return puedeTocar ? (
                  <button key={celda.mes} type="button" className={clases} aria-label={descripcion}
                    onClick={() => onAbrirMes(fila, i)}>
                    {contenido}
                  </button>
                ) : (
                  <span key={celda.mes} className={clases} aria-label={descripcion}>{contenido}</span>
                )
              })}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
