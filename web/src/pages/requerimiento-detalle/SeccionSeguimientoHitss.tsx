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
          <textarea value={seguimiento} onChange={(e) => onCambiar('seguimiento', e.target.value)} rows={2}
            disabled={!puedeEditarTipificacion}
            className="campo w-full" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Tipificación</span>
          <select value={tipificacion} onChange={(e) => onCambiar('tipificacion', e.target.value)}
            disabled={!puedeEditarTipificacion}
            className="campo w-full">
            <option value="">— Seleccionar —</option>
            <option value="HITSS">Hitss</option>
            <option value="EPM">EPM</option>
          </select>
        </label>
      </div>
      {puedeEditarTipificacion && (
        <button type="button" onClick={onGuardar}
          className="btn btn-primario mt-3">
          Guardar Seguimiento Hitss / Tipificación
        </button>
      )}
      <div>
        <button type="button" onClick={onVerHistorial}
          className="btn btn-secundario mt-3">
          Historial de estados
        </button>
      </div>
    </div>
  )
}
