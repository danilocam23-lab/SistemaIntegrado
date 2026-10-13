// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useState } from 'react'
import client from '../../api/client'
import { mensajeError } from '../../api/hooks'
import { Aviso, Boton, Campo } from '../../components/ui'
import type { Membresia } from '../../types'

interface Props {
  membresia: Membresia
  nombreSquad: string
  puedeEditar: boolean
  /** Se guardaron las fechas: recargar membresías y listado. */
  onGuardada: () => void
}

const aFechaInput = (iso: string | null | undefined): string => (iso ? iso.slice(0, 10) : '')

/**
 * Fechas editables de una membresía. `Desde` vacío = desde el inicio del proyecto;
 * `Hasta` es el último día activo (incluido) y vacío = abierta (reabre una cerrada).
 * Envía por PATCH solo el campo que cambió.
 */
export function EditorFechasMembresia({ membresia, nombreSquad, puedeEditar, onGuardada }: Props) {
  const desdeInicial = aFechaInput(membresia.desde)
  const hastaInicial = aFechaInput(membresia.hasta)
  const [desde, setDesde] = useState(desdeInicial)
  const [hasta, setHasta] = useState(hastaInicial)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const errorHasta = desde && hasta && hasta < desde ? '«Hasta» no puede ser anterior a «Desde».' : ''
  const cambioDesde = desde !== desdeInicial
  const cambioHasta = hasta !== hastaInicial

  async function guardar(): Promise<void> {
    if ((!cambioDesde && !cambioHasta) || enviando || errorHasta) return
    const cuerpo: { desde?: string | null; hasta?: string | null } = {}
    if (cambioDesde) cuerpo.desde = desde || null
    if (cambioHasta) cuerpo.hasta = hasta || null
    setEnviando(true)
    setError('')
    try {
      await client.patch(`/membresias/${membresia.id}`, cuerpo)
      onGuardada()
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="mt-1.5 w-full space-y-2">
      {error && (
        <Aviso tono="error">
          <span role="alert">{error}</span>
        </Aviso>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <Campo
          etiqueta="Desde"
          type="date"
          compacto
          value={desde}
          disabled={!puedeEditar || enviando}
          onChange={(e) => setDesde(e.target.value)}
          aria-label={`Desde (squad ${nombreSquad})`}
          ayuda="Vacío = desde el inicio del proyecto"
        />
        <Campo
          etiqueta="Hasta / último día activo"
          type="date"
          compacto
          value={hasta}
          disabled={!puedeEditar || enviando}
          onChange={(e) => setHasta(e.target.value)}
          aria-label={`Hasta, último día activo (squad ${nombreSquad})`}
          ayuda={errorHasta || 'Vacío = abierta'}
          aria-invalid={!!errorHasta}
        />
        {puedeEditar && (
          <Boton
            tamano="sm"
            variante="primario"
            onClick={() => void guardar()}
            disabled={(!cambioDesde && !cambioHasta) || enviando || !!errorHasta}
            aria-label={`Guardar fechas del squad ${nombreSquad}`}
          >
            {enviando ? 'Guardando…' : 'Guardar fechas'}
          </Boton>
        )}
      </div>
    </div>
  )
}
