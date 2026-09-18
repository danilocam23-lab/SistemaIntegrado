// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { Link } from 'react-router-dom'
import { Boton, Chip, Icono, Tarjeta } from '../../components/ui'
import type { EntregasActasCampo } from '../../constantes'
import type { Requerimiento } from '../../types'
import type { crearRenderCelda } from './CeldaEditable'
import { calcularDiasTranscurridos, normalizarAns } from './utilidades'

interface TarjetaRequerimientoProps {
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

const CLASE_SPAN_CHIP_ESTADO =
  'inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700'

/** Par label/valor de la grilla de la tarjeta: label pequeño en mayúsculas tenue
 *  arriba, valor debajo. `ancho` permite que un campo largo ocupe las 2 columnas. */
function CampoTarjeta({ label, ancho = 1, children }: { label: string; ancho?: 1 | 2; children: ReactNode }) {
  return (
    <div className={ancho === 2 ? 'col-span-2' : undefined}>
      <p className="etiqueta-sup mb-0.5">{label}</p>
      <div className="text-sm text-slate-800">{children}</div>
    </div>
  )
}

/** Tarjeta de un requerimiento para pantallas angostas (`md:hidden`, ver
 *  `TablaRequerimientos`): mismos datos, handlers y permisos que `FilaRequerimiento`
 *  — solo cambia la agrupación visual de fila-horizontal a tarjeta. Ninguna columna
 *  se omite: las 15 core (según `columnasActivas`) + extras aparecen todas como
 *  pares label/valor, con Código REQ y Estado destacados en el encabezado. */
export function TarjetaRequerimiento({
  req, isExpanded, hasEst, isLoadingEstimacion, toggleExpandReq,
  columnasActivas, columnasExtra, renderCelda, squadPorId, nombrePersona, CAMPO_ACCESOR_REQ,
  expandedEntregas, setExpandedEntregas,
  uploadingId, puedeGestionarEstimaciones, handleUploadClick, openEstimationModal,
  puedeEditar, puedeEliminar, eliminar,
}: TarjetaRequerimientoProps) {
  const dias = calcularDiasTranscurridos(req.fecha_limite, req.fecha_real_entrega_estimacion)

  return (
    <Tarjeta className={`overflow-hidden !p-0 ${isExpanded ? 'ring-1 ring-cyan-200' : ''}`}>
      {/* Encabezado: chevron de estimación + Código REQ destacado + Estado a la derecha */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 p-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {hasEst && (
              <button onClick={() => { void toggleExpandReq(req.id) }} className="shrink-0 p-0.5 text-slate-400 hover:text-cyan-600">
                {isLoadingEstimacion ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-transparent border-t-cyan-500" />
                ) : (
                  <Icono nombre="chevron-derecha" className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                )}
              </button>
            )}
            {columnasActivas.has('codigoReq') && (
              <Link to={`/requerimientos/${req.id}`} className="truncate font-mono text-sm font-bold text-marca-600">
                {req.codigo_req}
              </Link>
            )}
          </div>
          {columnasActivas.has('nombreActa') && (
            <div className="mt-0.5 truncate text-xs text-slate-500">
              {renderCelda(req, 'nombre', req.nombre ?? '')}
            </div>
          )}
        </div>
        {columnasActivas.has('estado') && (
          <div className="shrink-0">
            {renderCelda(req, 'estado', req.estado, 'select', undefined, CLASE_SPAN_CHIP_ESTADO)}
          </div>
        )}
      </div>

      {/* Grilla 2 columnas: el resto de campos, ninguno omitido */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 p-3">
        {columnasActivas.has('sc') && (
          <CampoTarjeta label="SC">{renderCelda(req, 'codigo_sc', req.solicitud?.codigo_sc ?? '')}</CampoTarjeta>
        )}
        {columnasActivas.has('squad') && (
          <CampoTarjeta label="Squad">
            {req.solicitud?.squad_id ? (squadPorId.get(String(req.solicitud.squad_id)) ?? String(req.solicitud.squad_id)) : '—'}
          </CampoTarjeta>
        )}
        {columnasActivas.has('aplicacionEpm') && (
          <CampoTarjeta label="Aplicación EPM" ancho={2}>
            {req.nombre ? req.nombre.split('-')[0].trim() : '—'}
          </CampoTarjeta>
        )}
        {columnasActivas.has('ansEstimacion') && (
          <CampoTarjeta label="ANS Estimación">
            {(() => {
              const v = (req.ans_acta ?? '').trim().toUpperCase().replace(/[_-]+/g, ' ')
              if (!v) return <span className="text-slate-400">—</span>
              const tono = v === 'CUMPLE' ? 'exito' : v === 'NO CUMPLE' ? 'error' : 'neutro'
              return <Chip tono={tono}>{normalizarAns(req.ans_acta)}</Chip>
            })()}
          </CampoTarjeta>
        )}
        {columnasActivas.has('ltHitss') && (
          <CampoTarjeta label="Líder técnico">
            {renderCelda(req, 'lt_hitss_id', nombrePersona(req.solicitud?.lt_hitss_id ?? null), 'select-persona', 'LT_HITSS')}
          </CampoTarjeta>
        )}
        {columnasActivas.has('scrum') && (
          <CampoTarjeta label="Scrum">
            {renderCelda(req, 'scrum_id', nombrePersona(req.solicitud?.scrum_id ?? null), 'select-persona', 'SCRUM')}
          </CampoTarjeta>
        )}
        {columnasActivas.has('horas') && (
          <CampoTarjeta label="Horas">
            {renderCelda(req, 'total_horas_estimadas', req.total_horas_estimadas != null ? String(req.total_horas_estimadas) : '', 'number')}
          </CampoTarjeta>
        )}
        {columnasActivas.has('fechaSolicitud') && (
          <CampoTarjeta label="F. Solicitud">
            {req.fecha_solicitud_acta ? req.fecha_solicitud_acta.slice(0, 10) : <span className="text-slate-400">—</span>}
          </CampoTarjeta>
        )}
        {columnasActivas.has('fechaLimite') && (
          <CampoTarjeta label="F. Límite">
            {req.fecha_limite ? req.fecha_limite.slice(0, 10) : <span className="text-slate-400">—</span>}
          </CampoTarjeta>
        )}
        {columnasActivas.has('fechaReal') && (
          <CampoTarjeta label="F. Real" ancho={2}>
            {req.fecha_real_entrega_estimacion ? req.fecha_real_entrega_estimacion.slice(0, 10) : <span className="text-slate-400">—</span>}
          </CampoTarjeta>
        )}
        {columnasActivas.has('diasTranscurridos') && (
          <CampoTarjeta label="Días transcurridos">
            {dias ? (
              <span className={dias.esNegativo ? 'font-semibold text-red-600' : 'text-emerald-600'}>
                {dias.esNegativo ? '-' : '+'}{dias.dias}
              </span>
            ) : '—'}
          </CampoTarjeta>
        )}
        {columnasActivas.has('entregasCount') && (
          <CampoTarjeta label="Entregas">
            {(req.entregas?.length ?? 0) > 0 ? (
              <Boton
                variante="exito"
                tamano="sm"
                onClick={() => setExpandedEntregas(prev => {
                  const next = new Set(prev)
                  next.has(req.id) ? next.delete(req.id) : next.add(req.id)
                  return next
                })}
                title="Ver entregas"
              >
                {req.entregas.length}
                <Icono nombre="chevron-derecha" className={`h-3 w-3 transition-transform ${expandedEntregas.has(req.id) ? 'rotate-90' : ''}`} />
              </Boton>
            ) : (
              <span className="text-slate-400">0</span>
            )}
          </CampoTarjeta>
        )}
        <CampoTarjeta label="Estimación">
          {hasEst ? (
            <button onClick={() => { void openEstimationModal(req.id) }} title="Ver estimación"
              className="rounded p-0.5 text-cyan-600 hover:text-cyan-800">
              <Icono nombre="estimacion" className="h-5 w-5" />
            </button>
          ) : uploadingId === req.id ? (
            <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-transparent border-t-amber-500" />
          ) : puedeGestionarEstimaciones ? (
            <button onClick={() => handleUploadClick(req.id)} title="Cargar estimación (Excel)"
              className="rounded p-0.5 text-slate-400 hover:text-cyan-600">
              <Icono nombre="documento" className="h-5 w-5" />
            </button>
          ) : (
            <span className="text-slate-300">—</span>
          )}
        </CampoTarjeta>
        {columnasExtra.map((c) => (
          <CampoTarjeta key={c.key} label={c.label}>
            {(() => {
              const v = CAMPO_ACCESOR_REQ[c.key]?.(req)
              return v != null && v !== '' ? v : <span className="text-slate-400">—</span>
            })()}
          </CampoTarjeta>
        ))}
      </div>

      {(puedeEditar || puedeEliminar) && (
        <div className="flex justify-end gap-3 border-t border-slate-100 p-3">
          {puedeEditar && (
            <Link to={`/requerimientos/${req.id}`} className="enlace-accion text-xs">
              Editar
            </Link>
          )}
          {puedeEliminar && (
            <button onClick={() => { void eliminar(req) }} className="enlace-accion enlace-accion-peligro text-xs">
              Eliminar
            </button>
          )}
        </div>
      )}
    </Tarjeta>
  )
}
