import { TablaScroll } from '../../components/ui/primitivos'
import { sortEntries } from './utilidades'

export interface ColumnaResumen<T> {
  encabezado: string
  render: (valor: T) => string
  className?: string
}

interface SeccionResumenColapsableProps<T> {
  titulo: string
  subtitulo: string
  encabezadoClave: string
  entradas: Array<[string, T]>
  columnas: ColumnaResumen<T>[]
  abierta: boolean
  onToggle: () => void
}

/** Sección colapsable de resumen del modal de estimación: cabecera con toggle + tabla.
 *  Genérica: se usa para Tipo de tarea y Sprint (7 columnas) y para Complejidad (5
 *  columnas) — la única diferencia entre las 3 instancias son las columnas. */
export function SeccionResumenColapsable<T>({
  titulo, subtitulo, encabezadoClave, entradas, columnas, abierta, onToggle,
}: SeccionResumenColapsableProps<T>) {
  return (
    <section className="tarjeta overflow-hidden">
      <button onClick={onToggle} className="flex w-full items-center justify-between px-5 py-4 text-left">
        <div>
          <h3 className="font-semibold text-slate-900">{titulo}</h3>
          <p className="text-sm text-slate-600">{subtitulo}</p>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-slate-400 transition-transform ${abierta ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {abierta && (
        <TablaScroll plano className="border-t border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left">{encabezadoClave}</th>
                {columnas.map((c) => (
                  <th key={c.encabezado} className="px-4 py-3 text-right">{c.encabezado}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortEntries(entradas).map(([key, value]) => (
                <tr key={key} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{key}</td>
                  {columnas.map((c) => (
                    <td key={c.encabezado} className={`px-4 py-3 text-right ${c.className ?? 'text-slate-700'}`}>{c.render(value)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </TablaScroll>
      )}
    </section>
  )
}
