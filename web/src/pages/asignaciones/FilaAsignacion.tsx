import { Icono } from '../../components/ui'
import type { Categoria, Persona } from '../../types'
import type { AsignacionItem, ItemGrupo } from './tipos'
import type { useEscriturasAsignaciones } from './useEscriturasAsignaciones'

interface Props {
  item: ItemGrupo
  personaPorId: Map<string, Persona>
  categoriaPorId: Map<string, Categoria>
  puedeEditarAsignaciones: boolean
  resaltada: boolean
  escrituras: ReturnType<typeof useEscriturasAsignaciones>
  onEditar: (asig: AsignacionItem) => void
}

/**
 * Fila de una asignación dentro de la tabla de un grupo (acta/requerimiento):
 * persona, categoría, prioridad, % de carga (editable en línea) y acciones.
 *
 * INVARIANTE: no lleva `React.memo` ni recibe `key` propia (la pone quien
 * mapea sobre `grupo.items`, con `asig.id`, en `GrupoRequerimiento`): el
 * orden de montaje/desmontaje del input de edición en línea al hacer blur
 * depende de eso.
 */
export function FilaAsignacion({
  item,
  personaPorId,
  categoriaPorId,
  puedeEditarAsignaciones,
  resaltada,
  escrituras,
  onEditar,
}: Props) {
  const { asig, horasCarga } = item
  const enEdicionInline = escrituras.edicionInlineId === asig.id

  return (
    <tr className={resaltada ? 'bg-amber-50' : ''}>
      <td>{personaPorId.get(asig.persona_id)?.nombre ?? asig.persona_id}</td>
      <td>{categoriaPorId.get(asig.categoria_id)?.nombre ?? asig.categoria_id}</td>
      <td className="text-center">
        <input
          type="checkbox"
          checked={asig.prioridad === true}
          onChange={() => void escrituras.cambiarPrioridad(asig)}
          title="Marcar como prioridad"
          className={`h-4 w-4 accent-marca ${puedeEditarAsignaciones ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
          disabled={!puedeEditarAsignaciones}
        />
      </td>
      <td className="text-right font-medium">
        {enEdicionInline ? (
          <input
            autoFocus
            type="number"
            min="0"
            max="100"
            value={escrituras.edicionInlineValor}
            onChange={(e) => escrituras.setEdicionInlineValor(e.target.value)}
            onBlur={() => void escrituras.guardarEdicionInline(asig)}
            onKeyDown={escrituras.onInlineKeyDown}
            className="campo campo-sm w-20 text-right"
          />
        ) : (
          <span className="inline-flex items-center gap-1">
            <span className={asig.total_porcentaje === 0 ? 'text-red-500' : ''}>
              {asig.total_porcentaje}%
            </span>
            {puedeEditarAsignaciones && (
              <button
                type="button"
                onClick={() => escrituras.iniciarEdicionInline(asig)}
                title="Editar %"
                className="text-slate-400 hover:text-marca"
              >
                <Icono nombre="lapiz" tamano={14} />
              </button>
            )}
          </span>
        )}
      </td>
      <td className="text-right text-slate-700">{horasCarga.toFixed(1)} h</td>
      <td className="text-center whitespace-nowrap">
        {puedeEditarAsignaciones && (
          <div className="flex items-center justify-center gap-3">
            <button type="button" onClick={() => onEditar(asig)} className="enlace-accion">
              Editar
            </button>
            <button
              type="button"
              onClick={() => void escrituras.eliminar(asig)}
              className="enlace-accion enlace-accion-peligro"
            >
              Eliminar
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}
