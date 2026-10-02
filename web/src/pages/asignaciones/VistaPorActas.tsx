// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import type { ReactNode } from 'react'
import type { Categoria, Persona } from '../../types'
import type { CargaPersona } from './carga'
import type { AsignacionItem, GrupoReq } from './tipos'
import type { useEscriturasAsignaciones } from './useEscriturasAsignaciones'
import { GrupoRequerimiento } from './GrupoRequerimiento'

interface Props {
  gruposFiltrados: GrupoReq[]
  /** Grupos que el usuario colapsó (por defecto todos abiertos; no se reinicia al recargar). */
  gruposColapsados: Set<string | null>
  onAlternarGrupo: (reqId: string | null) => void
  /** Contenido del estado vacío (mensaje + acción), ya resuelto por la página. */
  vacio: ReactNode
  puedeEditarAsignaciones: boolean
  personaPorId: Map<string, Persona>
  personaPorEmail: Map<string, Persona>
  categoriaPorId: Map<string, Categoria>
  editandoAsigId: string | undefined
  cargaDe: (personaId: string) => CargaPersona
  escrituras: ReturnType<typeof useEscriturasAsignaciones>
  erroresFila: Record<string, string>
  onCerrarError: (asigId: string) => void
  onEditar: (asig: AsignacionItem) => void
  onEliminar: (asig: AsignacionItem) => void
  onAsignar: (reqId: string | null) => void
  onAsignarSintetica: (personaId: string, reqId: string | null) => void
}

/** Vista "Por Actas / Requerimientos": lista de grupos expandibles + estado vacío. */
export function VistaPorActas({
  gruposFiltrados,
  gruposColapsados,
  onAlternarGrupo,
  vacio,
  puedeEditarAsignaciones,
  personaPorId,
  personaPorEmail,
  categoriaPorId,
  editandoAsigId,
  cargaDe,
  escrituras,
  erroresFila,
  onCerrarError,
  onEditar,
  onEliminar,
  onAsignar,
  onAsignarSintetica,
}: Props) {
  return (
    <div className="space-y-3">
      {gruposFiltrados.map((grupo) => (
        <GrupoRequerimiento
          key={grupo.reqId ?? 'sin-requerimiento'}
          grupo={grupo}
          expandido={!gruposColapsados.has(grupo.reqId)}
          onToggle={onAlternarGrupo}
          puedeEditarAsignaciones={puedeEditarAsignaciones}
          personaPorId={personaPorId}
          personaPorEmail={personaPorEmail}
          categoriaPorId={categoriaPorId}
          editandoAsigId={editandoAsigId}
          cargaDe={cargaDe}
          escrituras={escrituras}
          erroresFila={erroresFila}
          onCerrarError={onCerrarError}
          onEditar={onEditar}
          onEliminar={onEliminar}
          onAsignar={onAsignar}
          onAsignarSintetica={onAsignarSintetica}
        />
      ))}

      {gruposFiltrados.length === 0 && (
        <div className="tarjeta p-6 text-center text-sm text-slate-500">{vacio}</div>
      )}
    </div>
  )
}
