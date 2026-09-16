import { Boton, Chip, Icono, Tarjeta, cx } from '../../components/ui'
import type { NodoEsquemaAzure, TipoWorkItemAzure } from '../../types'
import { colorAzure } from './utilidades'

interface PropsArbol {
  nodos: NodoEsquemaAzure[]
  tipos: TipoWorkItemAzure[]
  expandidos: Set<number>
  onAlternar: (id: number) => void
  onExpandirTodo: () => void
  onColapsarTodo: () => void
}

interface PropsNodo {
  nodo: NodoEsquemaAzure
  coloresPorTipo: Record<string, string | undefined>
  expandidos: Set<number>
  nivel: number
  onAlternar: (id: number) => void
}

function numeroHoras(valor: number | null): number {
  return valor ?? 0
}

function NodoArbol({ nodo, coloresPorTipo, expandidos, nivel, onAlternar }: PropsNodo) {
  const tieneHijos = nodo.hijos.length > 0
  const expandido = expandidos.has(nodo.azdo_id)
  const color = coloresPorTipo[nodo.tipo]
  const horasCompletadas = numeroHoras(nodo.completed_work)
  const horasOriginales = numeroHoras(nodo.original_estimate)
  const mostrarHoras = horasCompletadas !== 0 || horasOriginales !== 0

  return (
    <div className={cx(nivel > 0 && 'border-l border-slate-200 pl-4')}>
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-2">
            <button
              type="button"
              onClick={() => onAlternar(nodo.azdo_id)}
              disabled={!tieneHijos}
              className={cx(
                'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-slate-500',
                tieneHijos ? 'border-slate-200 bg-slate-50 hover:bg-slate-100' : 'cursor-default border-transparent bg-transparent text-slate-300',
              )}
              title={expandido ? 'Colapsar' : 'Expandir'}
            >
              {tieneHijos ? <Icono nombre={expandido ? 'chevron-abajo' : 'chevron-derecha'} /> : '•'}
            </button>
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span
                  className="chip font-semibold text-white"
                  style={{ backgroundColor: color ?? '#64748b' }}
                >
                  {nodo.tipo}
                </span>
                <a
                  href={nodo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs font-semibold text-marca-700 hover:underline"
                >
                  #{nodo.azdo_id}
                </a>
                {nodo.estado && <Chip tono="neutro">{nodo.estado}</Chip>}
              </div>
              <h3 className="truncate text-sm font-semibold text-slate-900" title={nodo.titulo}>{nodo.titulo}</h3>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>Asignado: {nodo.asignado_a || 'Sin asignar'}</span>
                {nodo.area_path && <span>Área: {nodo.area_path}</span>}
                {nodo.iteration_path && <span>Iteración: {nodo.iteration_path}</span>}
              </div>
            </div>
          </div>
          {mostrarHoras && (
            <div className="shrink-0 rounded-lg bg-slate-50 px-3 py-2 text-right text-xs text-slate-600">
              <div className="font-semibold text-slate-800">{horasCompletadas} / {horasOriginales} h</div>
              <div>completadas / estimadas</div>
            </div>
          )}
        </div>
      </div>

      {tieneHijos && expandido && (
        <div className="mt-2 space-y-2">
          {nodo.hijos.map((hijo) => (
            <NodoArbol
              key={hijo.azdo_id}
              nodo={hijo}
              coloresPorTipo={coloresPorTipo}
              expandidos={expandidos}
              nivel={nivel + 1}
              onAlternar={onAlternar}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function ArbolEsquemaAzure({
  nodos,
  tipos,
  expandidos,
  onAlternar,
  onExpandirTodo,
  onColapsarTodo,
}: PropsArbol) {
  const coloresPorTipo = Object.fromEntries(tipos.map((tipo) => [tipo.nombre, colorAzure(tipo.color)]))

  return (
    <Tarjeta className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="titulo-seccion">Árbol de trabajo</h2>
          <p className="text-xs text-slate-500">Épicas, contextualización, features, historias y tareas.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Boton variante="fantasma" tamano="sm" onClick={onExpandirTodo}>Expandir todo</Boton>
          <Boton variante="fantasma" tamano="sm" onClick={onColapsarTodo}>Colapsar todo</Boton>
        </div>
      </div>

      <div className="space-y-2">
        {nodos.map((nodo) => (
          <NodoArbol
            key={nodo.azdo_id}
            nodo={nodo}
            coloresPorTipo={coloresPorTipo}
            expandidos={expandidos}
            nivel={0}
            onAlternar={onAlternar}
          />
        ))}
      </div>
    </Tarjeta>
  )
}
