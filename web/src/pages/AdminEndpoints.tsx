// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { EncabezadoPagina } from '../components/ui'
import { FormularioDiagnostico } from './admin-endpoints/FormularioDiagnostico'
import { FormularioReasignacion } from './admin-endpoints/FormularioReasignacion'
import { PanelResultado } from './admin-endpoints/PanelResultado'
import { SeccionCatalogoEndpoints } from './admin-endpoints/SeccionCatalogoEndpoints'
import { SeccionDocumentacion } from './admin-endpoints/SeccionDocumentacion'
import { SeccionPruebasIntegracion } from './admin-endpoints/SeccionPruebasIntegracion'
import { useAdminEndpoints } from './admin-endpoints/useAdminEndpoints'

export default function AdminEndpoints() {
  const estado = useAdminEndpoints()

  return (
    <div className="space-y-5">
      <EncabezadoPagina
        titulo="Administración de Endpoints"
        descripcion={(
          <>
            Panel operativo y documentación de rutas FastAPI. Las acciones administrativas de requerimientos
            envían <code>X-Aplicacion: __todas__</code> para trabajar en modo consolidado.
          </>
        )}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <FormularioDiagnostico {...estado} />
        <FormularioReasignacion {...estado} />
      </div>

      <SeccionPruebasIntegracion {...estado} />

      <PanelResultado ok={estado.ok} error={estado.error} resultado={estado.resultado} />

      <SeccionCatalogoEndpoints {...estado} />

      <SeccionDocumentacion {...estado} />
    </div>
  )
}
