// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import type { FormEvent } from 'react'
import Modal from '../../components/Modal'
import { Aviso, Boton, Campo, Selector } from '../../components/ui'
import type { Persona } from '../../types'

interface Props {
  abierto: boolean
  onCerrar: () => void
  personasDisponibles: Persona[]
  personaId: string
  onCambiarPersonaId: (valor: string) => void
  mes: string
  onCambiarMes: (valor: string) => void
  horas: string
  onCambiarHoras: (valor: string) => void
  aviso: string
  onSubmit: (e: FormEvent) => void
}

/** Alta de una capacidad mensual (persona + mes + horas disponibles). Se abre desde el
 *  botón "Nueva capacidad" del encabezado (sin preselección) o al hacer clic en una
 *  celda vacía de la matriz (persona y mes ya preseleccionados). */
export default function ModalCapacidad({
  abierto, onCerrar, personasDisponibles, personaId, onCambiarPersonaId,
  mes, onCambiarMes, horas, onCambiarHoras, aviso, onSubmit,
}: Props) {
  return (
    <Modal titulo="Nueva capacidad" abierto={abierto} onCerrar={onCerrar}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Persona</span>
          <Selector value={personaId} onChange={(e) => onCambiarPersonaId(e.target.value)} required>
            <option value="">— Seleccionar —</option>
            {personasDisponibles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </Selector>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Mes</span>
          <Campo value={mes} onChange={(e) => onCambiarMes(e.target.value)} type="month" required />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Horas disponibles</span>
          <Campo value={horas} onChange={(e) => onCambiarHoras(e.target.value)} type="number" required
            className="w-32" />
        </label>
        {aviso && <Aviso tono="error">{aviso}</Aviso>}
        <div className="flex justify-end gap-2 pt-2">
          <Boton variante="secundario" type="button" onClick={onCerrar}>Cancelar</Boton>
          <Boton variante="primario" type="submit">Crear</Boton>
        </div>
      </form>
    </Modal>
  )
}
