import { Boton, Icono, Tarjeta, cx } from '../../components/ui'
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
  numero: string
  coloresPorTipo: Record<string, string | undefined>
  expandidos: Set<number>
  nivel: number
  onAlternar: (id: number) => void
}

function numeroHoras(valor: number | null): number {
  return valor ?? 0
}

function NodoArbol({ nodo, numero, coloresPorTipo, expandidos, nivel, onAlternar }: PropsNodo) {
  const tieneHijos = nodo.hijos.length > 0
  const expandido = expandidos.has(nodo.azdo_id)
  const color = coloresPorTipo[nodo.tipo]
  const horasCompletadas = numeroHoras(nodo.completed_work)
  const horasOriginales = numeroHoras(nodo.original_estimate)
  const mostrarHoras = horasCompletadas !== 0 || horasOriginales !== 0
  const esContexto = nodo.contexto

  return (
    <div className={cx(nivel > 0 && 'border-l border-slate-200 pl-3')}>
      <div className="group flex items-center gap-2 border-b border-slate-100 py-1 pr-1 hover:bg-slate-50">
        <span
          className="shrink-0 text-right font-mono text-2xs tabular-nums text-slate-400"
          style={{ minWidth: '3rem' }}
        >
          {numero}
        </span>

        {tieneHijos ? (
          <button
            type="button"
            onClick={() => onAlternar(nodo.azdo_id)}
            className="flex h-5 w-5 shrink-0 items-center justify-center text-slate-400 hover:text-slate-600"
            title={expandido ? 'Colapsar' : 'Expandir'}
          >
            <Icono nombre={expandido ? 'chevron-abajo' : 'chevron-derecha'} tamano={14} />
          </button>
        ) : (
          <span className="h-5 w-5 shrink-0" aria-hidden="true" />
        )}

        <span
          className={cx(
            'flex shrink-0 items-center gap-1 text-2xs font-semibold uppercase tracking-wide',
            esContexto && 'opacity-60',
          )}
          style={{ color: color ?? '#64748b' }}
          title={nodo.tipo}
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color ?? '#64748b' }} />
          {nodo.tipo}
        </span>

        <a
          href={nodo.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cx(
            'shrink-0 font-mono text-2xs hover:underline',
            esContexto ? 'text-marca-500' : 'text-marca-700',
          )}
        >
          #{nodo.azdo_id}
        </a>

        <h3
          className={cx('min-w-0 flex-1 truncate text-sm', esContexto ? 'text-slate-500' : 'text-slate-900')}
          title={nodo.titulo}
        >
          {nodo.titulo}
        </h3>

        {esContexto && (
          <span
            className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-2xs font-medium uppercase tracking-wide text-slate-400"
            title="Ancestro incluido solo para dar contexto a resultados filtrados por iteración."
          >
            contexto
          </span>
        )}

        <div className={cx('flex shrink-0 items-center gap-3 text-2xs', esContexto ? 'text-slate-300' : 'text-slate-400')}>
          {nodo.estado && <span>{nodo.estado}</span>}
          {nodo.asignado_a && <span className="hidden sm:inline">{nodo.asignado_a}</span>}
          {mostrarHoras && (
            <span className="font-mono tabular-nums">{horasCompletadas}/{horasOriginales} h</span>
          )}
        </div>
      </div>

      {tieneHijos && expandido && (
        <div>
          {nodo.hijos.map((hijo, indice) => (
            <NodoArbol
              key={hijo.azdo_id}
              nodo={hijo}
              numero={`${numero}.${indice + 1}`}
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

      <div className="border-t border-slate-100">
        {nodos.map((nodo, indice) => (
          <NodoArbol
            key={nodo.azdo_id}
            nodo={nodo}
            numero={`${indice + 1}`}
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
