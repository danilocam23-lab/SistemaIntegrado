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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={() => setEditItem(null)}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}>
        <h2 className="titulo-seccion mb-4">Editar parámetro</h2>
        <div className="mb-3">
          <label className="mb-1 block text-sm text-slate-600">Clave</label>
          <input value={editClave} onChange={(e) => setEditClave(e.target.value)}
            className="campo w-full" />
        </div>
        <div className="mb-3">
          <label className="mb-1 block text-sm text-slate-600">Grupo</label>
          <input value={editGrupo} onChange={(e) => setEditGrupo(e.target.value)}
            className="campo w-full" />
        </div>
        <div className="mb-4">
          <label className="mb-1 block text-sm text-slate-600">Valor</label>
          <textarea value={editValor} onChange={(e) => setEditValor(e.target.value)}
            rows={3} className="campo w-full" />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={() => setEditItem(null)}
            className="btn btn-secundario">Cancelar</button>
          <button onClick={guardarEdicion}
            className="btn btn-primario">Guardar</button>
        </div>
      </div>
    </div>
  )
}
