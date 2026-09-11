import type { Dispatch, SetStateAction } from 'react'
import { Link } from 'react-router-dom'
import type { EntregasActasCampo } from '../../constantes'
import type { Requerimiento } from '../../types'
import type { crearRenderCelda } from './CeldaEditable'
import { calcularDiasTranscurridos, normalizarAns } from './utilidades'

interface FilaRequerimientoProps {
  req: Requerimiento
  isExpanded: boolean
  hasEst: boolean
  isLoadingEstimacion: boolean
  toggleExpandReq: (reqId: string) => Promise<void>
  columnasActivas: Set<string>
  columnasExtra: EntregasActasCampo[]
  renderCelda: ReturnType<typeof crearRenderCelda>
  squadPorId: Map<string, string>
  nombrePersona: (id: string | null) => string
  CAMPO_ACCESOR_REQ: Record<string, (r: Requerimiento) => string | number>
  expandedEntregas: Set<string>
  setExpandedEntregas: Dispatch<SetStateAction<Set<string>>>
  uploadingId: string | null
  puedeGestionarEstimaciones: boolean
  handleUploadClick: (reqId: string) => void
  openEstimationModal: (reqId: string) => Promise<void>
  puedeEditar: boolean
  puedeEliminar: boolean
  eliminar: (req: Requerimiento) => Promise<void>
}

/** `<tr>` principal de un requerimiento: 15 columnas core (con JSX propio — edición
 *  en línea, badge ANS, botón de entregas, `Link` al detalle) + columnas extra (vía
 *  `CAMPO_ACCESOR_REQ`) + acciones. INVARIANTE 14: dos caminos de render deliberadamente
 *  distintos, no unificar. INVARIANTE 17: no memoizar este componente ni darle una `key`
 *  que cambie con la edición — se perdería el guardado en `onBlur`. */
