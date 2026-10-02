// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Chip, TablaScroll } from '../../components/ui'
import { MedidorCarga } from '../asignaciones/MedidorCarga'
import { formatearPct } from '../asignaciones/carga'
import { formatearHoras } from './base'
import { MESES_ABREV } from './tipos'
import type { FilaEquipo } from './tipos'

interface Props {
  equipos: FilaEquipo[]
  /** Base sugerida de cada mes (para el modo "% de la base"). */
  basePorMes: number[]
  modo: 'horas' | 'pct'
  indiceMesActual: number
}

/**
 * Vista por equipo: suma de las horas registradas de las personas de cada squad.
 * Una persona en varios squads cuenta en cada uno (igual que el Dashboard Backlog).
 */
export function TablaEquipos({ equipos, basePorMes, modo, indiceMesActual }: Props) {
  return (
    <div>
      <TablaScroll>
        <table className="tabla">
          <thead>
            <tr>
              <th>Equipo</th>
              <th className="text-center">Personas</th>
              {MESES_ABREV.map((abrev, i) => (
                <th key={abrev} className={`!px-1.5 text-center ${i === indiceMesActual ? '!bg-marca-50 !text-marca-700' : ''}`}>
                  {abrev}
                </th>
              ))}
              <th className="text-right">Total</th>
              <th className="min-w-[9rem]">Carga prom.</th>
            </tr>
          </thead>
          <tbody>
            {equipos.map((equipo) => (
              <tr key={equipo.equipo}>
                <td>
                  <p className="text-sm font-semibold text-slate-800">{equipo.equipo}</p>
                  <p className="max-w-[16rem] truncate text-[11px] text-slate-500">
                    {equipo.personas.map((f) => f.persona.nombre.split(' ')[0]).join(', ')}
                  </p>
                </td>
                <td className="text-center"><Chip>{equipo.personas.length}</Chip></td>
                {equipo.porMes.map((total, i) => {
                  const base = basePorMes[i] * total.personas
                  return (
                    <td
                      key={MESES_ABREV[i]}
                      className="!px-1.5 text-center text-xs tabular-nums"
                      title={`${total.conRegistro} de ${total.personas} personas con registro`}
                    >
                      {total.conRegistro === 0
                        ? <span className="text-slate-300">—</span>
                        : modo === 'pct' && base > 0
                          ? `${Math.round((total.horas / base) * 100)}%`
                          : formatearHoras(total.horas)}
                    </td>
                  )
                })}
                <td className="text-right font-bold tabular-nums text-slate-800">{formatearHoras(equipo.total)}</td>
                <td>
                  {equipo.cargaPromedio === null ? (
                    <span className="text-xs text-slate-400">N/D</span>
                  ) : (
                    <div>
                      <p className="text-[11px] font-semibold text-slate-700">{formatearPct(equipo.cargaPromedio)} %</p>
                      <MedidorCarga activa={equipo.cargaPromedio} tamano="sm" etiqueta={equipo.equipo} className="mt-1" />
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {equipos.length === 0 && (
              <tr>
                <td colSpan={16} className="p-6 text-center text-slate-500">Ninguna persona coincide con los filtros.</td>
              </tr>
            )}
          </tbody>
        </table>
      </TablaScroll>
      <p className="mt-2 text-xs text-slate-500">
        Suma de las horas registradas de las personas de cada squad; una persona en varios squads cuenta en cada uno
        (igual que hoy en el Dashboard Backlog). Pasa el cursor sobre un mes para ver cuántas personas tienen registro.
      </p>
    </div>
  )
}
