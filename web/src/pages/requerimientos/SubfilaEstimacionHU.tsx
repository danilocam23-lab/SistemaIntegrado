import { Chip, TablaScroll } from '../../components/ui'
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
              <TablaScroll plano>
                <table className="tabla text-xs">
                  <thead>
                    <tr>
                      <th className="text-left">Historia de Usuario</th>
                      <th className="text-left">Épica/Feature</th>
                      <th className="text-center">Tareas</th>
                      <th className="text-right">Hrs Est.</th>
                      <th className="text-right">Total+10%</th>
                      <th className="text-center">IDs Creados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grupos.map((g) => (
                      <tr key={g.key}>
                        <td className="font-medium text-slate-800">
                          <div className="flex items-center gap-1.5">
                            <span className="text-cyan-500">▸</span>
                            {g.historia_usuario}
                            {g.createdHU && <Chip tono="marca">HU #{g.createdHU}</Chip>}
                          </div>
                        </td>
                        <td className="text-slate-600">{g.epica_feature}</td>
                        <td className="text-center">
                          <span className="inline-flex items-center justify-center rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                            {g.filas.length}
                          </span>
                        </td>
                        <td className="text-right font-semibold text-slate-800">{formatNumber(g.totalHorasEstimadas)}</td>
                        <td className="text-right font-bold text-emerald-600">{formatNumber(g.totalHorasFinales)}</td>
                        <td className="text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            {g.createdTasks.length > 0 && <Chip tono="exito">{g.createdTasks.length} HITSS</Chip>}
                            {g.createdTasksEpm.length > 0 && <Chip tono="marca">{g.createdTasksEpm.length} EPM</Chip>}
                            {g.createdTasks.length === 0 && g.createdTasksEpm.length === 0 && !g.createdHU && (
                              <span className="text-slate-400">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-white/80 font-bold">
                      <td className="text-slate-700">Total</td>
                      <td></td>
                      <td className="text-center text-slate-700">
                        {estCargada?.filas.length ?? 0}
                      </td>
                      <td className="text-right text-slate-900">
                        {formatNumber(grupos.reduce((s, g) => s + g.totalHorasEstimadas, 0))}
                      </td>
                      <td className="text-right text-emerald-700">
                        {formatNumber(grupos.reduce((s, g) => s + g.totalHorasFinales, 0))}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </TablaScroll>
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
