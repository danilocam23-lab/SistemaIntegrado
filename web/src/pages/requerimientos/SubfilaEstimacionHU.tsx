import type { Estimacion } from '../../types'
import { agruparPorHU, formatNumber } from './utilidades'

interface SubfilaEstimacionHUProps {
  reqId: string
  /** `expandedReqs.has(id)` — vive en el shell (`useEstimaciones`), hasta la fase 9. */
  isExpanded: boolean
  estCargada: Estimacion | undefined
  isLoading: boolean
  /** INVARIANTE 12: se inyecta desde `useCamposRequerimientos` (vía `TablaRequerimientos`);
   *  no se recalcula aquí. */
  totalColumnasTabla: number
}

/** Sub-fila con las Historias de Usuario agrupadas de la estimación de un
 *  requerimiento, más la fila vacía cuando no hay datos de estimación cargados.
 *  Ambas condicionales a `expandedReqs.has(id)`. */
export function SubfilaEstimacionHU({ reqId, isExpanded, estCargada, isLoading, totalColumnasTabla }: SubfilaEstimacionHUProps) {
  const grupos = estCargada ? agruparPorHU(estCargada.filas) : []

  return (
    <>
      {/* Filas detalle: Historias de Usuario agrupadas */}
      {isExpanded && grupos.length > 0 && (
        <tr key={`${reqId}-hu`}>
          <td colSpan={totalColumnasTabla} className="p-0">
            <div className="border-l-4 border-cyan-400 bg-slate-50 px-4 py-2">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500">
                    <th className="px-3 py-1.5 text-left font-semibold">Historia de Usuario</th>
                    <th className="px-3 py-1.5 text-left font-semibold">Épica/Feature</th>
                    <th className="px-3 py-1.5 text-center font-semibold">Tareas</th>
                    <th className="px-3 py-1.5 text-right font-semibold">Hrs Est.</th>
                    <th className="px-3 py-1.5 text-right font-semibold">Total+10%</th>
                    <th className="px-3 py-1.5 text-center font-semibold">IDs Creados</th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.map((g) => (
                    <tr key={g.key} className="border-t border-slate-200 hover:bg-white/60">
                      <td className="px-3 py-2 font-medium text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <span className="text-cyan-500">▸</span>
                          {g.historia_usuario}
                          {g.createdHU && (
                            <span className="rounded bg-cyan-100 px-1 py-0.5 text-[9px] font-mono text-cyan-700">
                              HU #{g.createdHU}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{g.epica_feature}</td>
                      <td className="px-3 py-2 text-center">
                        <span className="inline-flex items-center justify-center rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                          {g.filas.length}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800">{formatNumber(g.totalHorasEstimadas)}</td>
                      <td className="px-3 py-2 text-right font-bold text-emerald-600">{formatNumber(g.totalHorasFinales)}</td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {g.createdTasks.length > 0 && (
                            <span className="rounded bg-emerald-100 px-1 py-0.5 text-[9px] font-mono text-emerald-700">
                              {g.createdTasks.length} HITSS
                            </span>
                          )}
                          {g.createdTasksEpm.length > 0 && (
                            <span className="rounded bg-purple-100 px-1 py-0.5 text-[9px] font-mono text-purple-700">
                              {g.createdTasksEpm.length} EPM
                            </span>
                          )}
                          {g.createdTasks.length === 0 && g.createdTasksEpm.length === 0 && !g.createdHU && (
                            <span className="text-slate-400">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-white/80">
                    <td className="px-3 py-2 font-bold text-slate-700">Total</td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2 text-center font-bold text-slate-700">
                      {estCargada?.filas.length ?? 0}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-slate-900">
                      {formatNumber(grupos.reduce((s, g) => s + g.totalHorasEstimadas, 0))}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-emerald-700">
                      {formatNumber(grupos.reduce((s, g) => s + g.totalHorasFinales, 0))}
                    </td>
                    <td className="px-3 py-2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </td>
        </tr>
      )}
      {isExpanded && !estCargada && !isLoading && (
        <tr key={`${reqId}-empty`}>
          <td colSpan={totalColumnasTabla} className="border-l-4 border-slate-300 bg-slate-50 px-6 py-3 text-center text-xs text-slate-400">
            Sin datos de estimación para este requerimiento.
          </td>
        </tr>
      )}
    </>
  )
}
