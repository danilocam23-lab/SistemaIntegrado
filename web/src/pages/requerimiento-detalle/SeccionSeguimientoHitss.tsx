import { useState } from 'react'
import { AreaTexto, Boton, Selector } from '../../components/ui'
import type { ValoresRequerimiento } from './useRequerimientoDetalle'

interface Props {
  seguimiento: string
  tipificacion: string
  onCambiar: <K extends keyof ValoresRequerimiento>(clave: K, valor: ValoresRequerimiento[K]) => void
  puedeEditarTipificacion: boolean
  onGuardar: () => void
}

interface LineaSeguimiento {
  clave: number
  fecha: string | null
  fechaOrden: number | null
  texto: string
}

// Convención informal: "DD/MM/AAAA_texto" o "DD/MM/AAAA-texto" por línea. No
// todas las líneas la siguen (texto histórico libre): lo que no matchea se
// muestra tal cual, sin fecha ni reordenar.
const PATRON_FECHA = /^(\d{2})\/(\d{2})\/(\d{4})[_-]\s*(.*)$/

function parsearSeguimiento(seguimiento: string): LineaSeguimiento[] {
  return seguimiento
    .split('\n')
    .filter((linea) => linea.trim() !== '')
    .map((linea, indice) => {
      const coincidencia = linea.match(PATRON_FECHA)
      if (!coincidencia) {
        return { clave: indice, fecha: null, fechaOrden: null, texto: linea }
      }
      const [, dia, mes, anio, texto] = coincidencia
      const fecha = `${dia}/${mes}/${anio}`
      const fechaValida = new Date(Number(anio), Number(mes) - 1, Number(dia))
      const fechaOrden = Number.isNaN(fechaValida.getTime()) ? null : fechaValida.getTime()
      return { clave: indice, fecha, fechaOrden, texto }
    })
}

function ordenarPorFechaDesc(lineas: LineaSeguimiento[]): LineaSeguimiento[] {
  const todasConFecha = lineas.every((l) => l.fechaOrden !== null)
  if (!todasConFecha) return lineas
  return [...lineas].sort((a, b) => (b.fechaOrden as number) - (a.fechaOrden as number))
}

/**
 * Tarjeta "Seguimiento Hitss". `onCambiar` escribe en el MISMO estado `campos`
 * del hook que la tarjeta de datos generales (invariante: "Guardar cambios"
 * arrastra lo tecleado aquí sin haberlo guardado aparte).
 *
 * En modo lectura se muestra como línea de tiempo (parseo de presentación,
 * sin tocar el campo de texto libre guardado); "Editar" alterna al `AreaTexto`.
 */
export default function SeccionSeguimientoHitss({
  seguimiento,
  tipificacion,
  onCambiar,
  puedeEditarTipificacion,
  onGuardar,
}: Props) {
  const [editando, setEditando] = useState(false)
  const lineas = ordenarPorFechaDesc(parsearSeguimiento(seguimiento))

  function guardar(): void {
    onGuardar()
    setEditando(false)
  }

  return (
    <div className="tarjeta tarjeta-pad">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="etiqueta-sup">Seguimiento Hitss</h2>
        {puedeEditarTipificacion && !editando && (
          <Boton variante="secundario" tamano="sm" onClick={() => setEditando(true)}>
            Editar
          </Boton>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="text-sm sm:col-span-2 lg:col-span-3">
          <span className="mb-1 block text-slate-600">Seguimiento Hitss</span>
          {editando ? (
            <AreaTexto
              value={seguimiento}
              onChange={(e) => onCambiar('seguimiento', e.target.value)}
              rows={6}
              disabled={!puedeEditarTipificacion}
              className="w-full"
            />
          ) : lineas.length > 0 ? (
            <ul className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              {lineas.map((linea) => (
                <li key={linea.clave} className="flex flex-wrap gap-x-2 gap-y-0.5 text-sm">
                  {linea.fecha && (
                    <span className="shrink-0 font-mono text-xs text-slate-400">{linea.fecha}</span>
                  )}
                  <span className="text-slate-700">{linea.texto}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">Sin seguimiento registrado.</p>
          )}
        </div>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Tipificación</span>
          <Selector value={tipificacion} onChange={(e) => onCambiar('tipificacion', e.target.value)}
            disabled={!puedeEditarTipificacion}
            className="w-full">
            <option value="">— Seleccionar —</option>
            <option value="HITSS">Hitss</option>
            <option value="EPM">EPM</option>
          </Selector>
        </label>
      </div>
      {puedeEditarTipificacion && (
        <Boton variante="primario" onClick={guardar} className="mt-3">
          Guardar Seguimiento Hitss / Tipificación
        </Boton>
      )}
    </div>
  )
}
