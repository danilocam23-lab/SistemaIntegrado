import Modal from '../../components/Modal'
import { AreaTexto, Boton, Campo } from '../../components/ui'
import type { ParametrosState } from './useParametros'

type Props = Pick<
  ParametrosState,
  | 'setEditItem'
  | 'editClave'
  | 'setEditClave'
  | 'editGrupo'
  | 'setEditGrupo'
  | 'editValor'
  | 'setEditValor'
  | 'guardarEdicion'
>

export function ModalEditarParametro({
  setEditItem,
  editClave,
  setEditClave,
  editGrupo,
  setEditGrupo,
  editValor,
  setEditValor,
  guardarEdicion,
}: Props) {
  return (
    <Modal titulo="Editar parámetro" abierto onCerrar={() => setEditItem(null)}>
      <div className="space-y-3">
        <Campo
          etiqueta="Clave"
          value={editClave}
          onChange={(e) => setEditClave(e.target.value)}
          className="w-full"
        />
        <Campo
          etiqueta="Grupo"
          value={editGrupo}
          onChange={(e) => setEditGrupo(e.target.value)}
          className="w-full"
        />
        <AreaTexto
          etiqueta="Valor"
          value={editValor}
          onChange={(e) => setEditValor(e.target.value)}
          rows={3}
          className="w-full"
        />
        <div className="flex justify-end gap-2 pt-1">
          <Boton onClick={() => setEditItem(null)} variante="secundario">
            Cancelar
          </Boton>
          <Boton onClick={guardarEdicion} variante="primario">
            Guardar
          </Boton>
        </div>
      </div>
    </Modal>
  )
}
