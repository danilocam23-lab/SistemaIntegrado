import { Boton, Icono } from '../../components/ui'
import type { EventoBitacora } from '../../types'

interface Props {
  eventos: EventoBitacora[]
  puedeEliminar: boolean
  onEliminar: (eventoId: string) => void
}

export default function SeccionBitacora({ eventos, puedeEliminar, onEliminar }: Props) {
  return (
    <div className="tarjeta tarjeta-pad">
      <h2 className="etiqueta-sup mb-3">
        Bitácora
      </h2>
      <ul className="space-y-1 text-sm">
        {eventos.map((ev) => (
          <li key={ev.id} className="flex items-start justify-between gap-2 border-b py-1 last:border-0">
            <span>
              <span className="text-slate-400">{ev.creado_en?.slice(0, 19).replace('T', ' ')}</span>
              {' · '}<b>{ev.accion}</b> · {ev.descripcion}
              {ev.autor ? <span className="text-slate-400"> ({ev.autor})</span> : null}
            </span>
            {puedeEliminar && (
              <Boton
                variante="peligro"
                className="shrink-0"
                onClick={() => { void onEliminar(ev.id) }}
                title="Eliminar evento"
              >
                <Icono nombre="x" />
              </Boton>
            )}
          </li>
        ))}
        {eventos.length === 0 && <li className="text-slate-400">Sin eventos.</li>}
      </ul>
    </div>
  )
}
