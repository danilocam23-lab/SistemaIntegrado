// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useState } from 'react'
import client from '../../api/client'
import { mensajeError } from '../../api/hooks'
import Modal from '../../components/Modal'
import { Aviso, Boton, Campo, Selector } from '../../components/ui'
import type { Aplicacion, Persona } from '../../types'
import { hoyISO } from './formatoFecha'

interface Props {
  persona: Persona
  /** Squads (aplicaciones) en los que se puede abrir una membresía. */
  opciones: Aplicacion[]
  /** Código del squad a reabrir; si viene, el selector queda fijo. */
  squadFijo?: string
  onCerrar: () => void
  onAbierta: () => void
}

/** Agrega a la persona a un squad (o lo reabre) desde una fecha: abre una membresía nueva. */
export function ModalAbrirSquad({ persona, opciones, squadFijo, onCerrar, onAbierta }: Props) {
  const [squad, setSquad] = useState(squadFijo ?? '')
  const [desde, setDesde] = useState(hoyISO())
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const reabrir = !!squadFijo

  async function confirmar(): Promise<void> {
    if (!squad || !desde || enviando) return
    setEnviando(true)
    setError('')
    try {
      await client.post(`/membresias/persona/${persona.id}`, { squad_id: squad, desde })
      onAbierta()
      onCerrar()
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      abierto
      titulo={reabrir ? `Reabrir squad de ${persona.nombre}` : `Agregar a ${persona.nombre} a un squad`}
      onCerrar={onCerrar}
    >
      <div className="space-y-4">
        {error && (
          <Aviso tono="error">
            <span role="alert">{error}</span>
          </Aviso>
        )}
        <Selector
          etiqueta="Squad"
          value={squad}
          onChange={(e) => setSquad(e.target.value)}
          disabled={reabrir}
          className="w-full"
        >
          {!reabrir && <option value="">— Selecciona un squad —</option>}
          {opciones.map((a) => (
            <option key={a.codigo} value={a.codigo}>{a.nombre}</option>
          ))}
        </Selector>
        <Campo
          etiqueta="Desde"
          type="date"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
          className="w-full"
          ayuda={reabrir ? 'Se abre una nueva membresía; el periodo anterior se conserva.' : undefined}
        />
        <div className="flex justify-end gap-2">
          <Boton onClick={onCerrar}>Cancelar</Boton>
          <Boton variante="primario" onClick={() => void confirmar()} disabled={!squad || !desde || enviando}>
            {enviando ? 'Guardando…' : reabrir ? 'Reabrir' : 'Agregar'}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}
