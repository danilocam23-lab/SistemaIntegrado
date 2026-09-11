import type { Configuracion as Config } from '../../types'
import { TablaScroll } from '../../components/ui/primitivos'
import { ModalEditarParametro } from './ModalEditarParametro'
import type { ParametrosState } from './useParametros'

type Props = ParametrosState & {
  datos: Config[]
  aviso: string
  ok: string
  error: string | null
}

export function SeccionParametros({
  datos,
  aviso,
  ok,
  error,
  valores,
  setValores,
  nuevaClave,
  setNuevaClave,
  nuevoValor,
  setNuevoValor,
  grupo,
  setGrupo,
  editItem,
  setEditItem,
  editClave,
  setEditClave,
  editGrupo,
  setEditGrupo,
  editValor,
  setEditValor,
  valorDe,
  abrirEdicion,
  guardarEdicion,
  guardar,
  crear,
  eliminarParametro,
}: Props) {
  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">
        Parámetros del squad activo:
        <code className="mx-1 rounded bg-slate-100 px-1">azdo_org_url</code>,
        <code className="mx-1 rounded bg-slate-100 px-1">azdo_pat</code>,
        <code className="mx-1 rounded bg-slate-100 px-1">azdo_sync_interval</code>.
      </p>
      <form onSubmit={crear} className="barra-filtros mb-4">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Clave</span>
          <input value={nuevaClave} onChange={(e) => setNuevaClave(e.target.value)} required
            className="campo" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Valor</span>
          <input value={nuevoValor} onChange={(e) => setNuevoValor(e.target.value)}
            className="campo" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Grupo</span>
          <input value={grupo} onChange={(e) => setGrupo(e.target.value)}
            className="campo" />
        </label>
        <button className="btn btn-primario">Agregar / actualizar</button>
      </form>

      {(aviso || error) && <div className="aviso aviso-error mb-3">{aviso || error}</div>}
      {ok && <div className="aviso aviso-exito mb-3">{ok}</div>}

      <TablaScroll>
      <table className="text-sm">
        <thead className="bg-marca-osc text-white">
          <tr>
            <th className="p-2 text-left">Clave</th>
            <th className="p-2 text-left">Grupo</th>
            <th className="p-2 text-left">Valor</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {datos.map((c) => (
            <tr key={c.id} className="border-t">
              <td className="p-2 font-mono">{c.clave}</td>
              <td className="p-2 text-slate-500">{c.grupo}</td>
              <td className="p-2">
                <input
                  value={valorDe(c)}
                  onChange={(e) => setValores({ ...valores, [c.clave]: e.target.value })}
                  className="campo campo-sm w-full"
                />
              </td>
              <td className="p-2 text-center">
                <div className="flex justify-center gap-2">
                  <button onClick={() => guardar(c)} className="enlace-accion">Guardar</button>
                  <button onClick={() => abrirEdicion(c)} className="enlace-accion enlace-accion-alerta">Editar</button>
                  <button onClick={() => void eliminarParametro(c)} className="enlace-accion enlace-accion-peligro">Eliminar</button>
                </div>
              </td>
            </tr>
          ))}
          {datos.length === 0 && (
            <tr><td colSpan={4} className="p-4 text-center text-slate-400">Sin parámetros.</td></tr>
          )}
        </tbody>
      </table>
      </TablaScroll>

      {/* Modal edición parámetro */}
      {editItem && (
        <ModalEditarParametro
          setEditItem={setEditItem}
          editClave={editClave}
          setEditClave={setEditClave}
          editGrupo={editGrupo}
          setEditGrupo={setEditGrupo}
          editValor={editValor}
          setEditValor={setEditValor}
          guardarEdicion={guardarEdicion}
        />
      )}
    </div>
  )
}
