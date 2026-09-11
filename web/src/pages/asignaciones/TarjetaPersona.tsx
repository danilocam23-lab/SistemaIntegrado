import { Chip, Icono, TablaScroll } from '../../components/ui'
import type { Categoria } from '../../types'
import { tonoEstadoChip } from './estados'
import type { GrupoPersona, WoPersona } from './tipos'
import { TablaWoPersona } from './TablaWoPersona'

interface Props {
  grupo: GrupoPersona
  expandida: boolean
  onToggle: () => void
  categoriaPorId: Map<string, Categoria>
  wos: WoPersona[]
}

/**
 * Tarjeta de una persona en la vista "Por Personas": cabecera con contadores
 * (asignaciones, horas de carga y WO) + tabla de requerimientos asignados +
 * tabla de WO de soporte.
 */
export function TarjetaPersona({ grupo, expandida, onToggle, categoriaPorId, wos }: Props) {
  const totalHoras = grupo.reqs.reduce((s, r) => s + r.horasCarga, 0)

  return (
    <section className="tarjeta overflow-hidden">
      <div className="flex items-center justify-between gap-3 bg-marca-osc px-4 py-3 text-white">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <Icono nombre="chevron-abajo" className={`transition-transform ${expandida ? '' : '-rotate-90'}`} />
          <span className="truncate text-sm font-semibold">{grupo.persona.nombre}</span>
          <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-xs">{grupo.reqs.length} asignaciones</span>
          <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-xs">{totalHoras.toFixed(0)}h carga</span>
          {wos.length > 0 && (
            <span className="shrink-0 rounded-full bg-emerald-400/30 px-2 py-0.5 text-xs">{wos.length} WO</span>
          )}
        </button>
      </div>
      {expandida && (
        <div className="space-y-0">
          <TablaScroll plano>
            <table className="tabla">
              <thead>
                <tr>
                  <th className="text-left">Requerimiento</th>
                  <th className="text-left">Estado</th>
                  <th className="text-left">Categoría</th>
                  <th className="text-right">%</th>
                  <th className="text-right">Horas carga</th>
                </tr>
              </thead>
              <tbody>
                {grupo.reqs.map((r, idx) => (
                  <tr key={idx}>
                    <td className="font-medium">{r.reqLabel}</td>
                    <td>
                      {r.reqEstado && (
                        <Chip tono={tonoEstadoChip(r.reqEstado)} className="px-2 py-0.5 text-[10px]">
                          {r.reqEstado}
                        </Chip>
                      )}
                    </td>
                    <td>{categoriaPorId.get(r.asig.categoria_id)?.nombre ?? '—'}</td>
                    <td className="text-right">{r.asig.total_porcentaje}%</td>
                    <td className="text-right font-mono">{r.horasCarga.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TablaScroll>
          <TablaWoPersona wos={wos} />
        </div>
      )}
    </section>
  )
}
