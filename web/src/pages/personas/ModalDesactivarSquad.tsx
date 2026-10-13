// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useState } from 'react'
import client from '../../api/client'
import { mensajeError } from '../../api/hooks'
import Modal from '../../components/Modal'
import { Aviso, Boton, Campo } from '../../components/ui'
import type { Membresia, Persona, RespuestaCierreMembresia } from '../../types'
import { desactivarPersona } from './desactivarPersona'
import { fechaCorta, hoyISO } from './formatoFecha'

interface Props {
  persona: Persona
  membresia: Membresia
  nombreSquad: string
  onCerrar: () => void
  /** La membresía se cerró: hay que recargar la tabla (el modal puede seguir abierto). */
  onCerrada: () => void
  /** La persona quedó desactivada desde el aviso de «último squad». */
  onPersonaDesactivada: () => void
}

/** Cierra la membresía en un squad con fecha de efecto; avisa si era el último squad vigente. */
export function ModalDesactivarSquad({
  persona,
  membresia,
  nombreSquad,
  onCerrar,
  onCerrada,
  onPersonaDesactivada,
}: Props) {
  const [fecha, setFecha] = useState(hoyISO())
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [ultimo, setUltimo] = useState<RespuestaCierreMembresia | null>(null)

  async function cerrarMembresia(): Promise<void> {
    if (!fecha || enviando) return
    setEnviando(true)
    setError('')
    try {
      const { data } = await client.patch<RespuestaCierreMembresia>(`/membresias/${membresia.id}/cerrar`, {
        fecha_efecto: fecha,
      })
      onCerrada()
      if (data.ultimo_squad) setUltimo(data)
      else onCerrar()
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setEnviando(false)
    }
  }

  async function desactivarTodo(): Promise<void> {
    if (!ultimo || enviando) return
    setEnviando(true)
    setError('')
    try {
      await desactivarPersona(persona.id, persona.nombre, ultimo.efecto)
      onPersonaDesactivada()
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setEnviando(false)
    }
  }

  if (ultimo) {
    return (
      <Modal abierto titulo={`${persona.nombre} sin squads activos`} onCerrar={onCerrar}>
        <div className="space-y-4">
          {error && (
            <Aviso tono="error">
              <span role="alert">{error}</span>
            </Aviso>
          )}
          <Aviso tono="alerta">
            <span role="status">
              {persona.nombre} no tendrá squads activos después del {fechaCorta(ultimo.efecto, true)} (su último día
              activo). Puedes dejarla activa sin squad o desactivarla por completo con ese último día activo.
            </span>
          </Aviso>
          <div className="flex justify-end gap-2">
            <Boton onClick={onCerrar} disabled={enviando}>Dejar activo</Boton>
            <Boton variante="peligro" onClick={() => void desactivarTodo()} disabled={enviando}>
              {enviando ? 'Desactivando…' : 'Desactivar persona'}
            </Boton>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal abierto titulo={`Desactivar a ${persona.nombre} en ${nombreSquad}`} onCerrar={onCerrar}>
      <div className="space-y-4">
        {error && (
          <Aviso tono="error">
            <span role="alert">{error}</span>
          </Aviso>
        )}
        <Campo
          etiqueta="Último día activo"
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="w-full"
          ayuda="Es el último día en que la persona cuenta en el squad (incluido). Puede ser una fecha pasada o futura. Quedará guardado también el día en que lo registras. Su estado general y los demás squads no cambian."
        />
        <div className="flex justify-end gap-2">
          <Boton onClick={onCerrar}>Cancelar</Boton>
          <Boton variante="peligro" onClick={() => void cerrarMembresia()} disabled={!fecha || enviando}>
            {enviando ? 'Desactivando…' : `Desactivar en ${nombreSquad}`}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}
