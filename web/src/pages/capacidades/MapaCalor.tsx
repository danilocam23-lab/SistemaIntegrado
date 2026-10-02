// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Chip, cx, Icono, TablaScroll } from '../../components/ui'
import { AvatarPersona } from '../asignaciones/AvatarPersona'
import { MedidorCarga } from '../asignaciones/MedidorCarga'
import { formatearPct } from '../asignaciones/carga'
import { formatearHoras } from './base'
import { CeldaCapacidadVista } from './CeldaCapacidad'
import { MESES_ABREV } from './tipos'
import type { FilaCapacidad, TotalMes } from './tipos'

export interface MesColumna {
  mes: string
  indice: number
  base: number
  diasHabiles: number
}

export interface EdicionCelda {
  personaId: string
  mes: string
}

interface Props {
  filas: FilaCapacidad[]
  meses: MesColumna[]
  totalesMes: TotalMes[]
  totalAnio: number
  modo: 'horas' | 'pct'
  /** Hay permiso y no es modo consolidado. */
  puedeEditar: boolean
  modoConsolidado: boolean
  nombreAplicacion: (persona: FilaCapacidad['persona']) => string
  /** Índice del mes en curso si el año visible es el actual; `-1` si no. */
  indiceMesActual: number
  edicion: EdicionCelda | null
  seleccion: EdicionCelda | null
  alActivarCelda: (fila: FilaCapacidad, indice: number, conMayus: boolean) => void
  alGuardarCelda: (fila: FilaCapacidad, indice: number, horas: number) => Promise<string | null>
  alCerrarEdicion: () => void
  alEliminarCelda: (fila: FilaCapacidad, indice: number) => void
}

/**
 * Mapa de calor persona × mes: cada celda se pinta contra la base sugerida del
 * mes, con totales por mes y por persona y la carga vigente de Asignaciones.
 * La primera columna es fija (sticky) para no perder el nombre al desplazarse.
 */
