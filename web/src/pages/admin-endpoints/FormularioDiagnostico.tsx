import { Boton, Campo } from '../../components/ui'
import type { EstadoAdminEndpoints } from './useAdminEndpoints'

type Props = EstadoAdminEndpoints

export function FormularioDiagnostico({
  identificador,
  setIdentificador,
  cargandoDiag,
  ejecutarDiagnostico,
}: Props) {
  return (
    <form onSubmit={ejecutarDiagnostico} className="tarjeta tarjeta-pad">
      <h2 className="titulo-seccion mb-3">Diagnóstico</h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Código REQ o SC</span>
          <Campo
            value={identificador}
            onChange={(e) => setIdentificador(e.target.value)}
            placeholder="Ej: 10813 o REQ-123"
            required
            className="min-w-64"
          />
        </label>
        <Boton
          variante="primario"
          type="submit"
          disabled={cargandoDiag}
        >
          {cargandoDiag ? 'Consultando...' : 'Consultar diagnóstico'}
        </Boton>
      </div>
      <p className="mt-2 text-xs text-slate-500">GET /api/requerimientos/{'{codigo_req}'}/diagnostico</p>
    </form>
  )
}