export function FilaRequerimiento({
  req, isExpanded, hasEst, isLoadingEstimacion, toggleExpandReq,
  columnasActivas, columnasExtra, renderCelda, squadPorId, nombrePersona, CAMPO_ACCESOR_REQ,
  expandedEntregas, setExpandedEntregas,
  uploadingId, puedeGestionarEstimaciones, handleUploadClick, openEstimationModal,
  puedeEditar, puedeEliminar, eliminar,
}: FilaRequerimientoProps) {
  return (
    <tr className={`border-t ${isExpanded ? 'bg-cyan-50/30' : ''}`}>
      <td className="p-2 text-center">
        {hasEst ? (
          <button onClick={() => { void toggleExpandReq(req.id) }} className="p-0.5 text-slate-400 hover:text-cyan-600">
            {isLoadingEstimacion ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-transparent border-t-cyan-500" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg"
                className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            )}
          </button>
        ) : null}
      </td>
      {columnasActivas.has('codigoReq') && (
      <td className="p-2 font-mono">
        <Link to={`/requerimientos/${req.id}`} className="enlace-accion">
          {req.codigo_req}
        </Link>
      </td>
      )}
      {columnasActivas.has('sc') && (
      <td className="p-2">{renderCelda(req, 'codigo_sc', req.solicitud?.codigo_sc ?? '')}</td>
      )}
      {columnasActivas.has('squad') && (
      <td className="p-2 text-xs text-slate-600">
        {req.solicitud?.squad_id ? (squadPorId.get(String(req.solicitud.squad_id)) ?? String(req.solicitud.squad_id)) : '—'}
      </td>
      )}
      {columnasActivas.has('nombreActa') && (
      <td className="p-2">{renderCelda(req, 'nombre', req.nombre ?? '')}</td>
      )}
      {columnasActivas.has('aplicacionEpm') && (
      <td className="p-2 text-xs text-slate-600">
        {req.nombre ? req.nombre.split('-')[0].trim() : '—'}
      </td>
      )}
      {columnasActivas.has('estado') && (
      <td className="p-2">{renderCelda(req, 'estado', req.estado, 'select')}</td>
      )}
      {columnasActivas.has('ansEstimacion') && (
      <td className="p-2 text-center">
        {(() => {
          const v = (req.ans_acta ?? '').trim().toUpperCase().replace(/[_-]+/g, ' ')
          if (!v) return <span className="text-slate-400">—</span>
          const clase = v === 'CUMPLE' ? 'bg-emerald-100 text-emerald-700'
            : v === 'NO CUMPLE' ? 'bg-red-100 text-red-700'
            : 'bg-slate-100 text-slate-600'
          const label = normalizarAns(req.ans_acta)
          return (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${clase}`}>
              {label}
            </span>
          )
        })()}
      </td>
      )}
      {columnasActivas.has('ltHitss') && (
      <td className="p-2">{renderCelda(req, 'lt_hitss_id', nombrePersona(req.solicitud?.lt_hitss_id ?? null), 'select-persona', 'LT_HITSS')}</td>
      )}
      {columnasActivas.has('scrum') && (
      <td className="p-2">{renderCelda(req, 'scrum_id', nombrePersona(req.solicitud?.scrum_id ?? null), 'select-persona', 'SCRUM')}</td>
      )}
      {columnasActivas.has('horas') && (
      <td className="p-2 text-right">{renderCelda(req, 'total_horas_estimadas', req.total_horas_estimadas != null ? String(req.total_horas_estimadas) : '', 'number')}</td>
      )}
      {columnasActivas.has('fechaSolicitud') && (
      <td className="p-2 text-center text-xs">
        {req.fecha_solicitud_acta
          ? req.fecha_solicitud_acta.slice(0, 10)
          : <span className="text-slate-400">—</span>}
      </td>
      )}
      {columnasActivas.has('fechaLimite') && (
      <td className="p-2 text-center text-xs">
        {req.fecha_limite
          ? req.fecha_limite.slice(0, 10)
          : <span className="text-slate-400">—</span>}
      </td>
      )}
      {columnasActivas.has('fechaReal') && (
      <td className="p-2 text-center text-xs">
        {req.fecha_real_entrega_estimacion
          ? req.fecha_real_entrega_estimacion.slice(0, 10)
          : <span className="text-slate-400">—</span>}
      </td>
      )}
      {columnasActivas.has('diasTranscurridos') && (
      <td className="p-2 text-right">
        {(() => {
          const result = calcularDiasTranscurridos(req.fecha_limite, req.fecha_real_entrega_estimacion)
          if (!result) return '—'
          const color = result.esNegativo ? 'text-red-600 font-semibold' : 'text-emerald-600'
          return (
            <span className={color}>
              {result.esNegativo ? '-' : '+'}{result.dias}
            </span>
          )
        })()}
      </td>
      )}
      {columnasActivas.has('entregasCount') && (
      <td className="p-2 text-center">
        {(req.entregas?.length ?? 0) > 0 ? (
          <button
            onClick={() => setExpandedEntregas(prev => {
              const next = new Set(prev)
              next.has(req.id) ? next.delete(req.id) : next.add(req.id)
              return next
            })}
            className="btn btn-exito btn-sm items-center gap-1"
            title="Ver entregas"
          >
            {req.entregas.length}
            <svg xmlns="http://www.w3.org/2000/svg"
              className={`h-3 w-3 transition-transform ${expandedEntregas.has(req.id) ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <span className="text-slate-400">0</span>
        )}
      </td>
      )}
      <td className="p-2 text-center">
        {hasEst ? (
          <button onClick={() => { void openEstimationModal(req.id) }} title="Ver estimación"
            className="rounded p-0.5 text-cyan-600 hover:text-cyan-800">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </button>
        ) : uploadingId === req.id ? (
          <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-transparent border-t-amber-500" />
        ) : puedeGestionarEstimaciones ? (
          <button onClick={() => handleUploadClick(req.id)} title="Cargar estimación (Excel)"
            className="rounded p-0.5 text-slate-400 hover:text-cyan-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17h6m-6-4h6m-6-4h3" />
            </svg>
          </button>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      {columnasExtra.map((c) => (
        <td key={c.key} className="p-2 text-xs text-slate-600 whitespace-nowrap">
          {(() => {
            const v = CAMPO_ACCESOR_REQ[c.key]?.(req)
            return v != null && v !== '' ? v : <span className="text-slate-400">—</span>
          })()}
        </td>
      ))}
      <td className="p-2 text-center whitespace-nowrap">
        {(puedeEditar || puedeEliminar) && (
          <>
            {puedeEditar && (
              <Link to={`/requerimientos/${req.id}`} className="enlace-accion text-xs mr-2">
                Editar
              </Link>
            )}
            {puedeEliminar && (
              <button onClick={() => { void eliminar(req) }} className="enlace-accion enlace-accion-peligro text-xs">
                Eliminar
              </button>
            )}
          </>
        )}
      </td>
    </tr>
  )
}
