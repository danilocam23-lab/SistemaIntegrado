// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useState } from 'react'
import type { FormEvent } from 'react'
import { AreaTexto, Aviso, Boton, Chip, Tarjeta } from '../../components/ui'
import { fmtFechaCo } from '../../utilidades/fechas'
import type { SeguimientoEpm } from '../../types'

interface Props {
  registros: SeguimientoEpm[]
  /** Texto legado (espejo) para requerimientos sin historial. */
  textoLegado: string | null
  puedeEditar: boolean
  guardando: boolean
  error: string
  ok: string
  /** Devuelve true si el registro se guardó (entonces se limpia el cuadro). */
  onAgregar: (texto: string) => Promise<boolean>
}

/** Pestaña "Seguimiento EPM": formulario para agregar un registro e historial (más reciente arriba). */
export default function SeccionSeguimientoEpm({
  registros, textoLegado, puedeEditar, guardando, error, ok, onAgregar,
}: Props) {
  const [texto, setTexto] = useState('')
  const recientesPrimero = [...registros].reverse()
  const legado = registros.length === 0 && textoLegado?.trim() ? textoLegado : null

  async function enviar(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (guardando || !texto.trim()) return
    if (await onAgregar(texto)) setTexto('')
  }

  return (
    <Tarjeta>
      <h2 className="etiqueta-sup mb-3">Seguimiento EPM</h2>
      {puedeEditar && (
        <form onSubmit={enviar} aria-label="Agregar registro de seguimiento EPM" aria-busy={guardando} className="mb-4">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Nuevo registro</span>
            <AreaTexto
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={3}
              disabled={guardando}
              className="w-full"
            />
          </label>
          <Boton type="submit" variante="primario" className="mt-2" disabled={guardando || !texto.trim()}>
            {guardando ? 'Guardando…' : 'Agregar registro'}
          </Boton>
        </form>
      )}
      {error && (
        <div role="alert" className="mb-3">
          <Aviso tono="error">{error}</Aviso>
        </div>
      )}
      <div aria-live="polite" role="status" className={ok ? 'mb-3' : undefined}>
        {ok && <Aviso tono="exito">{ok}</Aviso>}
      </div>

      {recientesPrimero.length > 0 ? (
        <ol className="space-y-3" aria-label="Historial de seguimiento EPM">
          {recientesPrimero.map((r) => (
            <li key={r.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                <time dateTime={r.fecha} className="font-mono">{fmtFechaCo(r.fecha)}</time>
                <Chip tono="neutro">{r.usuario}</Chip>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{r.texto}</p>
            </li>
          ))}
        </ol>
      ) : legado ? (
        <ul aria-label="Historial de seguimiento EPM">
          <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="mb-1 text-xs text-slate-500">Registro anterior (sin fecha)</div>
            <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{legado}</p>
          </li>
        </ul>
      ) : (
        <p className="text-sm text-slate-400">Sin registros de seguimiento EPM todavía</p>
      )}
    </Tarjeta>
  )
}
