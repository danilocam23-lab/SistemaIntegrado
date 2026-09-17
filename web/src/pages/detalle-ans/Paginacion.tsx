import { Boton } from '../../components/ui'

interface Props {
  pagina: number
  totalPaginas: number
  onCambiarPagina: (pagina: number) => void
  totalRegistros: number
  etiqueta: string
}

/** Paginación client-side compartida por las listas densas de Requerimientos
 * y Entregas ANS — mismo patrón de controles que `ListaUsuarios.tsx`. */
export default function Paginacion({ pagina, totalPaginas, onCambiarPagina, totalRegistros, etiqueta }: Props) {
  if (totalPaginas <= 1) return null

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 border-t border-slate-100 px-4 py-3">
      <Boton variante="secundario" tamano="sm" onClick={() => onCambiarPagina(1)} disabled={pagina <= 1}>
        «
      </Boton>
      <Boton variante="secundario" tamano="sm" onClick={() => onCambiarPagina(pagina - 1)} disabled={pagina <= 1}>
        ‹ Anterior
      </Boton>
      <span className="text-sm font-medium text-slate-700">
        {pagina} / {totalPaginas} · {totalRegistros} {etiqueta}
      </span>
      <Boton variante="secundario" tamano="sm" onClick={() => onCambiarPagina(pagina + 1)} disabled={pagina >= totalPaginas}>
        Siguiente ›
      </Boton>
      <Boton variante="secundario" tamano="sm" onClick={() => onCambiarPagina(totalPaginas)} disabled={pagina >= totalPaginas}>
        »
      </Boton>
    </div>
  )
}
