import { RAMIFICACIONES } from './useTarifas'
import type { TarifasState } from './useTarifas'

type Props = Pick<
  TarifasState,
  | 'tEditAnio'
  | 'setTEditAnio'
  | 'tEditValorHora'
  | 'setTEditValorHora'
  | 'tEditRamificacion'
  | 'setTEditRamificacion'
  | 'setTEditItem'
  | 'guardarPopupTarifa'
>

export function ModalEditarTarifa({
  tEditAnio,
  setTEditAnio,
  tEditValorHora,
  setTEditValorHora,
  tEditRamificacion,
  setTEditRamificacion,
  setTEditItem,
  guardarPopupTarifa,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={() => setTEditItem(null)}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}>
        <h2 className="titulo-seccion mb-4">Editar tarifa</h2>
        <div className="mb-3">
          <label className="mb-1 block text-sm text-slate-600">Año</label>
          <input value={tEditAnio} onChange={(e) => setTEditAnio(e.target.value)}
            type="number" className="campo w-full" />
        </div>
        <div className="mb-3">
          <label className="mb-1 block text-sm text-slate-600">Valor hora</label>
          <input value={tEditValorHora} onChange={(e) => setTEditValorHora(e.target.value)}
            type="number" className="campo w-full" />
        </div>
        <div className="mb-4">
          <label className="mb-1 block text-sm text-slate-600">Ramificación</label>
          <select value={tEditRamificacion} onChange={(e) => setTEditRamificacion(e.target.value)}
            className="campo w-full">
            {RAMIFICACIONES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={() => setTEditItem(null)}
            className="btn btn-secundario">Cancelar</button>
          <button onClick={guardarPopupTarifa}
            className="btn btn-primario">Guardar</button>
        </div>
      </div>
    </div>
  )
}
