import type { ReactNode } from 'react'

interface Props {
  titulo: string
  abierto: boolean
  onCerrar: () => void
  children: ReactNode
}

/** Ventana modal reutilizable. Se cierra al hacer clic fuera o en la ✕. */
export default function Modal({ titulo, abierto, onCerrar, children }: Props) {
  if (!abierto) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-2 sm:items-center sm:p-4"
      onClick={onCerrar}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
          <h2 className="min-w-0 truncate font-semibold text-marca-osc">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            className="text-lg leading-none text-slate-400 hover:text-slate-700"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[calc(92vh-56px)] overflow-y-auto p-4 sm:p-5">{children}</div>
      </div>
    </div>
  )
}
