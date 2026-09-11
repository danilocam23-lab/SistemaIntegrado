import type { MouseEvent as ReactMouseEvent } from 'react'
import type { Categoria, Persona } from '../../types'
import type { AsignacionItem, GrupoReq } from './tipos'
import type { useEscriturasAsignaciones } from './useEscriturasAsignaciones'
import { GrupoRequerimiento } from './GrupoRequerimiento'

interface Props {
  gruposFiltrados: GrupoReq[]
  gruposExpandidos: Set<string | null>
  onAlternarGrupo: (event: ReactMouseEvent<HTMLButtonElement>, reqId: string | null) => void
  mensajeVacio: string
  puedeEditarAsignaciones: boolean
  personaPorId: Map<string, Persona>
  categoriaPorId: Map<string, Categoria>
  editandoAsigId: string | undefined
  escrituras: ReturnType<typeof useEscriturasAsignaciones>
  onEditar: (asig: AsignacionItem) => void
}

/** Vista "Por Actas / Requerimientos": lista de grupos expandibles + estado vacío. */
export function VistaPorActas({
  gruposFiltrados,
  gruposExpandidos,
  onAlternarGrupo,
  mensajeVacio,
  puedeEditarAsignaciones,
  personaPorId,
  categoriaPorId,
  editandoAsigId,
  escrituras,
  onEditar,
}: Props) {
  return (
    <div className="space-y-4">
      {gruposFiltrados.map((grupo) => (
        <GrupoRequerimiento
          key={grupo.reqId ?? 'sin-requerimiento'}
          grupo={grupo}
          expandido={gruposExpandidos.has(grupo.reqId)}
          onToggle={onAlternarGrupo}
          puedeEditarAsignaciones={puedeEditarAsignaciones}
          personaPorId={personaPorId}
          categoriaPorId={categoriaPorId}
          editandoAsigId={editandoAsigId}
          escrituras={escrituras}
          onEditar={onEditar}
        />
      ))}

      {gruposFiltrados.length === 0 && (
        <div className="tarjeta p-6 text-center text-sm text-slate-400">
          {mensajeVacio}
        </div>
      )}
    </div>
  )
}
