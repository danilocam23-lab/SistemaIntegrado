import type { EstimacionConResumen, Requerimiento } from '../../types'
import type { ClaveSeccionResumen } from './tipos'
import { formatDateTime, formatNumber } from './utilidades'
import { ResumenEstimacion } from './ResumenEstimacion'
import { SeccionResumenColapsable } from './SeccionResumenColapsable'
import { TablaDetalleHU } from './TablaDetalleHU'

interface ModalEstimacionProps {
  estModalReqId: string
  reqSeleccionado: Requerimiento | null
  estData: EstimacionConResumen | null
  estLoading: boolean
  creatingTasks: 'hitss' | 'epm' | null
  expandedSections: Record<ClaveSeccionResumen, boolean>
  expandedHUs: Set<string>
  puedeGestionarEstimaciones: boolean
  onClose: () => void
  onCreateTasks: (org: 'hitss' | 'epm') => void
  onReemplazar: () => void
  onEliminar: () => void
  onToggleSection: (key: ClaveSeccionResumen) => void
  onToggleHU: (key: string) => void
}

/** Modal de estimación de un requerimiento: overlay, cabecera con acciones (crear tareas
 *  HITSS/EPM, reemplazar, eliminar) y el cuerpo con el resumen, los 3 acordeones y el
 *  detalle por HU. Ningún hook de datos vive aquí (regla de oro del ADR 0005): todo el
 *  estado llega por props desde `useModalEstimacion` (shell). */
export function ModalEstimacion({
  estModalReqId, reqSeleccionado, estData, estLoading, creatingTasks,
  expandedSections, expandedHUs, puedeGestionarEstimaciones,
  onClose, onCreateTasks, onReemplazar, onEliminar, onToggleSection, onToggleHU,
}: ModalEstimacionProps) {
  const estimacion = estData?.estimacion ?? null
  const summary = estData?.summary

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-cyan-50 p-2 text-cyan-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h2 className="titulo-seccion truncate">
                  Estimación — {reqSeleccionado?.codigo_req ?? estModalReqId} — {reqSeleccionado?.nombre ?? 'Sin nombre'}
                </h2>
                <p className="truncate text-sm text-slate-600">
                  {estimacion?.archivo ?? 'Sin archivo'} · Subido {formatDateTime(estimacion?.subido_en ?? estimacion?.fecha_estimacion)}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {puedeGestionarEstimaciones && (
              <>
                <button
                  onClick={() => onCreateTasks('hitss')}
                  disabled={!estData?.estimacion || creatingTasks !== null}
                  title="Crear tareas en Azure DevOps HITSS"
                  className="btn btn-secundario items-center gap-1"
                >
                  {creatingTasks === 'hitss' ? (
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                    </svg>
                  )}
                  Crear tareas HITSS
                </button>
                <button
                  onClick={() => onCreateTasks('epm')}
                  disabled={!estData?.estimacion || creatingTasks !== null}
                  title="Crear tareas en Azure DevOps EPM"
                  className="btn btn-secundario items-center gap-1"
                >
                  {creatingTasks === 'epm' ? (
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-purple-200 border-t-purple-600" />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  )}
                  Crear tareas EPM
                </button>
                <div className="mx-1 h-5 w-px bg-slate-200" />
                <button onClick={onReemplazar} className="btn btn-secundario">
                  Reemplazar
                </button>
                <button onClick={onEliminar} disabled={!estimacion} className="btn btn-peligro">
                  Eliminar
                </button>
              </>
            )}
            <button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800" title="Cerrar">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
          {estLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-100 border-t-cyan-600" />
            </div>
          ) : !estData?.exists || !estimacion ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
              No hay una estimación disponible para este requerimiento.
            </div>
          ) : (
            <div className="space-y-6">
              <ResumenEstimacion estimacion={estimacion} />

              <div className="space-y-4">
                <SeccionResumenColapsable
                  titulo="Resumen por Tipo de Tarea"
                  subtitulo="Agrupado por tipo de actividad"
                  encabezadoClave="Tipo"
                  entradas={Object.entries(summary?.byType ?? {})}
                  abierta={expandedSections.type}
                  onToggle={() => onToggleSection('type')}
                  columnas={[
                    { encabezado: 'Tareas', render: (v) => formatNumber(v.count) },
                    { encabezado: 'Hrs Est.', render: (v) => formatNumber(v.estimated) },
                    { encabezado: 'Mejor', render: (v) => formatNumber(v.best) },
                    { encabezado: 'Peor', render: (v) => formatNumber(v.worst) },
                    { encabezado: 'Promedio', render: (v) => formatNumber(v.average) },
                    { encabezado: 'Total+10%', render: (v) => formatNumber(v.total), className: 'font-semibold text-emerald-600' },
                  ]}
                />

                <SeccionResumenColapsable
                  titulo="Resumen por Sprint"
                  subtitulo="Distribución estimada por sprint"
                  encabezadoClave="Sprint"
                  entradas={Object.entries(summary?.bySprint ?? {})}
                  abierta={expandedSections.sprint}
                  onToggle={() => onToggleSection('sprint')}
                  columnas={[
                    { encabezado: 'Tareas', render: (v) => formatNumber(v.count) },
                    { encabezado: 'Hrs Est.', render: (v) => formatNumber(v.estimated) },
                    { encabezado: 'Mejor', render: (v) => formatNumber(v.best) },
                    { encabezado: 'Peor', render: (v) => formatNumber(v.worst) },
                    { encabezado: 'Promedio', render: (v) => formatNumber(v.average) },
                    { encabezado: 'Total+10%', render: (v) => formatNumber(v.total), className: 'font-semibold text-emerald-600' },
                  ]}
                />

                <SeccionResumenColapsable
                  titulo="Resumen por Complejidad"
                  subtitulo="Consolidado por nivel de complejidad"
                  encabezadoClave="Complejidad"
                  entradas={Object.entries(summary?.byComplexity ?? {})}
                  abierta={expandedSections.complexity}
                  onToggle={() => onToggleSection('complexity')}
                  columnas={[
                    { encabezado: 'Tareas', render: (v) => formatNumber(v.count) },
                    { encabezado: 'Hrs Est.', render: (v) => formatNumber(v.estimated) },
                    { encabezado: 'Promedio', render: (v) => formatNumber(v.average) },
                    { encabezado: 'Total+10%', render: (v) => formatNumber(v.total), className: 'font-semibold text-emerald-600' },
                  ]}
                />
              </div>

              <TablaDetalleHU estimacion={estimacion} expandedHUs={expandedHUs} toggleHU={onToggleHU} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
