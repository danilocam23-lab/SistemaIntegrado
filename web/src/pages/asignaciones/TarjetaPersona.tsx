import { TablaScroll } from '../../components/ui/primitivos'
import type { Categoria } from '../../types'
import { claseBadgeEstado } from './estados'
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
          <span className="text-sm">{expandida ? '▼' : '▶'}</span>
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
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Requerimiento</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Categoría</th>
                  <th className="px-3 py-2 text-right">%</th>
                  <th className="px-3 py-2 text-right">Horas carga</th>
                </tr>
              </thead>
              <tbody>
                {grupo.reqs.map((r, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="px-3 py-2 font-medium">{r.reqLabel}</td>
                    <td className="px-3 py-2">
                      {r.reqEstado && <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${claseBadgeEstado(r.reqEstado)}`}>{r.reqEstado}</span>}
                    </td>
                    <td className="px-3 py-2">{categoriaPorId.get(r.asig.categoria_id)?.nombre ?? '—'}</td>
                    <td className="px-3 py-2 text-right">{r.asig.total_porcentaje}%</td>
                    <td className="px-3 py-2 text-right font-mono">{r.horasCarga.toFixed(1)}</td>
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
