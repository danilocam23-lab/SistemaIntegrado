// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../../api/client'
import { mensajeError } from '../../api/hooks'
import { useAplicacion } from '../../context/AplicacionContext'

interface PersonaLimpiada {
  campo: 'scrum_id' | 'analista_requerimientos_id'
  persona_id: string
  nombre: string | null
}

interface RespuestaCambioSquad {
  requerimiento_id: string
  codigo_req: string
  aplicacion_anterior: string
  aplicacion_nueva: string
  personas_limpiadas: PersonaLimpiada[]
}

const ROTULO_CAMPO: Record<PersonaLimpiada['campo'], string> = {
  scrum_id: 'Scrum',
  analista_requerimientos_id: 'Analista de requerimientos',
}

function mensajeCambioSquad(err: unknown): string {
  const estado = (err as { response?: { status?: number } })?.response?.status
  if (estado === 409) {
    return `No se pudo mover: ${mensajeError(err)}`
  }
  if (estado === 403) {
    return 'No tienes permiso para mover este requerimiento a ese squad.'
  }
  return mensajeError(err)
}

/** Texto de éxito, con las personas que el backend limpió por no pertenecer al squad destino. */
function textoExito(r: RespuestaCambioSquad, nombreDestino: string): string {
  const base = `El requerimiento ${r.codigo_req} se movió al squad ${nombreDestino}.`
  if (r.personas_limpiadas.length === 0) return base
  const detalle = r.personas_limpiadas
    .map((p) => `${ROTULO_CAMPO[p.campo]}: ${p.nombre ?? 'persona eliminada'}`)
    .join('; ')
  return `${base} Se limpiaron por no pertenecer al squad destino: ${detalle}.`
}

/**
 * Acción administrativa "mover el requerimiento a otro squad" (POST
 * `/requerimientos/:id/cambiar-squad`). Es independiente de "Guardar cambios".
 * Al éxito activa el squad destino y recarga la página en el detalle del
 * requerimiento (el contexto completo depende de la aplicación activa); el
 * aviso viaja en `location.state.avisoMovimiento`, que sobrevive al recargar.
 */
export function useCambiarSquad(reqId: string, aplicacionOrigen: string | undefined) {
  const navigate = useNavigate()
  const { setActiva, aplicaciones } = useAplicacion()
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function cambiarSquad(destino: string): Promise<void> {
    if (guardando) return
    setError('')
    setGuardando(true)
    try {
      const { data } = await client.post<RespuestaCambioSquad>(
        `/requerimientos/${encodeURIComponent(reqId)}/cambiar-squad`,
        { squad_destino: destino },
        aplicacionOrigen ? { headers: { 'X-Aplicacion': aplicacionOrigen } } : undefined,
      )
      const nombreDestino = aplicaciones.find((a) => a.codigo === destino)?.nombre ?? destino
      setActiva(destino)
      navigate(`/requerimientos/${data.requerimiento_id || reqId}`, {
        replace: true,
        state: { avisoMovimiento: textoExito(data, nombreDestino) },
      })
      window.location.reload()
    } catch (err) {
      setError(mensajeCambioSquad(err))
      setGuardando(false)
    }
  }

  return { cambiarSquad, guardando, error, limpiarError: () => setError('') }
}
