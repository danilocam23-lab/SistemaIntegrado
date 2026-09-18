// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Campo } from '../../components/ui'
import { FormularioProbarIntegracion } from './FormularioProbarIntegracion'
import type { EstadoAdminEndpoints } from './useAdminEndpoints'

type Props = EstadoAdminEndpoints

/** Los cuatro formularios de "probar integración" de `/api/integracion/*`, uno por endpoint. */
export function SeccionPruebasIntegracion({
  apps,
  apiKeyIntegracion,
  setApiKeyIntegracion,
  aplicacionIntegracion,
  setAplicacionIntegracion,
  cargandoEntregas,
  probarEntregasIntegracion,
  apiKeyRequerimientosIntegracion,
  setApiKeyRequerimientosIntegracion,
  aplicacionRequerimientosIntegracion,
  setAplicacionRequerimientosIntegracion,
  estadoRequerimientosIntegracion,
  setEstadoRequerimientosIntegracion,
  cargandoRequerimientosIntegracion,
  probarRequerimientosIntegracion,
  apiKeySolicitudesIntegracion,
  setApiKeySolicitudesIntegracion,
  aplicacionSolicitudesIntegracion,
  setAplicacionSolicitudesIntegracion,
  cargandoSolicitudesIntegracion,
  probarSolicitudesIntegracion,
  cargandoSolicitudesEntregasIntegracion,
  probarSolicitudesEntregasIntegracion,
}: Props) {
  return (
    <>
      <FormularioProbarIntegracion
        titulo="Probar integración de entregas"
        descripcion={
          <>
            GET /api/integracion/entregas — solo requerimientos en estado ESTIMACION APROBADA ENTREGA PENDIENTE
            y entregas en estado Pendiente.
          </>
        }
        etiquetaApiKey="X-API-Key"
        placeholderApiKey="Clave configurada en API_KEY"
        apiKey={apiKeyIntegracion}
        onApiKeyChange={setApiKeyIntegracion}
        apps={apps}
        aplicacion={aplicacionIntegracion}
        onAplicacionChange={setAplicacionIntegracion}
        cargando={cargandoEntregas}
        onSubmit={probarEntregasIntegracion}
        urlPreview={`/api/integracion/entregas${aplicacionIntegracion ? `?aplicacion=${aplicacionIntegracion}` : ''}`}
      />

      <FormularioProbarIntegracion
        titulo="Probar integración de requerimientos"
        descripcion={
          <>
            GET /api/integracion/requerimientos — requiere API_KEY_REQUERIMIENTOS y permite filtrar por aplicación
            o estado del requerimiento. No usa la API_KEY de entregas.
          </>
        }
        etiquetaApiKey="X-API-Key requerimientos"
        placeholderApiKey="Clave configurada en API_KEY_REQUERIMIENTOS"
        apiKey={apiKeyRequerimientosIntegracion}
        onApiKeyChange={setApiKeyRequerimientosIntegracion}
        apps={apps}
        aplicacion={aplicacionRequerimientosIntegracion}
        onAplicacionChange={setAplicacionRequerimientosIntegracion}
        campoExtra={
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Estado (opcional)</span>
            <Campo
              value={estadoRequerimientosIntegracion}
              onChange={(e) => setEstadoRequerimientosIntegracion(e.target.value)}
              placeholder="Ej: ESTIMACION APROBADA ENTREGA PENDIENTE"
              className="min-w-80"
            />
          </label>
        }
        cargando={cargandoRequerimientosIntegracion}
        onSubmit={probarRequerimientosIntegracion}
        urlPreview={
          <>
            /api/integracion/requerimientos
            {aplicacionRequerimientosIntegracion || estadoRequerimientosIntegracion.trim() ? '?' : ''}
            {[
              aplicacionRequerimientosIntegracion ? `aplicacion=${aplicacionRequerimientosIntegracion}` : '',
              estadoRequerimientosIntegracion.trim() ? `estado=${estadoRequerimientosIntegracion.trim()}` : '',
            ].filter(Boolean).join('&')}
          </>
        }
      />

      <FormularioProbarIntegracion
        titulo="Probar integración de solicitudes dashboard"
        descripcion={
          <>
            GET /api/integracion/solicitudes — devuelve fecha y hora de solicitud, Código SC y Código REQ.
            Requiere API_KEY_SOLICITUDES (clave independiente de entregas y requerimientos).
          </>
        }
        etiquetaApiKey="X-API-Key solicitudes"
        placeholderApiKey="Clave configurada en API_KEY_SOLICITUDES"
        apiKey={apiKeySolicitudesIntegracion}
        onApiKeyChange={setApiKeySolicitudesIntegracion}
        apps={apps}
        aplicacion={aplicacionSolicitudesIntegracion}
        onAplicacionChange={setAplicacionSolicitudesIntegracion}
        cargando={cargandoSolicitudesIntegracion}
        onSubmit={probarSolicitudesIntegracion}
        urlPreview={`/api/integracion/solicitudes${aplicacionSolicitudesIntegracion ? `?aplicacion=${aplicacionSolicitudesIntegracion}` : ''}`}
      />

      <FormularioProbarIntegracion
        titulo="Probar integración de entregas dashboard"
        descripcion={
          <>
            GET /api/integracion/solicitudes-entregas — devuelve Código SC, Código REQ, N° Entrega, Horas,
            F. Comprometida, F. Real, Estado, Mes de aprobación, ANS, Garantía y N° Garantía (fechas sin hora).
            Usa la misma API_KEY_SOLICITUDES.
          </>
        }
        etiquetaApiKey="X-API-Key solicitudes"
        placeholderApiKey="Clave configurada en API_KEY_SOLICITUDES"
        apiKey={apiKeySolicitudesIntegracion}
        onApiKeyChange={setApiKeySolicitudesIntegracion}
        apps={apps}
        aplicacion={aplicacionSolicitudesIntegracion}
        onAplicacionChange={setAplicacionSolicitudesIntegracion}
        cargando={cargandoSolicitudesEntregasIntegracion}
        onSubmit={probarSolicitudesEntregasIntegracion}
        urlPreview={`/api/integracion/solicitudes-entregas${aplicacionSolicitudesIntegracion ? `?aplicacion=${aplicacionSolicitudesIntegracion}` : ''}`}
      />
    </>
  )
}
