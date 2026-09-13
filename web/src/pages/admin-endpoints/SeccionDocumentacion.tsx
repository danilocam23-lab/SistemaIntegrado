import { Campo, Chip, Selector, TablaScroll } from '../../components/ui'
import { ENDPOINTS, metodoClase } from './catalogoEndpoints'
import type { EstadoAdminEndpoints } from './useAdminEndpoints'

type Props = Pick<EstadoAdminEndpoints, 'filtro' | 'setFiltro' | 'modulo' | 'setModulo' | 'modulos' | 'endpointsFiltrados'>

/** Tabla de documentación de todas las rutas FastAPI, con filtro por módulo y texto libre. */
export function SeccionDocumentacion({ filtro, setFiltro, modulo, setModulo, modulos, endpointsFiltrados }: Props) {
  return (
    <section className="tarjeta tarjeta-pad">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="titulo-seccion">Documentación de endpoints</h2>
          <p className="text-xs text-slate-500">
            {endpointsFiltrados.length} de {ENDPOINTS.length} rutas documentadas. Todas requieren JWT salvo login y health; los recursos operativos usan <code>X-Aplicacion</code>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Selector value={modulo} onChange={(e) => setModulo(e.target.value)}>
            {modulos.map((m) => <option key={m} value={m}>{m}</option>)}
          </Selector>
          <Campo
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar ruta, permiso o descripción"
            className="min-w-72"
          />
        </div>
      </div>

      <TablaScroll>
        <table className="tabla">
          <thead>
            <tr>
              <th>Módulo</th>
              <th>Método</th>
              <th>Ruta</th>
              <th>Descripción</th>
              <th>Parámetros / cuerpo</th>
              <th>Permiso</th>
            </tr>
          </thead>
          <tbody>
            {endpointsFiltrados.map((endpoint) => (
              <tr key={`${endpoint.metodo}-${endpoint.ruta}`}>
                <td>{endpoint.modulo}</td>
                <td>
                  <Chip tono="categoria" className={metodoClase[endpoint.metodo]}>
                    {endpoint.metodo}
                  </Chip>
                </td>
                <td className="font-mono">{endpoint.ruta}</td>
                <td>{endpoint.descripcion}</td>
                <td>
                  {endpoint.parametros && <div><span className="font-semibold">Query:</span> {endpoint.parametros}</div>}
                  {endpoint.cuerpo && <div><span className="font-semibold">Body:</span> {endpoint.cuerpo}</div>}
                  {!endpoint.parametros && !endpoint.cuerpo && <span className="text-slate-400">—</span>}
                </td>
                <td className="font-mono">{endpoint.permisos ?? 'JWT / rol según ruta'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TablaScroll>
    </section>
  )
}
