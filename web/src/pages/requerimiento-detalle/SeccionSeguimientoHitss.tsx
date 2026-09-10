import { AreaTexto, Boton, Selector } from '../../components/ui'
import type { ValoresRequerimiento } from './useRequerimientoDetalle'

interface Props {
  seguimiento: string
  tipificacion: string
  onCambiar: <K extends keyof ValoresRequerimiento>(clave: K, valor: ValoresRequerimiento[K]) => void
  puedeEditarTipificacion: boolean
  onGuardar: () => void
  onVerHistorial: () => void
}

/**
 * Tarjeta "Seguimiento Hitss". `onCambiar` escribe en el MISMO estado `campos`
 * del hook que la tarjeta de datos generales (invariante: "Guardar cambios"
 * arrastra lo tecleado aquí sin haberlo guardado aparte).
 */
export default function SeccionSeguimientoHitss({
  seguimiento,
  tipificacion,
  onCambiar,
  puedeEditarTipificacion,
  onGuardar,
  onVerHistorial,
}: Props) {
  return (
    <div className="tarjeta tarjeta-pad">
      <h2 className="etiqueta-sup mb-3">
        Seguimiento Hitss
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm sm:col-span-2 lg:col-span-3">
          <span className="mb-1 block text-slate-600">Seguimiento Hitss</span>
          <AreaTexto value={seguimiento} onChange={(e) => onCambiar('seguimiento', e.target.value)} rows={2}
            disabled={!puedeEditarTipificacion}
            className="w-full" />
        </label>
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
        <Boton variante="primario" onClick={onGuardar} className="mt-3">
          Guardar Seguimiento Hitss / Tipificación
        </Boton>
      )}
      <div>
        <Boton variante="secundario" onClick={onVerHistorial} className="mt-3">
          Historial de estados
        </Boton>
      </div>
    </div>
  )
}
