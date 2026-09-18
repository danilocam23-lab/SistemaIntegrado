// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import Modal from '../../components/Modal'
import { Aviso, Boton, Campo, Chip } from '../../components/ui'
import { metodoClase } from './catalogoEndpoints'
import { FormularioInvocacion } from './FormularioInvocacion'
import { PanelResultado } from './PanelResultado'
import { RIESGO_ETIQUETA, RIESGO_TONO } from './tipos'
import type { Metodo } from './tipos'
import { useProbadorEndpoint } from './useProbadorEndpoint'
import type { EndpointCatalogo } from '../../types'

interface Props {
  endpoint: EndpointCatalogo
  onCerrar: () => void
}

/**
 * Modal de prueba en vivo de un endpoint del catálogo (F4.6-F4.8, ADR-0008):
 * formulario generado desde el esquema, compuerta de riesgo proporcional
 * (`seguro` ejecuta directo, `mutante` confirma, `destructivo` exige teclear la
 * ruta) y panel de resultado con status, latencia y `curl` copiable.
 */
export function ProbadorEndpoint({ endpoint, onCerrar }: Props) {
  const estado = useProbadorEndpoint(endpoint)
  const etiquetaRiesgo = RIESGO_ETIQUETA[endpoint.riesgo].toLowerCase()

  return (
    <Modal
      titulo={
        <span className="flex min-w-0 items-center gap-2">
          <Chip tono="categoria" className={metodoClase[endpoint.metodo as Metodo] ?? 'chip-neutro'}>
            {endpoint.metodo}
          </Chip>
          <span className="truncate font-mono text-sm">{endpoint.ruta}</span>
        </span>
      }
      subtitulo={endpoint.resumen ?? undefined}
      abierto
      onCerrar={onCerrar}
      ancho="xl"
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Chip tono={RIESGO_TONO[endpoint.riesgo]}>{RIESGO_ETIQUETA[endpoint.riesgo]}</Chip>
        {endpoint.permiso && <Chip tono="neutro">Permiso: {endpoint.permiso}</Chip>}
        {endpoint.requiere_aplicacion && <Chip tono="neutro">Requiere X-Aplicacion</Chip>}
      </div>

      {!estado.puedeProbar && (
        <Aviso tono="alerta" className="mb-4">
          No tienes el permiso <code>admin.endpoints.probar</code>: puedes ver la documentación de este
          endpoint pero no ejecutarlo.
        </Aviso>
      )}

      <FormularioInvocacion endpoint={endpoint} estado={estado} />

      <div className="mt-4 flex justify-end">
        <Boton
          variante={endpoint.riesgo === 'destructivo' ? 'peligro' : 'primario'}
          disabled={!estado.puedeEjecutar}
          onClick={estado.intentarEjecutar}
        >
          {estado.ejecutando ? 'Ejecutando...' : 'Ejecutar'}
        </Boton>
      </div>

      {estado.resultado && (
        <div className="mt-4">
          <PanelResultado
            invocacion={{
              metodo: endpoint.metodo,
              ruta: endpoint.ruta,
              modulo: endpoint.modulo,
              operationId: endpoint.operation_id,
              permiso: endpoint.permiso,
              curl: estado.curl,
              respuesta: estado.resultado,
            }}
          />
        </div>
      )}

      {estado.confirmando && (
        <Modal
          titulo={`Confirmar operación ${etiquetaRiesgo}`}
          abierto
          onCerrar={estado.cancelarConfirmacion}
          ancho="md"
        >
          <div className="space-y-3">
            <Aviso tono={endpoint.riesgo === 'destructivo' ? 'error' : 'alerta'}>
              {endpoint.riesgo === 'destructivo' ? (
                <>
                  Esta acción es <strong>destructiva</strong>: <code>{endpoint.metodo} {endpoint.ruta}</code>{' '}
                  puede borrar datos o disparar una sincronización irreversible. Escribe la ruta completa para
                  confirmar que entiendes lo que va a pasar.
                </>
              ) : (
                <>
                  Vas a ejecutar <code>{endpoint.metodo} {endpoint.ruta}</code>, una operación que modifica
                  datos. ¿Confirmas?
                </>
              )}
            </Aviso>
            {endpoint.riesgo === 'destructivo' && (
              <Campo
                etiqueta={`Escribe «${endpoint.ruta}» para confirmar`}
                value={estado.rutaConfirmacion}
                onChange={(e) => estado.setRutaConfirmacion(e.target.value)}
                placeholder={endpoint.ruta}
                className="font-mono"
              />
            )}
            <div className="flex justify-end gap-2">
              <Boton variante="secundario" onClick={estado.cancelarConfirmacion}>
                Cancelar
              </Boton>
              <Boton
                variante={endpoint.riesgo === 'destructivo' ? 'peligro' : 'primario'}
                disabled={!estado.confirmacionValida || estado.ejecutando}
                onClick={estado.confirmar}
              >
                {estado.ejecutando ? 'Ejecutando...' : 'Confirmar y ejecutar'}
              </Boton>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  )
}
