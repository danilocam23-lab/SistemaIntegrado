import type { Dispatch, SetStateAction } from 'react'
import { Fragment } from 'react'
import { TablaScroll } from '../../components/ui/primitivos'
import type { EntregasActasCampo } from '../../constantes'
import type { Estimacion, Requerimiento } from '../../types'
import type { crearRenderCelda } from './CeldaEditable'
import { FilaRequerimiento } from './FilaRequerimiento'
import { SubfilaEntregas } from './SubfilaEntregas'
import { SubfilaEstimacionHU } from './SubfilaEstimacionHU'

interface TablaRequerimientosProps {
  datosFiltrados: Requerimiento[]
  hayFiltrosActivos: boolean
  columnasActivas: Set<string>
  columnasExtra: EntregasActasCampo[]
  coreVisibleCount: number
  metricasVisibles: string[]
  /** INVARIANTE 12: calculado una vez en `useCamposRequerimientos`, se inyecta aquí y en
   *  las 3 subfilas; ninguna lo recalcula. */
  totalColumnasTabla: number
  expandedReqs: Set<string>
  estimacionIds: Set<string>
  estimacionesMap: Record<string, Estimacion>
  loadingReqEst: Set<string>
  toggleExpandReq: (reqId: string) => Promise<void>
  expandedEntregas: Set<string>
  setExpandedEntregas: Dispatch<SetStateAction<Set<string>>>
  renderCelda: ReturnType<typeof crearRenderCelda>
  squadPorId: Map<string, string>
  nombrePersona: (id: string | null) => string
  CAMPO_ACCESOR_REQ: Record<string, (r: Requerimiento) => string | number>
  uploadingId: string | null
  puedeGestionarEstimaciones: boolean
  handleUploadClick: (reqId: string) => void
  openEstimationModal: (reqId: string) => Promise<void>
  puedeEditar: boolean
  puedeEliminar: boolean
  eliminar: (req: Requerimiento) => Promise<void>
}

/** Tabla principal de requerimientos: cabecera con las 15 columnas core + columnas
 *  extra activadas desde Configuración, una fila por requerimiento (con sus sub-filas
 *  de entregas y de estimación) y el pie con los totales. */
export function TablaRequerimientos({
  datosFiltrados, hayFiltrosActivos, columnasActivas, columnasExtra, coreVisibleCount, metricasVisibles,
  totalColumnasTabla, expandedReqs, estimacionIds, estimacionesMap, loadingReqEst, toggleExpandReq,
  expandedEntregas, setExpandedEntregas, renderCelda, squadPorId, nombrePersona, CAMPO_ACCESOR_REQ,
  uploadingId, puedeGestionarEstimaciones, handleUploadClick, openEstimationModal,
  puedeEditar, puedeEliminar, eliminar,
}: TablaRequerimientosProps) {
  return (
    <TablaScroll>
      <table className="tabla">
        <thead>
          <tr>
            <th className="w-8"></th>
            {columnasActivas.has('codigoReq') && <th>Código REQ</th>}
            {columnasActivas.has('sc') && <th>SC</th>}
            {columnasActivas.has('squad') && <th>Squad</th>}
            {columnasActivas.has('nombreActa') && <th>Nombre de acta</th>}
            {columnasActivas.has('aplicacionEpm') && <th>Aplicación EPM</th>}
            {columnasActivas.has('estado') && <th>Estado</th>}
            {columnasActivas.has('ansEstimacion') && <th className="text-center">ANS Estimación</th>}
            {columnasActivas.has('ltHitss') && <th>Líder técnico</th>}
            {columnasActivas.has('scrum') && <th>Scrum</th>}
            {columnasActivas.has('horas') && <th className="text-right">Horas</th>}
            {columnasActivas.has('fechaSolicitud') && <th className="text-center">F. Solicitud</th>}
            {columnasActivas.has('fechaLimite') && <th className="text-center">F. Límite</th>}
            {columnasActivas.has('fechaReal') && <th className="text-center">F. Real</th>}
            {columnasActivas.has('diasTranscurridos') && <th className="text-right">Días transcurridos</th>}
            {columnasActivas.has('entregasCount') && <th className="text-center">Entregas</th>}
            <th className="text-center">Est.</th>
            {columnasExtra.map((c) => (
              <th key={c.key} className="whitespace-nowrap">{c.label}</th>
            ))}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {datosFiltrados.map((req) => {
            const isExpanded = expandedReqs.has(req.id)
            const hasEst = estimacionIds.has(req.id)
            const estCargada = estimacionesMap[req.id]
            return (
              <Fragment key={req.id}>{/* Fila principal del requerimiento */}
                <FilaRequerimiento
                  req={req}
                  isExpanded={isExpanded}
                  hasEst={hasEst}
                  isLoadingEstimacion={loadingReqEst.has(req.id)}
                  toggleExpandReq={toggleExpandReq}
                  columnasActivas={columnasActivas}
                  columnasExtra={columnasExtra}
                  renderCelda={renderCelda}
                  squadPorId={squadPorId}
                  nombrePersona={nombrePersona}
                  CAMPO_ACCESOR_REQ={CAMPO_ACCESOR_REQ}
                  expandedEntregas={expandedEntregas}
                  setExpandedEntregas={setExpandedEntregas}
                  uploadingId={uploadingId}
                  puedeGestionarEstimaciones={puedeGestionarEstimaciones}
                  handleUploadClick={handleUploadClick}
                  openEstimationModal={openEstimationModal}
                  puedeEditar={puedeEditar}
                  puedeEliminar={puedeEliminar}
                  eliminar={eliminar}
                />

                {/* Sub-fila: detalle de entregas */}
                <SubfilaEntregas
                  reqId={req.id}
                  entregas={req.entregas}
                  expandido={expandedEntregas.has(req.id)}
                  totalColumnasTabla={totalColumnasTabla}
                />

                {/* Sub-filas: Historias de Usuario agrupadas + vacío */}
                <SubfilaEstimacionHU
                  reqId={req.id}
                  isExpanded={isExpanded}
                  estCargada={estCargada}
                  isLoading={loadingReqEst.has(req.id)}
                  totalColumnasTabla={totalColumnasTabla}
                />
              </Fragment>
            )
          })}
          {datosFiltrados.length === 0 && (
            <tr><td colSpan={totalColumnasTabla} className="p-4 text-center text-slate-400">
              {hayFiltrosActivos ? 'Sin resultados con los filtros aplicados.' : 'Sin requerimientos.'}
            </td></tr>
          )}
        </tbody>
        {datosFiltrados.length > 0 && (() => {
          const totalHoras = datosFiltrados.reduce((s, r) => s + (r.total_horas_estimadas ?? 0), 0)
          const totalEntregas = datosFiltrados.reduce((s, r) => s + (r.entregas?.length ?? 0), 0)
          // Label ocupa todas las columnas activas no numéricas (lead + Est. + extras + acciones vacía).
          const leadCount = coreVisibleCount - metricasVisibles.length + columnasExtra.length + 1
          return (
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                <td className="p-2"></td>
                <td className="p-2" colSpan={leadCount}>Total ({datosFiltrados.length} requerimientos)</td>
                {columnasActivas.has('horas') && <td className="p-2 text-right">{totalHoras.toLocaleString('es-CO')}</td>}
                {columnasActivas.has('entregasCount') && <td className="p-2 text-center">{totalEntregas}</td>}
                <td className="p-2"></td>
              </tr>
            </tfoot>
          )
        })()}
      </table>
    </TablaScroll>
  )
}
