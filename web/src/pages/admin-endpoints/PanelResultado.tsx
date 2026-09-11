import type { EstadoAdminEndpoints } from './useAdminEndpoints'

type Props = Pick<EstadoAdminEndpoints, 'ok' | 'error' | 'resultado'>

/** Aviso de éxito/error y respuesta cruda (JSON) de la última acción ejecutada. */
export function PanelResultado({ ok, error, resultado }: Props) {
  return (
    <>
      {ok && <div className="aviso aviso-exito">{ok}</div>}
      {error && <div className="aviso aviso-error">{error}</div>}

      <div className="rounded-xl border bg-slate-900 p-4 text-sm text-slate-100">
        <div className="mb-2 font-semibold">Respuesta</div>
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words">
          {resultado ? JSON.stringify(resultado, null, 2) : 'Sin resultados todavía.'}
        </pre>
      </div>
    </>
  )
}
