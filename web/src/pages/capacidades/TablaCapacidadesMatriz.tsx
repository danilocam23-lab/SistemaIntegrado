import type { MutableRefObject } from 'react'
import { Campo, TablaScroll } from '../../components/ui'
import type { Capacidad } from '../../types'
import { MESES_ABREV } from './useMatrizCapacidades'
import type { FilaMatrizCapacidad } from './useMatrizCapacidades'

interface EditCell {
  id: string
  campo: string
}

interface Props {
  filas: FilaMatrizCapacidad[]
  anioSeleccionado: string
  puedeEditarCapacidades: boolean
  editCell: EditCell | null
  editValue: string
  onCambiarEditValue: (valor: string) => void
  onIniciarEdicion: (capacidad: Capacidad) => void
  onGuardarEdicion: (capacidad: Capacidad) => void
  onCancelarEdicion: () => void
  onEliminar: (capacidad: Capacidad) => void
  cancelarBlurRef: MutableRefObject<boolean>
  onAbrirCeldaVacia: (personaId: string, mes: string) => void
}

/** Matriz persona × mes del año seleccionado. Cada fila es una persona (nombre fijo en
 *  la primera columna, sticky para no perderlo con el scroll horizontal); cada columna
 *  es un mes de `anioSeleccionado`. Una celda con horas se edita al hacer clic; una
 *  celda vacía muestra un "+" que abre el alta para esa persona y ese mes. */
export default function TablaCapacidadesMatriz({
  filas, anioSeleccionado, puedeEditarCapacidades, editCell, editValue, onCambiarEditValue,
  onIniciarEdicion, onGuardarEdicion, onCancelarEdicion, onEliminar, cancelarBlurRef,
  onAbrirCeldaVacia,
}: Props) {
  return (
    <TablaScroll>
      <table className="tabla">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-slate-50">Persona</th>
            {MESES_ABREV.map((mesAbrev) => (
              <th key={mesAbrev} className="text-right">{mesAbrev}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.personaId}>
              <td className="sticky left-0 z-10 bg-white font-medium text-slate-800">
                {fila.nombre}
              </td>
              {fila.celdas.map((capacidad, indice) => {
                const mes = `${anioSeleccionado}-${String(indice + 1).padStart(2, '0')}`
                const editando = puedeEditarCapacidades
                  && Boolean(capacidad)
                  && editCell?.id === capacidad?.id
                  && editCell?.campo === 'horas_disponibles'

                if (editando && capacidad) {
                  return (
                    <td key={mes} className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Campo
                          autoFocus
                          type="number"
                          value={editValue}
                          onChange={(e) => onCambiarEditValue(e.target.value)}
                          onBlur={() => {
                            if (cancelarBlurRef.current) {
                              cancelarBlurRef.current = false
                              return
                            }
                            onGuardarEdicion(capacidad)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              e.currentTarget.blur()
                            }
                            if (e.key === 'Escape') {
                              e.preventDefault()
                              onCancelarEdicion()
                            }
                          }}
                          compacto
                          className="w-20 text-right"
                        />
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            cancelarBlurRef.current = true
                          }}
                          onClick={() => onEliminar(capacidad)}
                          title="Eliminar capacidad"
                          className="text-[11px] font-semibold text-red-600 transition-colors hover:text-red-700 hover:underline"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  )
                }

                if (capacidad) {
                  return (
                    <td
                      key={mes}
                      className={puedeEditarCapacidades ? 'cursor-pointer text-right' : 'text-right'}
                      title={puedeEditarCapacidades ? 'Clic para editar' : undefined}
                      onClick={() => puedeEditarCapacidades && onIniciarEdicion(capacidad)}
                    >
                      {capacidad.horas_disponibles}
                    </td>
                  )
                }

                return (
                  <td key={mes} className="text-right">
                    {puedeEditarCapacidades ? (
                      <button
                        type="button"
                        onClick={() => onAbrirCeldaVacia(fila.personaId, mes)}
                        title="Agregar capacidad"
                        className="font-semibold text-slate-300 transition-colors hover:text-marca-600"
                      >
                        +
                      </button>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
          {filas.length === 0 && (
            <tr>
              <td colSpan={MESES_ABREV.length + 1} className="p-4 text-center text-slate-400">
                Sin capacidades.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </TablaScroll>
  )
}
