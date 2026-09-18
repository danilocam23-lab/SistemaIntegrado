// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Boton, Selector } from '../../components/ui'
import type { EstadoAdminEndpoints } from './useAdminEndpoints'

type Props = EstadoAdminEndpoints

export function FormularioReasignacion({
  apps,
  nuevaAplicacion,
  setNuevaAplicacion,
  identificador,
  cargandoReasig,
  ejecutarReasignacion,
}: Props) {
  return (
    <form onSubmit={ejecutarReasignacion} className="tarjeta tarjeta-pad">
      <h2 className="titulo-seccion mb-3">Reasignar aplicación</h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Nueva aplicación</span>
          <Selector
            value={nuevaAplicacion}
            onChange={(e) => setNuevaAplicacion(e.target.value)}
            required
            className="min-w-64"
          >
            <option value="">Seleccione una aplicación</option>
            {apps.map((a) => (
              <option key={a.codigo} value={a.codigo}>
                {a.nombre} ({a.codigo})
              </option>
            ))}
          </Selector>
        </label>
        <Boton
          variante="alerta"
          type="submit"
          disabled={cargandoReasig || !identificador.trim()}
        >
          {cargandoReasig ? 'Reasignando...' : 'Reasignar'}
        </Boton>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        POST /api/requerimientos/{'{codigo_req}'}/reasignar-aplicacion?nueva_aplicacion=...
      </p>
    </form>
  )
}
