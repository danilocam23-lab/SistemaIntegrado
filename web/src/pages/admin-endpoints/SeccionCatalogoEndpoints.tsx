import { Aviso, Boton, Campo, Chip, Selector, TablaScroll } from '../../components/ui'
import { metodoClase } from './catalogoEndpoints'
import type { Metodo } from './tipos'
import type { EstadoAdminEndpoints } from './useAdminEndpoints'

type Props = EstadoAdminEndpoints

/** Prueba en vivo del CRUD de `/api/admin/endpoints` (colección `endpoints_admin`). */
export function SeccionCatalogoEndpoints({
  nuevoModulo,
  setNuevoModulo,
  nuevoMetodo,
  setNuevoMetodo,
  nuevaRuta,
  setNuevaRuta,
  nuevaDescripcion,
  setNuevaDescripcion,
  creandoEndpointAdmin,
  crearEndpointAdmin,
  avisoEndpointsAdmin,
  errorEndpointsAdmin,
  endpointsAdmin,
  eliminarEndpointAdmin,
}: Props) {
  return (
    <section className="tarjeta tarjeta-pad">
      <div className="mb-3">
        <h2 className="titulo-seccion">Catálogo administrable (agente de endpoints)</h2>
        <p className="text-xs text-slate-500">
          Prueba en vivo del agente CRUD de <code>/api/admin/endpoints</code>: agrega, lista y elimina entradas
          reales almacenadas en MongoDB (colección <code>endpoints_admin</code>).
        </p>
      </div>

      <form onSubmit={crearEndpointAdmin} className="mb-3 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Módulo</span>
          <Campo
            value={nuevoModulo}
            onChange={(e) => setNuevoModulo(e.target.value)}
            placeholder="Ej: Endpoints"
            required
            className="min-w-40"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Método</span>
          <Selector
            value={nuevoMetodo}
            onChange={(e) => setNuevoMetodo(e.target.value as Metodo)}
          >
            {(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as Metodo[]).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </Selector>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Ruta</span>
          <Campo
            value={nuevaRuta}
            onChange={(e) => setNuevaRuta(e.target.value)}
            placeholder="/api/admin/endpoints"
            required
            className="min-w-64"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Descripción</span>
          <Campo
            value={nuevaDescripcion}
            onChange={(e) => setNuevaDescripcion(e.target.value)}
            placeholder="Descripción breve"
            className="min-w-64"
          />
        </label>
        <Boton
          variante="primario"
          type="submit"
          disabled={creandoEndpointAdmin}
        >
          {creandoEndpointAdmin ? 'Creando...' : 'Crear endpoint'}
        </Boton>
      </form>

      {(avisoEndpointsAdmin || errorEndpointsAdmin) && (
        <Aviso tono="error" className="mb-3">
          {avisoEndpointsAdmin || errorEndpointsAdmin}
        </Aviso>
      )}

      <TablaScroll>
        <table className="tabla">
          <thead>
            <tr>
              <th>Módulo</th>
              <th>Método</th>
              <th>Ruta</th>
              <th>Descripción</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {endpointsAdmin.map((endpoint) => (
              <tr key={endpoint.id}>
                <td>{endpoint.modulo}</td>
                <td>
                  <Chip tono="categoria" className={metodoClase[endpoint.metodo as Metodo] ?? 'chip-neutro'}>
                    {endpoint.metodo}
                  </Chip>
                </td>
                <td className="font-mono">{endpoint.ruta}</td>
                <td>{endpoint.descripcion || '—'}</td>
                <td className="text-center">
                  <button onClick={() => eliminarEndpointAdmin(endpoint)} className="enlace-accion enlace-accion-peligro">
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {endpointsAdmin.length === 0 && (
              <tr><td colSpan={5} className="p-4 text-center text-slate-400">Sin endpoints registrados en el catálogo.</td></tr>
            )}
          </tbody>
        </table>
      </TablaScroll>
    </section>
  )
}
