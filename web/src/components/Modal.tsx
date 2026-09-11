import type { ReactNode } from 'react'

type AnchoModal = 'md' | 'xl' | 'completo'

const ANCHOS: Record<AnchoModal, string> = {
  md: 'max-w-lg',
  xl: 'max-w-4xl',
  completo: 'max-w-7xl',
}

interface Props {
  titulo: ReactNode
  /** Línea secundaria bajo el título (p. ej. archivo/fecha de una estimación). */
  subtitulo?: ReactNode
  /** Insignia a la izquierda del título. */
  icono?: ReactNode
  /** Botonera adicional en la cabecera, antes del botón de cerrar. */
  acciones?: ReactNode
  abierto: boolean
  onCerrar: () => void
  /** Ancho del panel: 'md' (por defecto, el de siempre) | 'xl' | 'completo'. */
  ancho?: AnchoModal
  /** Clases extra para el cuerpo (p. ej. `bg-slate-50` en modales con paneles internos). */
  claseCuerpo?: string
  children: ReactNode
}

/** Ventana modal reutilizable. Se cierra al hacer clic fuera o en la ✕.
 *  `subtitulo`/`icono`/`acciones`/`ancho`/`claseCuerpo` son opcionales y no afectan a los
 *  consumidores existentes (piensan en formularios simples); las cabeceras más ricas, como
 *  la del modal de estimación de Requerimientos, los usan. */
export default function Modal({
  titulo, subtitulo, icono, acciones, abierto, onCerrar, ancho = 'md', claseCuerpo, children,
}: Props) {
  if (!abierto) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-2 sm:items-center sm:p-4"
      onClick={onCerrar}
    >
      <div
        className={`flex max-h-[92vh] w-full ${ANCHOS[ancho]} flex-col overflow-hidden rounded-xl bg-white shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            {icono && (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-marca-50 text-marca-700">
                {icono}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="min-w-0 truncate font-semibold text-marca-osc">{titulo}</h2>
              {subtitulo && <p className="truncate text-sm text-slate-600">{subtitulo}</p>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {acciones}
            <button
              type="button"
              onClick={onCerrar}
              className="text-lg leading-none text-slate-400 hover:text-slate-700"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>
        <div className={`max-h-[calc(92vh-56px)] flex-1 overflow-y-auto p-4 sm:p-5${claseCuerpo ? ` ${claseCuerpo}` : ''}`}>
          {children}
        </div>
      </div>
    </div>
  )
}
