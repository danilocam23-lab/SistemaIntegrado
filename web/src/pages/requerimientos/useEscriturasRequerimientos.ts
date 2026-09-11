import { useState } from 'react'
import type React from 'react'
import client from '../../api/client'
import { mensajeError } from '../../api/hooks'
import type { Requerimiento } from '../../types'

/** Escrituras de la tabla de requerimientos: edición en línea por celda (onBlur)
 *  y borrado de un requerimiento. Se invoca sin condición en el shell (regla de
 *  oro del ADR 0005); el JSX de celda editable vive en `CeldaEditable.tsx`. */
export function useEscriturasRequerimientos(
  puedeEditar: boolean,
  puedeEliminar: boolean,
  recargar: () => void,
  setAviso: (v: string) => void,
) {
  const [editCell, setEditCell] = useState<{ id: string; campo: string } | null>(null)
  const [editValue, setEditValue] = useState('')

  function iniciarEdicionCelda(req: Requerimiento, campo: string): void {
    let valor = ''
    switch (campo) {
      case 'codigo_sc': valor = req.solicitud?.codigo_sc ?? ''; break
      case 'nombre': valor = req.nombre ?? ''; break
      case 'estado': valor = req.estado; break
      case 'lt_hitss_id': valor = req.solicitud?.lt_hitss_id ?? ''; break
      case 'scrum_id': valor = req.solicitud?.scrum_id ?? ''; break
      case 'analista_requerimientos_id': valor = req.solicitud?.analista_requerimientos_id ?? ''; break
      case 'total_horas_estimadas': valor = req.total_horas_estimadas != null ? String(req.total_horas_estimadas) : ''; break
      case 'cantidad_entregas': valor = String(req.cantidad_entregas ?? 0); break
    }
    setEditCell({ id: req.id, campo })
    setEditValue(valor)
  }

  // INVARIANTE 17: guarda en onBlur (incluido select-persona, que NO guarda en onChange).
  // No memoizar CeldaEditable ni FilaRequerimiento, y no cambiarles la key: alteraría el
  // orden desmontaje/blur y perdería el guardado. `payload.solicitud` va completa, no
  // reducida a un patch parcial.
  async function guardarCelda(req: Requerimiento): Promise<void> {
    setAviso('')
    if (!puedeEditar) {
      setAviso('No tienes permiso para editar requerimientos.')
      setEditCell(null)
      return
    }
    const campo = editCell?.campo
    if (!campo) return

    try {
      const payload: any = {}
      if (campo === 'codigo_sc' || campo === 'lt_hitss_id' || campo === 'scrum_id' || campo === 'analista_requerimientos_id') {
        payload.solicitud = { ...req.solicitud, [campo]: editValue || null }
      } else if (campo === 'total_horas_estimadas') {
        payload.total_horas_estimadas = editValue ? Number(editValue) : null
      } else if (campo === 'cantidad_entregas') {
        payload.cantidad_entregas = editValue ? Number(editValue) : 0
      } else if (campo === 'nombre') {
        payload.nombre = editValue || null
      } else if (campo === 'estado') {
        payload.estado = editValue
      }

      // INVARIANTE 7: multi-tenant asimétrico — este PUT NO envía X-Aplicacion (a
      // diferencia de `eliminar`, más abajo). Responde 409 en modo consolidado.
      // Conservar exactamente así; no añadir cabecerasAplicacion aquí (ticket aparte).
      await client.put(`/requerimientos/${req.id}`, payload)
      setEditCell(null)
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  function handleKeyDown(e: React.KeyboardEvent, req: Requerimiento): void {
    if (e.key === 'Enter') { guardarCelda(req) }
    else if (e.key === 'Escape') { setEditCell(null) }
  }

  // INVARIANTE 7: multi-tenant asimétrico — este DELETE SÍ envía X-Aplicacion del
  // requerimiento (a diferencia de `guardarCelda`, arriba). Funciona en modo consolidado.
  async function eliminar(req: Requerimiento): Promise<void> {
    if (!puedeEliminar) {
      setAviso('No tienes permiso para eliminar requerimientos.')
      return
    }
    if (!window.confirm(`¿Eliminar el requerimiento ${req.codigo_req}? Esta acción no se puede deshacer.`)) return
    setAviso('')
    try {
      await client.delete(`/requerimientos/${req.id}`, {
        headers: { 'X-Aplicacion': req.aplicacion_id },
      })
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  const isEditing = (reqId: string, campo: string): boolean =>
    editCell?.id === reqId && editCell?.campo === campo

  return { editCell, editValue, setEditValue, iniciarEdicionCelda, guardarCelda, handleKeyDown, isEditing, eliminar }
}
