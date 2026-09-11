import { Aviso, Boton, Campo, TablaScroll } from '../../components/ui'
import type { Configuracion as Config } from '../../types'
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
        <Campo
          etiqueta="Clave"
          value={nuevaClave}
          onChange={(e) => setNuevaClave(e.target.value)}
          required
        />
        <Campo
          etiqueta="Valor"
          value={nuevoValor}
          onChange={(e) => setNuevoValor(e.target.value)}
        />
        <Campo
          etiqueta="Grupo"
          value={grupo}
          onChange={(e) => setGrupo(e.target.value)}
        />
        <Boton type="submit" variante="primario">Agregar / actualizar</Boton>
      </form>

      {(aviso || error) && <Aviso tono="error" className="mb-3">{aviso || error}</Aviso>}
      {ok && <Aviso tono="exito" className="mb-3">{ok}</Aviso>}

      <TablaScroll>
      <table className="tabla">
        <thead>
          <tr>
            <th>Clave</th>
            <th>Grupo</th>
            <th>Valor</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {datos.map((c) => (
            <tr key={c.id}>
              <td className="font-mono">{c.clave}</td>
              <td className="text-slate-500">{c.grupo}</td>
              <td>
                <Campo
                  value={valorDe(c)}
                  onChange={(e) => setValores({ ...valores, [c.clave]: e.target.value })}
                  compacto
                  className="w-full"
                />
              </td>
              <td className="text-center">
                <div className="flex justify-center gap-2">
                  <button onClick={() => guardar(c)} className="enlace-accion">Guardar</button>
                  <button onClick={() => abrirEdicion(c)} className="enlace-accion enlace-accion-alerta">Editar</button>
                  <button onClick={() => void eliminarParametro(c)} className="enlace-accion enlace-accion-peligro">Eliminar</button>
                </div>
              </td>
            </tr>
          ))}
          {datos.length === 0 && (
            <tr><td colSpan={4} className="text-center text-slate-400">Sin parámetros.</td></tr>
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
