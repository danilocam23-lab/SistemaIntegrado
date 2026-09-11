import Modal from '../../components/Modal'
import { Boton, Campo, Selector } from '../../components/ui'
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
    <Modal titulo="Editar tarifa" abierto onCerrar={() => setTEditItem(null)}>
      <div className="space-y-3">
        <Campo
          etiqueta="Año"
          value={tEditAnio}
          onChange={(e) => setTEditAnio(e.target.value)}
          type="number"
          className="w-full"
        />
        <Campo
          etiqueta="Valor hora"
          value={tEditValorHora}
          onChange={(e) => setTEditValorHora(e.target.value)}
          type="number"
          className="w-full"
        />
        <Selector
          etiqueta="Ramificación"
          value={tEditRamificacion}
          onChange={(e) => setTEditRamificacion(e.target.value)}
          className="w-full"
        >
          {RAMIFICACIONES.map((r) => <option key={r} value={r}>{r}</option>)}
        </Selector>
        <div className="flex justify-end gap-2 pt-1">
          <Boton onClick={() => setTEditItem(null)} variante="secundario">
            Cancelar
          </Boton>
          <Boton onClick={guardarPopupTarifa} variante="primario">
            Guardar
          </Boton>
        </div>
      </div>
    </Modal>
  )
}