export function MapaCalor({
  filas, meses, totalesMes, totalAnio, modo, puedeEditar, modoConsolidado, nombreAplicacion,
  indiceMesActual, edicion, seleccion, alActivarCelda, alGuardarCelda, alCerrarEdicion, alEliminarCelda,
}: Props) {
  const totalColumnas = 15 + (modoConsolidado ? 1 : 0) // persona, [squad], 12 meses, total, carga
  return (
    <TablaScroll>
      <table className="tabla">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 min-w-[11rem] bg-slate-50">Persona</th>
            {modoConsolidado && <th>Squad</th>}
            {MESES_ABREV.map((abrev, i) => (
              <th
                key={abrev}
                className={cx('!px-1.5 text-center', i === indiceMesActual && '!bg-marca-50 !text-marca-700')}
                aria-current={i === indiceMesActual ? 'date' : undefined}
              >
                {abrev}{i === indiceMesActual && <span className="block text-[9px] font-bold normal-case">hoy</span>}
              </th>
            ))}
            <th className="text-right">Total</th>
            <th className="min-w-[9rem]">Carga hoy</th>
          </tr>
          <tr>
            <td className="sticky left-0 z-10 bg-slate-100 text-[11px] font-semibold text-slate-500">
              Base sugerida · días hábiles
            </td>
            {modoConsolidado && <td className="bg-slate-100" />}
            {meses.map((m) => (
              <td key={m.mes} className="!px-1.5 bg-slate-100 text-center text-[10px] font-semibold text-slate-500">
                {m.base} h
                <span className="block font-normal">{m.diasHabiles} d</span>
              </td>
            ))}
            <td className="bg-slate-100" />
            <td className="bg-slate-100" />
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => {
            const editable = puedeEditar && !fila.inactiva
            const capH = fila.capacidadMesActual
            const asignadas = fila.carga ? Math.round((capH * fila.carga.pct) / 100) : 0
            return (
              <tr key={fila.persona.id} className={cx(fila.inactiva && 'text-slate-400')}>
                <td className="sticky left-0 z-10 bg-white">
                  <div className="flex items-center gap-2">
                    <AvatarPersona nombre={fila.persona.nombre} pequeno />
                    <div className="min-w-0">
                      <p className={cx('truncate text-sm font-semibold', fila.inactiva ? 'text-slate-400' : 'text-slate-800')}>
                        {fila.persona.nombre}
                        {fila.inactiva && <span className="ml-1.5 align-middle"><Chip>Inactiva</Chip></span>}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {fila.persona.rol_operativo}
                        {fila.persona.squads?.length > 0 && ` · ${fila.persona.squads.join(', ')}`}
                      </p>
                    </div>
                  </div>
                </td>
                {modoConsolidado && (
                  <td><Chip tono="marca">{nombreAplicacion(fila.persona) || '—'}</Chip></td>
                )}
                {fila.celdas.map((celda, i) => (
                  <td key={celda.mes} className="!px-1 text-center">
                    <CeldaCapacidadVista
                      celda={celda}
                      nombrePersona={fila.persona.nombre}
                      modo={modo}
                      editable={editable}
                      seleccionada={seleccion?.personaId === fila.persona.id && seleccion.mes === celda.mes}
                      editando={edicion?.personaId === fila.persona.id && edicion.mes === celda.mes}
                      onActivar={(conMayus) => alActivarCelda(fila, i, conMayus)}
                      onGuardar={(horas) => alGuardarCelda(fila, i, horas)}
                      onCerrarEdicion={alCerrarEdicion}
                      onEliminar={() => alEliminarCelda(fila, i)}
                    />
                  </td>
                ))}
                <td className="whitespace-nowrap text-right font-bold tabular-nums text-slate-800">
                  {formatearHoras(fila.total)}
                </td>
                <td>
                  {fila.carga === null ? (
                    <span className="text-xs text-slate-400">No disponible</span>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-700">
                        <span>{formatearPct(fila.carga.pct)} %</span>
                        <span className="font-normal text-slate-500">{asignadas} de {formatearHoras(capH)} h</span>
                      </div>
                      <MedidorCarga activa={fila.carga.pct} tamano="sm" etiqueta={fila.persona.nombre} className="mt-1" />
                      {fila.sobrecarga && (
                        <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-red-700">
                          <Icono nombre="alerta" /> Sobrecarga
                        </p>
                      )}
                      {fila.subutilizada && (
                        <p className="mt-1 text-[10px] font-semibold text-amber-700">Subutilizada</p>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
          {filas.length === 0 && (
            <tr>
              <td colSpan={totalColumnas} className="p-6 text-center text-slate-500">
                Ninguna persona coincide con los filtros.
              </td>
            </tr>
          )}
        </tbody>
        {filas.length > 0 && (
          <tfoot>
            <tr className="bg-slate-50 font-bold">
              <td className="sticky left-0 z-10 bg-slate-50 text-xs">Total del equipo (h)</td>
              {modoConsolidado && <td />}
              {totalesMes.map((t, i) => (
                <td key={meses[i].mes} className="!px-1 text-center text-xs tabular-nums">{formatearHoras(t.horas)}</td>
              ))}
              <td className="text-right text-xs tabular-nums">{formatearHoras(totalAnio)}</td>
              <td />
            </tr>
            <tr className="bg-slate-50">
              <td className="sticky left-0 z-10 bg-slate-50 text-[11px] text-slate-500">Personas con registro</td>
              {modoConsolidado && <td />}
              {totalesMes.map((t, i) => (
                <td key={meses[i].mes} className="!px-1 text-center text-[11px] tabular-nums text-slate-500">
                  {t.conRegistro}/{t.personas}
                </td>
              ))}
              <td />
              <td />
            </tr>
          </tfoot>
        )}
      </table>
    </TablaScroll>
  )
}
