import Modal from '../../components/Modal'
import { Boton, Icono } from '../../components/ui'
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

/** Modal de estimación de un requerimiento: cabecera con acciones (crear tareas
 *  HITSS/EPM, reemplazar, eliminar) y el cuerpo con el resumen, los 3 acordeones y el
 *  detalle por HU. Ningún hook de datos vive aquí (regla de oro del ADR 0005): todo el
 *  estado llega por props desde `useModalEstimacion` (shell). El shell solo la monta
 *  cuando hay `estModalReqId`, así que aquí `abierto` es siempre `true`. */
export function ModalEstimacion({
  reqSeleccionado, estModalReqId, estData, estLoading, creatingTasks,
  expandedSections, expandedHUs, puedeGestionarEstimaciones,
  onClose, onCreateTasks, onReemplazar, onEliminar, onToggleSection, onToggleHU,
}: ModalEstimacionProps) {
  const estimacion = estData?.estimacion ?? null
  const summary = estData?.summary

  return (
    <Modal
      abierto
      onCerrar={onClose}
      ancho="completo"
      claseCuerpo="bg-slate-50"
      icono={<Icono nombre="estimacion" />}
      titulo={`Estimación — ${reqSeleccionado?.codigo_req ?? estModalReqId} — ${reqSeleccionado?.nombre ?? 'Sin nombre'}`}
      subtitulo={`${estimacion?.archivo ?? 'Sin archivo'} · Subido ${formatDateTime(estimacion?.subido_en ?? estimacion?.fecha_estimacion)}`}
      acciones={
        puedeGestionarEstimaciones ? (
          <>
            <Boton
              variante="secundario"
              onClick={() => onCreateTasks('hitss')}
              disabled={!estData?.estimacion || creatingTasks !== null}
              title="Crear tareas en Azure DevOps HITSS"
              icono={
                creatingTasks === 'hitss'
                  ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" />
                  : <Icono nombre="nube" className="h-3.5 w-3.5" />
              }
            >
              Crear tareas HITSS
            </Boton>
            <Boton
              variante="secundario"
              onClick={() => onCreateTasks('epm')}
              disabled={!estData?.estimacion || creatingTasks !== null}
              title="Crear tareas en Azure DevOps EPM"
              icono={
                creatingTasks === 'epm'
                  ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-purple-200 border-t-purple-600" />
                  : <Icono nombre="edificio" className="h-3.5 w-3.5" />
              }
            >
              Crear tareas EPM
            </Boton>
            <div className="mx-1 h-5 w-px bg-slate-200" />
            <Boton variante="secundario" onClick={onReemplazar}>
              Reemplazar
            </Boton>
            <Boton variante="peligro" onClick={onEliminar} disabled={!estimacion}>
              Eliminar
            </Boton>
          </>
        ) : undefined
      }
    >
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
    </Modal>
  )
}
