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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="font-semibold text-marca-osc">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            className="text-lg leading-none text-slate-400 hover:text-slate-700"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
