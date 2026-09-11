import type { Entrega } from '../../types'

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
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500">
                <th className="px-3 py-1.5 text-left font-semibold"># Entrega</th>
                <th className="px-3 py-1.5 text-right font-semibold">Horas</th>
                <th className="px-3 py-1.5 text-center font-semibold">Fecha comprometida</th>
                <th className="px-3 py-1.5 text-center font-semibold">Fecha recepción</th>
                <th className="px-3 py-1.5 text-center font-semibold">Estado</th>
                <th className="px-3 py-1.5 text-center font-semibold">Garantía</th>
              </tr>
            </thead>
            <tbody>
              {entregas.map((en) => (
                <tr key={en.numero} className="border-t border-emerald-200 hover:bg-white/60">
                  <td className="px-3 py-1.5 font-medium text-slate-800">
                    <span className="text-emerald-500">▸</span> Entrega {en.numero}
                  </td>
                  <td className="px-3 py-1.5 text-right">{en.horas ?? '—'}</td>
                  <td className="px-3 py-1.5 text-center">{en.fecha_comprometida ?? '—'}</td>
                  <td className="px-3 py-1.5 text-center">{en.fecha_recepcion ?? '—'}</td>
                  <td className="px-3 py-1.5 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      en.estado === 'Aprobada' ? 'bg-green-100 text-green-700' :
                      en.estado === 'En revisión' ? 'bg-amber-100 text-amber-700' :
                      en.estado === 'Rechazada' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {en.estado ?? '—'}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-center">{en.garantia ? '✔' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  )
}
