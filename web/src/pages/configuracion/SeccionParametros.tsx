// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Aviso, Boton, Campo, Selector, TablaScroll } from '../../components/ui'
import { CLAVE_TEMA_ESTACIONAL, OPCIONES_TEMA_ESTACIONAL } from '../../hooks/useTemaEstacional'
import type { Configuracion as Config } from '../../types'
import { ModalEditarParametro } from './ModalEditarParametro'
import { esGestionada } from './useParametros'
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
  // Claves administradas en otra pestana (p. ej. roles_persona): no se listan aqui.
  const visibles = datos.filter((c) => !esGestionada(c.clave))
  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">
        Parámetros generales de la aplicación. La URL de la organización y el PAT de Azure DevOps
        se configuran en la vista Azure DevOps.
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
          {visibles.map((c) => {
            return (
              <tr key={c.id}>
                <td className="font-mono">{c.clave}</td>
                <td className="text-slate-500">{c.grupo}</td>
                <td>
                  {c.clave.trim() === CLAVE_TEMA_ESTACIONAL ? (
                    <Selector
                      value={valorDe(c)}
                      onChange={(e) => setValores({ ...valores, [c.clave]: e.target.value })}
                      compacto
                      className="w-full"
                      aria-label="Tema estacional"
                    >
                      {OPCIONES_TEMA_ESTACIONAL.some((o) => o.valor === valorDe(c)) ? null : (
                        <option value={valorDe(c)}>{valorDe(c) || '(vacío)'}</option>
                      )}
                      {OPCIONES_TEMA_ESTACIONAL.map((o) => (
                        <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
                      ))}
                    </Selector>
                  ) : (
                    <Campo
                      value={valorDe(c)}
                      onChange={(e) => setValores({ ...valores, [c.clave]: e.target.value })}
                      compacto
                      className="w-full"
                    />
                  )}
                </td>
                <td className="text-center">
                  <div className="flex justify-center gap-2">
                    <button onClick={() => guardar(c)} className="enlace-accion">Guardar</button>
                    <button onClick={() => abrirEdicion(c)} className="enlace-accion enlace-accion-alerta">Editar</button>
                    <button onClick={() => void eliminarParametro(c)} className="enlace-accion enlace-accion-peligro">Eliminar</button>
                  </div>
                </td>
              </tr>
            )
          })}
          {visibles.length === 0 && (
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
