// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useEffect, useState } from 'react'
import client from '../../api/client'
import { mensajeError } from '../../api/hooks'
import Modal from '../../components/Modal'
import { Aviso, Boton } from '../../components/ui'
import type { Persona } from '../../types'
import type { ImpactoEliminacion } from './tipos'

interface Props {
  persona: Persona | null
  eliminando: boolean
  error: string
  onConfirmar: () => void
  onCerrar: () => void
}

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`
}

/** Confirmación de eliminación con los efectos de la cascada (GET /personas/{id}/impacto). */
export function ModalEliminar({ persona, eliminando, error, onConfirmar, onCerrar }: Props) {
  const [impacto, setImpacto] = useState<ImpactoEliminacion | null>(null)
  const [cargando, setCargando] = useState(false)
  const [errorImpacto, setErrorImpacto] = useState('')
  const id = persona?.id

  useEffect(() => {
    if (!id) return
    let vigente = true
    setImpacto(null)
    setErrorImpacto('')
    setCargando(true)
    client
      .get<ImpactoEliminacion>(`/personas/${id}/impacto`)
      .then((r) => {
        if (vigente) setImpacto(r.data)
      })
      .catch((err) => {
        if (vigente) setErrorImpacto(mensajeError(err))
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })
    return () => {
      vigente = false
    }
  }, [id])

  const bloqueada = impacto ? !impacto.eliminable : false

  return (
    <Modal titulo={persona ? `Eliminar a ${persona.nombre}` : 'Eliminar persona'} abierto={!!persona} onCerrar={onCerrar}>
      <div className="space-y-3 text-sm text-slate-700">
        {cargando && <p role="status" className="text-slate-500">Calculando el impacto…</p>}

        {errorImpacto && (
          <Aviso tono="alerta">
            <span role="alert">
              No se pudo calcular el impacto ({errorImpacto}). Al eliminar se borran también las asignaciones, capacidades
              y work items de Azure de esta persona.
            </span>
          </Aviso>
        )}

        {impacto && !bloqueada && (
          <>
            <p>Al eliminar esta persona se borrarán también, sin posibilidad de deshacer:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>{plural(impacto.cascada.asignaciones, 'asignación', 'asignaciones')}</li>
              <li>{plural(impacto.cascada.capacidades, 'capacidad mensual', 'capacidades mensuales')}</li>
              <li>{plural(impacto.cascada.work_items, 'work item de Azure', 'work items de Azure')}</li>
            </ul>
          </>
        )}

        {impacto && bloqueada && (
          <Aviso tono="error">
            <span role="alert">
              No se puede eliminar a {impacto.nombre}: está referenciada en{' '}
              {plural(impacto.referencias.requerimientos, 'requerimiento', 'requerimientos')} y{' '}
              {plural(impacto.referencias.squads, 'squad', 'squads')}. Reasigna esas referencias o usa la fusión de
              duplicados.
            </span>
          </Aviso>
        )}

        {error && (
          <Aviso tono="error">
            <span role="alert">{error}</span>
          </Aviso>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Boton onClick={onCerrar}>Cancelar</Boton>
          <Boton variante="peligro" onClick={onConfirmar} disabled={eliminando || cargando || bloqueada}>
            {eliminando ? 'Eliminando…' : 'Eliminar definitivamente'}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}
