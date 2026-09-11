import { TablaScroll } from '../../components/ui'
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
        <table className="tabla">
          <thead>
            <tr>
              <th className="text-left">WO ID</th>
              <th className="text-left">Estado</th>
              <th className="text-left">Prioridad</th>
              <th className="text-left">Fecha</th>
              <th className="text-left">Descripción</th>
            </tr>
          </thead>
          <tbody>
            {wos.map((wo) => (
              <tr key={wo.id}>
                <td className="font-mono font-medium">{wo.wo_id}</td>
                <td>{wo.status}</td>
                <td>{wo.priority}</td>
                <td>{wo.created_date}</td>
                <td className="max-w-[200px] truncate">{wo.descripcion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TablaScroll>
    </div>
  )
}
