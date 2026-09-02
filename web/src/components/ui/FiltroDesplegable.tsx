import { useEffect, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { cx } from './primitivos'

/* Filtro desplegable de selección múltiple.
   Es el ÚNICO filtro de este tipo en la aplicación: todos los
   dashboards y listados deben usarlo para verse igual. */

interface Props {
  /** Texto del botón, p. ej. "Año" */
  label: string
  /** Icono opcional a la izquierda del texto */
  icono?: string
  /** Opciones visibles */
  opciones: string[]
  /** Claves seleccionadas */
  activos: Set<string>
  setActivos: Dispatch<SetStateAction<Set<string>>>
  /** Si es true, la clave guardada es el número de mes (1..12) */
  esMes?: boolean
  /** Ancho mínimo del panel */
  anchoPanel?: string
  /** Si solo está activo este valor por defecto, al elegir otro se reemplaza */
  valorInicial?: string
}

export default function FiltroDesplegable({
  label,
  icono,
  opciones,
  activos,
  setActivos,
  esMes = false,
  anchoPanel = '200px',
  valorInicial,
}: Props) {
  const ref = useRef<HTMLDetailsElement>(null)

  // Cierra el panel al hacer clic fuera o pulsar Escape
  useEffect(() => {
    function fuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) ref.current.open = false
    }
    function esc(e: KeyboardEvent) {
      if (e.key === 'Escape' && ref.current) ref.current.open = false
    }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', esc)
    }
  }, [])

  const clave = (opcion: string, i: number) => (esMes ? String(i + 1) : opcion)
  const todas = opciones.map(clave)
  const alternar = (k: string) =>
    setActivos((prev) => {
      const n = new Set(prev)
      if (n.has(k)) {
        n.delete(k)
        return n
      }
      // Sustituye la selección por defecto en lugar de acumularla
      if (valorInicial && n.size === 1 && n.has(valorInicial) && k !== valorInicial) {
        return new Set([k])
      }
      n.add(k)
      return n
    })

  const hayActivos = activos.size > 0

  return (
    <details ref={ref} className="group relative">
      <summary className={cx('filtro-desplegable', hayActivos && 'filtro-desplegable-activo')}>
        <span className="whitespace-nowrap">
          {icono && <span className="mr-1">{icono}</span>}
          {label}
        </span>
        {hayActivos && <span className="contador-filtro">{activos.size}</span>}
        <svg
          className="h-3.5 w-3.5 text-slate-400 transition-transform group-open:rotate-180"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z"
            clipRule="evenodd"
          />
        </svg>
      </summary>

      <div className="panel-desplegable" style={{ minWidth: anchoPanel }}>
        <div className="mb-2 flex justify-end gap-3">
          <button type="button" className="enlace-mini" onClick={() => setActivos(new Set(todas))}>
            Todos
          </button>
          <button
            type="button"
            className="text-2xs font-semibold text-slate-400 hover:underline"
            onClick={() => setActivos(new Set())}
          >
            Limpiar
          </button>
        </div>
        <div className={esMes ? 'grid grid-cols-3 gap-1.5' : 'flex flex-wrap gap-1.5'}>
          {opciones.map((o, i) => {
            const k = clave(o, i)
            const marcado = activos.has(k)
            return (
              <label
                key={k}
                className={cx('opcion-filtro', marcado ? 'opcion-filtro-on' : 'opcion-filtro-off')}
              >
                <input type="checkbox" checked={marcado} onChange={() => alternar(k)} className="h-3.5 w-3.5" />
                {o}
              </label>
            )
          })}
        </div>
      </div>
    </details>
  )
}
