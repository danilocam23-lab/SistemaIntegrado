import { Chip } from '../../components/ui'
import type { Entrega } from '../../types'

interface Props {
  squadNombre: string
  cumpleAnsEstimacion: boolean | null
  ultimaEntrega: Entrega | null
  cantidadEntregas: number
}

/**
 * Panel lateral de resumen del requerimiento: squad, ANS de estimación, ANS
 * de la última entrega y cantidad de entregas. Todos son datos que ya se
 * calculan/muestran en otras secciones de la página (Datos generales y
 * Entregas); aquí solo se repiten en formato de lectura rápida, sin
 * recalcular ni traer nada nuevo del backend.
 */
export default function SeccionResumen({
  squadNombre,
  cumpleAnsEstimacion,
  ultimaEntrega,
  cantidadEntregas,
}: Props) {
  return (
    <div className="tarjeta tarjeta-pad h-fit">
      <h2 className="etiqueta-sup mb-3">Resumen</h2>
      <dl className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500">Squad</dt>
          <dd className="text-right font-medium text-slate-800">{squadNombre || '—'}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500">ANS estimación</dt>
          <dd>
            <Chip tono={cumpleAnsEstimacion === true ? 'exito' : cumpleAnsEstimacion === false ? 'error' : 'neutro'}>
              {cumpleAnsEstimacion === true ? 'Cumple' : cumpleAnsEstimacion === false ? 'No cumple' : '—'}
            </Chip>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500">ANS entrega (última)</dt>
          <dd>
            {ultimaEntrega?.ans_entrega === 'CUMPLE' ? (
              <Chip tono="exito">Cumple</Chip>
            ) : ultimaEntrega?.ans_entrega === 'NO_CUMPLE' ? (
              <Chip tono="error">No cumple</Chip>
            ) : (
              <Chip tono="neutro">—</Chip>
            )}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500">Entregas</dt>
          <dd className="font-medium text-slate-800">{cantidadEntregas}</dd>
        </div>
      </dl>
    </div>
  )
}
