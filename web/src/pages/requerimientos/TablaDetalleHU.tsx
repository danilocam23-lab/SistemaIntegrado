import { Fragment } from 'react'
import { TablaScroll } from '../../components/ui/primitivos'
import type { Estimacion } from '../../types'
import { agruparPorHU, complexityColor, formatNumber, taskTypeColor } from './utilidades'

interface TablaDetalleHUProps {
  estimacion: Estimacion
  expandedHUs: Set<string>
  toggleHU: (key: string) => void
}

/** Detalle por Historia de Usuario del modal de estimación: fila maestra por HU y,
 *  al expandirla, una fila por tarea. */
export function TablaDetalleHU({ estimacion, expandedHUs, toggleHU }: TablaDetalleHUProps) {
  const grupos = agruparPorHU(estimacion.filas)
  return (
    <section className="tarjeta overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-4">
        <h3 className="font-semibold text-slate-900">
          Detalle por Historia de Usuario ({grupos.length} HU · {estimacion.filas.length} tareas)
        </h3>
        <p className="text-sm text-slate-600">Haz clic en una fila para expandir y ver las tareas individuales</p>
      </div>
      <TablaScroll plano>
        <table className="min-w-[1100px] text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="w-8 px-2 py-3"></th>
              <th className="px-4 py-3 text-left">Historia de Usuario</th>
              <th className="px-4 py-3 text-left">Épica/Feature</th>
              <th className="px-4 py-3 text-center">Tareas</th>
              <th className="px-4 py-3 text-right">Hrs Est.</th>
              <th className="px-4 py-3 text-right">Total+10%</th>
              <th className="px-4 py-3 text-center">IDs Creados</th>
            </tr>
          </thead>
          <tbody>
            {grupos.map((grupo) => {
              const isOpen = expandedHUs.has(grupo.key)
              return (
                <Fragment key={grupo.key}>{/* Fila maestra (HU) */}
                  <tr
                    onClick={() => toggleHU(grupo.key)}
                    className="cursor-pointer border-t border-slate-200 bg-white hover:bg-cyan-50/50 transition-colors"
                  >
                    <td className="px-2 py-3 text-center">
                      <svg xmlns="http://www.w3.org/2000/svg"
                        className={`mx-auto h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{grupo.historia_usuario}</span>
                        {grupo.createdHU && (
                          <span className="rounded bg-cyan-100 px-1.5 py-0.5 text-[10px] font-mono text-cyan-700">
                            HU #{grupo.createdHU}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{grupo.epica_feature}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                        {grupo.filas.length}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatNumber(grupo.totalHorasEstimadas)}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatNumber(grupo.totalHorasFinales)}</td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        {grupo.createdTasks.length > 0 && (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-mono text-emerald-700">
                            {grupo.createdTasks.length} tasks HITSS
                          </span>
                        )}
                        {grupo.createdTasksEpm.length > 0 && (
                          <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-mono text-purple-700">
                            {grupo.createdTasksEpm.length} tasks EPM
                          </span>
                        )}
                        {grupo.createdTasks.length === 0 && grupo.createdTasksEpm.length === 0 && !grupo.createdHU && (
                          <span className="text-[10px] text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Filas detalle (tareas) */}
                  {isOpen && grupo.filas.map((fila, idx) => (
                    <tr key={`${grupo.key}-${fila.numero ?? idx}`} className="border-t border-slate-100 bg-slate-50/60">
                      <td className="px-2 py-2"></td>
                      <td colSpan={2} className="px-4 py-2">
                        <div className="flex items-center gap-2 pl-4">
                          <span className="text-slate-400 text-xs font-mono">{fila.numero ?? idx + 1}.</span>
                          <span className="text-slate-700">{fila.actividad || '—'}</span>
                          <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: taskTypeColor(fila.tipo_tarea) }}>
                            {fila.tipo_tarea || '—'}
                          </span>
                          {fila.complejidad && (
                            <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: complexityColor(fila.complejidad) }}>
                              {fila.complejidad}
                            </span>
                          )}
                          {fila.sprint != null && (
                            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
                              Sprint {fila.sprint}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-center text-slate-500 text-xs">—</td>
                      <td className="px-4 py-2 text-right text-slate-700">{formatNumber(fila.horas_estimadas)}</td>
                      <td className="px-4 py-2 text-right text-emerald-600">{formatNumber(fila.horas_totales || fila.metodologia_10)}</td>
                      <td className="px-4 py-2 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {fila.created_task_hitss ? (
                            <span title={`Tarea HITSS #${fila.created_task_hitss}`}
                              className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-mono text-emerald-700">
                              #{fila.created_task_hitss}
                            </span>
                          ) : null}
                          {fila.created_task_epm ? (
                            <span title={`Tarea EPM #${fila.created_task_epm}`}
                              className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-mono text-purple-700">
                              #{fila.created_task_epm}
                            </span>
                          ) : null}
                          {!fila.created_task_hitss && !fila.created_task_epm ? (
                            <span className="text-[10px] text-slate-400">—</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </TablaScroll>
    </section>
  )
}
