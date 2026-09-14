import { useState } from 'react'
import { Aviso, Campo, Chip, Selector, TablaScroll } from '../../components/ui'
import { metodoClase } from './catalogoEndpoints'
import { ProbadorEndpoint } from './ProbadorEndpoint'
import { RIESGO_ETIQUETA, RIESGO_TONO } from './tipos'
import type { Metodo } from './tipos'
import type { EstadoAdminEndpoints } from './useAdminEndpoints'
import type { EndpointCatalogo } from '../../types'

type Props = Pick<
  EstadoAdminEndpoints,
  'filtro' | 'setFiltro' | 'modulo' | 'setModulo' | 'modulos' | 'endpointsFiltrados' | 'cargandoCatalogo' | 'errorCatalogo'
>

/**
 * Documentación viva de todas las operaciones reales de `/api/*` (F4.5, ADR-0008):
 * sale de `GET /api/admin/endpoints/catalogo`, derivado en caliente de `app.openapi()`,
 * en vez de la lista a mano (`catalogoEndpoints.ts`, 113 entradas) que se
 * desincronizaba del código. Cada fila abre el probador de endpoints (F4.6-F4.8)
 * para ejecutar la operación en vivo.
 */
export function SeccionDocumentacion({
  filtro,
  setFiltro,
  modulo,
  setModulo,
  modulos,
  endpointsFiltrados,
  cargandoCatalogo,
  errorCatalogo,
}: Props) {
  const [seleccionado, setSeleccionado] = useState<EndpointCatalogo | null>(null)

  return (
    <section className="tarjeta tarjeta-pad">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="titulo-seccion">Documentación de endpoints</h2>
          <p className="text-xs text-slate-500">
            {endpointsFiltrados.length} operaciones reales, leídas en vivo del contrato OpenAPI. Todas requieren
            JWT salvo login y health; los recursos operativos usan <code>X-Aplicacion</code>. Haz clic en
            «Probar» para ejecutar una en vivo (exige el permiso <code>admin.endpoints.probar</code>).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Selector value={modulo} onChange={(e) => setModulo(e.target.value)}>
            {modulos.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Selector>
          <Campo
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar ruta, permiso o descripción"
            className="min-w-72"
          />
        </div>
      </div>

      {errorCatalogo && <Aviso tono="error" className="mb-3">{errorCatalogo}</Aviso>}

      <TablaScroll>
        <table className="tabla">
          <thead>
            <tr>
              <th>Módulo</th>
              <th>Método</th>
              <th>Ruta</th>
              <th>Resumen</th>
              <th>Riesgo</th>
              <th>Permiso</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {endpointsFiltrados.map((endpoint) => (
              <tr key={`${endpoint.metodo}-${endpoint.ruta}`}>
                <td>{endpoint.modulo}</td>
                <td>
                  <Chip tono="categoria" className={metodoClase[endpoint.metodo as Metodo] ?? 'chip-neutro'}>
                    {endpoint.metodo}
                  </Chip>
                </td>
                <td className="font-mono">
                  {endpoint.ruta}
                  {endpoint.requiere_aplicacion && (
                    <span className="ml-1 text-2xs text-slate-400" title="Exige X-Aplicacion">
                      ⚙
                    </span>
                  )}
                </td>
                <td>{endpoint.resumen ?? endpoint.enriquecimiento?.descripcion ?? '—'}</td>
                <td>
                  <Chip tono={RIESGO_TONO[endpoint.riesgo]}>{RIESGO_ETIQUETA[endpoint.riesgo]}</Chip>
                </td>
                <td className="font-mono text-xs">{endpoint.permiso ?? '—'}</td>
                <td className="text-center">
                  <button onClick={() => setSeleccionado(endpoint)} className="enlace-accion">
                    Probar
                  </button>
                </td>
              </tr>
            ))}
            {!cargandoCatalogo && endpointsFiltrados.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-slate-400">
                  Sin operaciones que coincidan con el filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TablaScroll>

      {seleccionado && <ProbadorEndpoint endpoint={seleccionado} onCerrar={() => setSeleccionado(null)} />}
    </section>
  )
}
