import { Fragment } from 'react'
import { Chip, Icono, TablaScroll } from '../../components/ui'
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
        <table className="tabla min-w-[1100px]">
          <thead>
            <tr>
              <th className="w-8"></th>
              <th className="text-left">Historia de Usuario</th>
              <th className="text-left">Épica/Feature</th>
              <th className="text-center">Tareas</th>
              <th className="text-right">Hrs Est.</th>
              <th className="text-right">Total+10%</th>
              <th className="text-center">IDs Creados</th>
            </tr>
          </thead>
          <tbody>
            {grupos.map((grupo) => {
              const isOpen = expandedHUs.has(grupo.key)
              return (
                <Fragment key={grupo.key}>{/* Fila maestra (HU) */}
                  <tr
                    onClick={() => toggleHU(grupo.key)}
                    className="cursor-pointer bg-white hover:bg-cyan-50/50 transition-colors"
                  >
                    <td className="text-center">
                      <Icono nombre="chevron-derecha" className={`mx-auto h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{grupo.historia_usuario}</span>
                        {grupo.createdHU && <Chip tono="marca">HU #{grupo.createdHU}</Chip>}
                      </div>
                    </td>
                    <td className="text-slate-600">{grupo.epica_feature}</td>
                    <td className="text-center">
                      <span className="inline-flex items-center justify-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                        {grupo.filas.length}
                      </span>
                    </td>
                    <td className="text-right font-semibold text-slate-900">{formatNumber(grupo.totalHorasEstimadas)}</td>
                    <td className="text-right font-bold text-emerald-600">{formatNumber(grupo.totalHorasFinales)}</td>
                    <td className="text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        {grupo.createdTasks.length > 0 && <Chip tono="exito">{grupo.createdTasks.length} tasks HITSS</Chip>}
                        {grupo.createdTasksEpm.length > 0 && <Chip tono="marca">{grupo.createdTasksEpm.length} tasks EPM</Chip>}
                        {grupo.createdTasks.length === 0 && grupo.createdTasksEpm.length === 0 && !grupo.createdHU && (
                          <span className="text-[10px] text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Filas detalle (tareas) */}
                  {isOpen && grupo.filas.map((fila, idx) => (
                    <tr key={`${grupo.key}-${fila.numero ?? idx}`} className="bg-slate-50/60">
                      <td></td>
                      <td colSpan={2}>
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
                      <td className="text-center text-slate-500 text-xs">—</td>
                      <td className="text-right text-slate-700">{formatNumber(fila.horas_estimadas)}</td>
                      <td className="text-right text-emerald-600">{formatNumber(fila.horas_totales || fila.metodologia_10)}</td>
                      <td className="text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {fila.created_task_hitss ? (
                            <Chip tono="exito" title={`Tarea HITSS #${fila.created_task_hitss}`}>
                              #{fila.created_task_hitss}
                            </Chip>
                          ) : null}
                          {fila.created_task_epm ? (
                            <Chip tono="marca" title={`Tarea EPM #${fila.created_task_epm}`}>
                              #{fila.created_task_epm}
                            </Chip>
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
