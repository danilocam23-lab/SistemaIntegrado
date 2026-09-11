import { Chip, TablaScroll } from '../../components/ui'
import type { Entrega } from '../../types'

const TONO_ESTADO_ENTREGA: Record<string, 'exito' | 'alerta' | 'error'> = {
  Aprobada: 'exito',
  'En revisión': 'alerta',
  Rechazada: 'error',
}

interface SubfilaEntregasProps {
  reqId: string
  entregas: Entrega[]
  expandido: boolean
  /** INVARIANTE 12: se inyecta desde `useCamposRequerimientos` (vía `TablaRequerimientos`);
   *  no se recalcula aquí. */
  totalColumnasTabla: number
}

/** Sub-fila de detalle de entregas de un requerimiento, condicional a
 *  `expandedEntregas.has(id)` (estado que vive en el shell hasta la fase 9). */
export function SubfilaEntregas({ reqId, entregas, expandido, totalColumnasTabla }: SubfilaEntregasProps) {
  if (!expandido || !(entregas?.length > 0)) return null
  return (
    <tr key={`${reqId}-entregas`}>
      <td colSpan={totalColumnasTabla} className="p-0">
        <div className="border-l-4 border-emerald-400 bg-emerald-50/40 px-4 py-2">
          <TablaScroll plano>
            <table className="tabla text-xs">
              <thead>
                <tr>
                  <th className="text-left"># Entrega</th>
                  <th className="text-right">Horas</th>
                  <th className="text-center">Fecha comprometida</th>
                  <th className="text-center">Fecha recepción</th>
                  <th className="text-center">Estado</th>
                  <th className="text-center">Garantía</th>
                </tr>
              </thead>
              <tbody>
                {entregas.map((en) => (
                  <tr key={en.numero}>
                    <td className="font-medium text-slate-800">
                      <span className="text-emerald-500">▸</span> Entrega {en.numero}
                    </td>
                    <td className="text-right">{en.horas ?? '—'}</td>
                    <td className="text-center">{en.fecha_comprometida ?? '—'}</td>
                    <td className="text-center">{en.fecha_recepcion ?? '—'}</td>
                    <td className="text-center">
                      {en.estado ? <Chip tono={TONO_ESTADO_ENTREGA[en.estado] ?? 'neutro'}>{en.estado}</Chip> : '—'}
                    </td>
                    <td className="text-center">{en.garantia ? '✔' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TablaScroll>
        </div>
      </td>
    </tr>
  )
}
