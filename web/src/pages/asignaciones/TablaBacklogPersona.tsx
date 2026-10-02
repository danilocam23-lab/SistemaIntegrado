// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Chip, TablaScroll } from '../../components/ui'
import type { BacklogFuturo } from '../../types'

const ESTADO_BACKLOG_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROGRESO: 'En progreso',
  COMPLETADO: 'Completado',
  CANCELADO: 'Cancelado',
}

const ESTADO_BACKLOG_TONO: Record<string, 'neutro' | 'marca' | 'exito' | 'alerta' | 'error'> = {
  PENDIENTE: 'alerta',
  EN_PROGRESO: 'marca',
  COMPLETADO: 'exito',
  CANCELADO: 'neutro',
}

/**
 * Backlog futuro informativo de una persona (6 columnas, no editable), en un
 * bloque plegable. Se separa del bloque de asignaciones para dejar claro que no
 * es carga real editable.
 */
export function TablaBacklogPersona({ backlogFuturo }: { backlogFuturo: BacklogFuturo[] }) {
  if (backlogFuturo.length === 0) return null
  return (
    <details open className="border-t bg-red-50/70 px-3 py-2">
      <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wide text-red-700">
        Backlog futuro informativo ({backlogFuturo.length}) · no es carga real editable
      </summary>
      <div className="mt-1">
        <TablaScroll plano>
          <table className="tabla">
            <thead>
              <tr>
                <th className="text-left">Iniciativa</th>
                <th className="text-left">Contexto</th>
                <th className="text-left">Tipo de demanda</th>
                <th className="text-left">Estado</th>
                <th className="text-center">F. tentativa de inicio</th>
                <th className="text-right">Horas aprox.</th>
              </tr>
            </thead>
            <tbody>
              {backlogFuturo.map((item) => (
                <tr key={item.id} className="bg-red-50 text-red-700">
                  <td className="font-medium">{item.nombre_iniciativa}</td>
                  <td>
                    <Chip tono="error" className="px-2 py-0.5 text-[10px]">Backlog futuro</Chip>
                  </td>
                  <td>{item.tipo_demanda || '—'}</td>
                  <td>
                    <Chip tono={ESTADO_BACKLOG_TONO[item.estado] ?? 'neutro'} className="px-2 py-0.5 text-[10px]">
                      {ESTADO_BACKLOG_LABEL[item.estado] ?? item.estado}
                    </Chip>
                  </td>
                  <td className="text-center">{item.fecha_tentativa_inicio || '—'}</td>
                  <td className="text-right font-mono">{(item.horas_aproximadas ?? 0).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TablaScroll>
      </div>
    </details>
  )
}
