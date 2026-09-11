import type { MouseEvent as ReactMouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { Chip, Icono, TablaScroll } from '../../components/ui'
import type { Categoria, Persona } from '../../types'
import { tonoEstadoChip } from './estados'
import type { AsignacionItem, GrupoReq } from './tipos'
import type { useEscriturasAsignaciones } from './useEscriturasAsignaciones'
import { FilaAsignacion } from './FilaAsignacion'

interface Props {
  grupo: GrupoReq
  expandido: boolean
  onToggle: (event: ReactMouseEvent<HTMLButtonElement>, reqId: string | null) => void
  puedeEditarAsignaciones: boolean
  personaPorId: Map<string, Persona>
  categoriaPorId: Map<string, Categoria>
  editandoAsigId: string | undefined
  escrituras: ReturnType<typeof useEscriturasAsignaciones>
  onEditar: (asig: AsignacionItem) => void
}

/**
 * Cabecera de un grupo (acta/requerimiento) + su tabla de asignaciones,
 * colapsable. Si el requerimiento no tiene horas estimadas (`0` o `null`),
 * el bloque de horas de la cabecera no se muestra.
 */
export function GrupoRequerimiento({
  grupo,
  expandido,
  onToggle,
  puedeEditarAsignaciones,
  personaPorId,
  categoriaPorId,
  editandoAsigId,
  escrituras,
  onEditar,
}: Props) {
  return (
    <section className="tarjeta overflow-hidden">
      <div className="flex items-center justify-between gap-3 bg-marca-osc px-4 py-3 text-white">
        <button
          type="button"
          onClick={(event) => onToggle(event, grupo.reqId)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <Icono nombre="chevron-abajo" className={`transition-transform ${expandido ? '' : '-rotate-90'}`} />
          <span className="truncate text-sm font-semibold">{grupo.reqLabel}</span>
          {grupo.reqId && (() => {
            if (!grupo.horasEstimadas) return null
            const horasReales = grupo.horasEstimadas * 0.9
            return (
              <div className="ml-4 flex shrink-0 items-center gap-4 border-l border-white/30 pl-4 text-xs font-medium">
                <div>
                  <div className="text-white/70">Horas est.</div>
                  <div>{grupo.horasEstimadas.toFixed(1)} h</div>
                </div>
                <div>
                  <div className="text-white/70">Horas reales (90%)</div>
                  <div>{horasReales.toFixed(1)} h</div>
                </div>
              </div>
            )
          })()}
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {grupo.reqId && (
            <Link
              to={`/requerimientos/${grupo.reqId}`}
              className="rounded-full bg-white/10 px-2 py-1 text-xs font-medium text-white hover:bg-white/20"
            >
              Ver req
            </Link>
          )}
          <Chip tono={tonoEstadoChip(grupo.reqEstado)}>{grupo.reqEstado ?? 'Sin estado'}</Chip>
          <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-medium text-white">
            {grupo.items.length} asignación{grupo.items.length === 1 ? '' : 'es'}
          </span>
        </div>
      </div>

      {expandido && (
        <TablaScroll plano>
          <table className="tabla">
            <thead>
              <tr>
                <th className="text-left">Persona</th>
                <th className="text-left">Categoría</th>
                <th className="text-center">Prioridad</th>
                <th className="text-right">% carga</th>
                <th className="text-right">Horas según carga</th>
                <th className="text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {grupo.items.map((item) => (
                <FilaAsignacion
                  key={item.asig.id}
                  item={item}
                  personaPorId={personaPorId}
                  categoriaPorId={categoriaPorId}
                  puedeEditarAsignaciones={puedeEditarAsignaciones}
                  resaltada={editandoAsigId === item.asig.id}
                  escrituras={escrituras}
                  onEditar={onEditar}
                />
              ))}
            </tbody>
          </table>
        </TablaScroll>
      )}
    </section>
  )
}
