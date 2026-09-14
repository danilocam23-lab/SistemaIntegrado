import { useState } from 'react'
import { Aviso, Boton, Chip } from '../../components/ui'
import type { ResultadoInvocacion } from './invocacion'
import type { EstadoAdminEndpoints } from './useAdminEndpoints'

type PropsLegado = Pick<EstadoAdminEndpoints, 'ok' | 'error' | 'resultado'>

/** Metadatos de una invocación en vivo del catálogo (F4.8, ADR-0008). */
export interface InvocacionParaPanel {
  metodo: string
  ruta: string
  modulo: string
  operationId: string | null
  permiso: string | null
  curl: string
  respuesta: ResultadoInvocacion
}

type Props = Partial<PropsLegado> & { invocacion?: InvocacionParaPanel }

/** 2xx éxito, 4xx alerta, 5xx error — mismo criterio semántico del ADR-0007. */
function tonoPorEstadoHttp(estadoHttp: number | null): 'exito' | 'alerta' | 'error' | 'neutro' {
  if (estadoHttp === null) return 'error'
  if (estadoHttp >= 200 && estadoHttp < 300) return 'exito'
  if (estadoHttp >= 400 && estadoHttp < 500) return 'alerta'
  if (estadoHttp >= 500) return 'error'
  return 'neutro'
}

/**
 * Aviso de éxito/error y respuesta cruda (JSON) de la última acción ejecutada.
 * Con `invocacion` (probador de endpoints del catálogo) suma el status con tono
 * semántico, la latencia medida en el cliente, el `curl` equivalente (sin token,
 * copiable) y un enlace al contrato crudo de `/docs`.
 */
export function PanelResultado({ ok, error, resultado, invocacion }: Props) {
  const [copiado, setCopiado] = useState(false)

  async function copiarCurl(): Promise<void> {
    if (!invocacion) return
    try {
      await navigator.clipboard.writeText(invocacion.curl)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      setCopiado(false)
    }
  }

  const cuerpo = invocacion ? invocacion.respuesta.cuerpo : resultado

  return (
    <>
      {!invocacion && ok && <Aviso tono="exito">{ok}</Aviso>}
      {!invocacion && error && <Aviso tono="error">{error}</Aviso>}

      {invocacion && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm">
          <Chip tono={tonoPorEstadoHttp(invocacion.respuesta.estadoHttp)}>
            {invocacion.respuesta.estadoHttp ?? 'Sin respuesta'} {invocacion.respuesta.estadoTexto}
          </Chip>
          <span className="text-slate-500">{invocacion.respuesta.latenciaMs} ms</span>
          <span className="font-mono text-xs text-slate-500">
            Permiso: {invocacion.permiso ?? 'ninguno'}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Boton tamano="sm" variante="secundario" onClick={copiarCurl}>
              {copiado ? 'Copiado' : 'Copiar curl'}
            </Boton>
            {invocacion.operationId && (
              <a
                className="enlace-accion"
                href={`${import.meta.env.BASE_URL}docs#/${invocacion.modulo}/${invocacion.operationId}`}
                target="_blank"
                rel="noreferrer"
              >
                Ver en /docs
              </a>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-slate-900 p-4 text-sm text-slate-100">
        <div className="mb-2 font-semibold">Respuesta</div>
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words">
          {cuerpo !== undefined && cuerpo !== null ? JSON.stringify(cuerpo, null, 2) : 'Sin resultados todavía.'}
        </pre>
      </div>
    </>
  )
}
