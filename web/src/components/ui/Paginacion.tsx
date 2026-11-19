// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import type { IdControl } from '../../analitica/catalogo'
import type { RangoPagina } from '../../utils/paginacion'
import { Boton } from './primitivos'

interface IdsPaginacion {
  primera: IdControl
  anterior: IdControl
  siguiente: IdControl
  ultima: IdControl
}

interface Props {
  rango: RangoPagina
  onCambiarPagina: (pagina: number) => void
  /** Plural de lo que se pagina: "requerimientos", "entregas". */
  etiqueta: string
  ids: IdsPaginacion
}

/** Controles de paginación con "Mostrando X–Y de N". Visible siempre que haya filas,
 *  para que el rango se vea aunque solo exista una página. */
export function Paginacion({ rango, onCambiarPagina, etiqueta, ids }: Props) {
  const { pagina, totalPaginas, desde, hasta, total } = rango
  if (total === 0) return null
  return (
    <nav aria-label={`Paginación de ${etiqueta}`} className="flex flex-wrap items-center justify-center gap-2 py-3">
      {totalPaginas > 1 && (
        <>
          <Boton data-analytics-id={ids.primera} variante="secundario" tamano="sm" onClick={() => onCambiarPagina(1)} disabled={pagina <= 1} aria-label="Primera página">
            «
          </Boton>
          <Boton data-analytics-id={ids.anterior} variante="secundario" tamano="sm" onClick={() => onCambiarPagina(pagina - 1)} disabled={pagina <= 1}>
            ‹ Anterior
          </Boton>
        </>
      )}
      <span className="text-sm font-medium text-slate-700" aria-live="polite">
        Mostrando {desde}–{hasta} de {total} {etiqueta}
        {totalPaginas > 1 && ` · Página ${pagina} / ${totalPaginas}`}
      </span>
      {totalPaginas > 1 && (
        <>
          <Boton data-analytics-id={ids.siguiente} variante="secundario" tamano="sm" onClick={() => onCambiarPagina(pagina + 1)} disabled={pagina >= totalPaginas}>
            Siguiente ›
          </Boton>
          <Boton data-analytics-id={ids.ultima} variante="secundario" tamano="sm" onClick={() => onCambiarPagina(totalPaginas)} disabled={pagina >= totalPaginas} aria-label="Última página">
            »
          </Boton>
        </>
      )}
    </nav>
  )
}
