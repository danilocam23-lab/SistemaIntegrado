// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useState } from 'react'
import { mensajeError } from '../../api/hooks'
import Modal from '../../components/Modal'
import { Aviso, Boton, Campo } from '../../components/ui'
import type { Persona } from '../../types'
import { desactivarPersona } from './desactivarPersona'
import { hoyISO } from './formatoFecha'

interface Props {
  persona: Persona
  onCerrar: () => void
  /** La persona quedó desactivada. */
  onDesactivada: () => void
}

/** Desactivación general con fecha de efecto (por defecto hoy; admite pasada o futura). */
export function ModalDesactivarPersona({ persona, onCerrar, onDesactivada }: Props) {
  const [fecha, setFecha] = useState(hoyISO())
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  async function confirmar(): Promise<void> {
    if (!fecha || enviando) return
    setEnviando(true)
    setError('')
    try {
      await desactivarPersona(persona.id, persona.nombre, fecha)
      onDesactivada()
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal abierto titulo={`Desactivar a ${persona.nombre}`} onCerrar={onCerrar}>
      <div className="space-y-4">
        {error && (
          <Aviso tono="error">
            <span role="alert">{error}</span>
          </Aviso>
        )}
        <Campo
          etiqueta="Fecha de efecto"
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="w-full"
          ayuda="Cierra con esa fecha los squads que siguen abiertos. Los que ya cerraste a mano conservan su fecha. Puede ser pasada o futura; también se guarda el día en que lo registras."
        />
        <div className="flex justify-end gap-2">
          <Boton onClick={onCerrar}>Cancelar</Boton>
          <Boton variante="peligro" onClick={() => void confirmar()} disabled={!fecha || enviando}>
            {enviando ? 'Desactivando…' : 'Desactivar persona'}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}
