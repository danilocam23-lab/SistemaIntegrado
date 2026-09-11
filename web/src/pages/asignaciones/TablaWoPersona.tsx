import { TablaScroll } from '../../components/ui/primitivos'
import type { WoPersona } from './tipos'

interface Props {
  wos: WoPersona[]
}

/**
 * Tabla de solicitudes de soporte (WO) de una persona, dentro de la vista
 * "Por Personas". Si la persona no tiene WOs, no se muestra nada
 * (comportamiento vigente).
 */
export function TablaWoPersona({ wos }: Props) {
  if (wos.length === 0) return null

  return (
    <div className="border-t bg-emerald-50/50 px-3 py-2">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Solicitudes Soporte WO ({wos.length})</p>
      <TablaScroll plano>
        <table className="w-full text-left text-xs">
          <thead className="text-emerald-700">
            <tr>
              <th className="px-2 py-1">WO ID</th>
              <th className="px-2 py-1">Estado</th>
              <th className="px-2 py-1">Prioridad</th>
              <th className="px-2 py-1">Fecha</th>
              <th className="px-2 py-1">Descripción</th>
            </tr>
          </thead>
          <tbody>
            {wos.map((wo) => (
              <tr key={wo.id} className="border-t border-emerald-100">
                <td className="px-2 py-1 font-mono font-medium">{wo.wo_id}</td>
                <td className="px-2 py-1">{wo.status}</td>
                <td className="px-2 py-1">{wo.priority}</td>
                <td className="px-2 py-1">{wo.created_date}</td>
                <td className="px-2 py-1 max-w-[200px] truncate">{wo.descripcion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TablaScroll>
    </div>
  )
}
