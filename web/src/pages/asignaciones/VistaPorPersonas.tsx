import type { Categoria } from '../../types'
import type { GrupoPersona, WoPersona } from './tipos'
import { TarjetaPersona } from './TarjetaPersona'

interface Props {
  gruposPorPersona: GrupoPersona[]
  personasExpandidas: Set<string>
  onAlternarPersona: (personaId: string) => void
  wosPorPersonaMap: Map<string, WoPersona[]>
  categoriaPorId: Map<string, Categoria>
}

/** Vista "Por Personas": lista de tarjetas de persona expandibles + estado vacío. */
export function VistaPorPersonas({
  gruposPorPersona,
  personasExpandidas,
  onAlternarPersona,
  wosPorPersonaMap,
  categoriaPorId,
}: Props) {
  return (
    <div className="space-y-4">
      {gruposPorPersona.map((grupo) => (
        <TarjetaPersona
          key={grupo.persona.id}
          grupo={grupo}
          expandida={personasExpandidas.has(grupo.persona.id)}
          onToggle={() => onAlternarPersona(grupo.persona.id)}
          categoriaPorId={categoriaPorId}
          wos={wosPorPersonaMap.get(grupo.persona.id) ?? []}
        />
      ))}
      {gruposPorPersona.length === 0 && (
        <div className="tarjeta p-6 text-center text-sm text-slate-400">
          Sin asignaciones para mostrar.
        </div>
      )}
    </div>
  )
}
