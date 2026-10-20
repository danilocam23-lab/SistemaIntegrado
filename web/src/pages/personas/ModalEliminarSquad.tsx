// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useState } from 'react'
import client from '../../api/client'
import { mensajeError } from '../../api/hooks'
import Modal from '../../components/Modal'
import { Aviso, Boton } from '../../components/ui'
import type { Membresia, Persona, RespuestaEliminacionMembresia } from '../../types'
import { fechaCorta } from './formatoFecha'

interface Props {
  persona: Persona
  membresia: Membresia
  nombreSquad: string
  onCerrar: () => void
  /** La membresía se eliminó: hay que recargar la tabla (el modal puede seguir abierto). */
  onEliminada: () => void
}

/** Borra físicamente la membresía de la persona en un squad (abierta o cerrada). No se puede deshacer. */
export function ModalEliminarSquad({ persona, membresia, nombreSquad, onCerrar, onEliminada }: Props) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [sinSquads, setSinSquads] = useState(false)

  async function eliminar(): Promise<void> {
    if (enviando) return
    setEnviando(true)
    setError('')
    try {
      const { data } = await client.delete<RespuestaEliminacionMembresia>(`/membresias/${membresia.id}`)
      onEliminada()
      if (data.ultimo_squad) setSinSquads(true)
      else onCerrar()
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setEnviando(false)
    }
  }

  if (sinSquads) {
    return (
      <Modal abierto titulo="Squad eliminado" onCerrar={onCerrar}>
        <div className="space-y-4">
          <Aviso tono="alerta">
            <span role="status">
              {persona.nombre} quedó sin squads. Sigue activa en general; puedes agregarla a un squad cuando lo necesites.
            </span>
          </Aviso>
          <div className="flex justify-end">
            <Boton onClick={onCerrar}>Entendido</Boton>
          </div>
        </div>
      </Modal>
    )
  }

  const desde = membresia.desde ? fechaCorta(membresia.desde) : 'inicio del proyecto'
  const hasta = membresia.hasta ? fechaCorta(membresia.hasta) : 'sin fecha de fin (abierta)'

  return (
    <Modal abierto titulo={`Eliminar a ${persona.nombre} del squad ${nombreSquad}`} onCerrar={onCerrar}>
      <div className="space-y-4">
        {error && (
          <Aviso tono="error">
            <span role="alert">{error}</span>
          </Aviso>
        )}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-slate-500">Squad</dt>
          <dd className="font-semibold text-slate-700">{nombreSquad}</dd>
          <dt className="text-slate-500">Desde</dt>
          <dd className="text-slate-700">{desde}</dd>
          <dt className="text-slate-500">Hasta</dt>
          <dd className="text-slate-700">{hasta}</dd>
        </dl>
        <Aviso tono="alerta">
          <span role="alert">
            Eliminar borra el squad de la persona junto con su historial de fechas. Esto afecta el devengo y la
            capacidad de los meses en que estuvo en el squad. No se puede deshacer. Si solo quieres que deje de contar
            desde una fecha, usa «Desactivar», que conserva el historial.
          </span>
        </Aviso>
        <div className="flex justify-end gap-2">
          <Boton onClick={onCerrar} disabled={enviando}>Cancelar</Boton>
          <Boton variante="peligro" onClick={() => void eliminar()} disabled={enviando}>
            {enviando ? 'Eliminando…' : 'Eliminar squad'}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}
