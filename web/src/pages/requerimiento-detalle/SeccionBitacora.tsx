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
              <button
                onClick={() => { void onEliminar(ev.id) }}
                className="btn btn-peligro shrink-0"
                title="Eliminar evento"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </li>
        ))}
        {eventos.length === 0 && <li className="text-slate-400">Sin eventos.</li>}
      </ul>
    </div>
  )
}
