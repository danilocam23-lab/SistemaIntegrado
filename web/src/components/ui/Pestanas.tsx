// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useCallback } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Chip, cx } from './primitivos'

export interface DefinicionPestana {
  /** Identificador estable. Si se usa con `usePestanaEnHash`, solo ASCII y minúsculas. */
  id: string
  etiqueta: string
  /** Contador junto a la etiqueta (p. ej. cantidad de entregas). */
  contador?: number
  /** Punto de aviso (algo pendiente en esta pestaña); `textoAviso` lo describe a lectores de pantalla. */
  aviso?: boolean
  textoAviso?: string
  /** Pestaña no disponible (p. ej. sin permiso): no se dibuja. */
  oculta?: boolean
}

const idPestana = (prefijo: string, id: string) => `${prefijo}-tab-${id}`
const idPanel = (prefijo: string, id: string) => `${prefijo}-panel-${id}`

interface PropsPestanas {
  /** Prefijo único de este grupo; enlaza cada pestaña con su `PanelPestana`. */
  prefijo: string
  etiqueta: string
  pestanas: DefinicionPestana[]
  activa: string
  onCambiar: (id: string) => void
  className?: string
}

/**
 * Lista de pestañas accesible (role tablist/tab, flechas, Inicio/Fin). Es controlada y
 * solo dibuja la barra: cada contenido va en un `PanelPestana`, que se mantiene montado
 * (oculto) para no perder lo escrito al cambiar de pestaña.
 */
export function Pestanas({ prefijo, etiqueta, pestanas, activa, onCambiar, className }: PropsPestanas) {
  const visibles = pestanas.filter((p) => !p.oculta)

  function alTeclear(e: KeyboardEvent<HTMLButtonElement>, indice: number): void {
    let destino: number | null = null
    if (e.key === 'ArrowRight') destino = (indice + 1) % visibles.length
    else if (e.key === 'ArrowLeft') destino = (indice - 1 + visibles.length) % visibles.length
    else if (e.key === 'Home') destino = 0
    else if (e.key === 'End') destino = visibles.length - 1
    if (destino === null) return
    e.preventDefault()
    const id = visibles[destino].id
    onCambiar(id)
    document.getElementById(idPestana(prefijo, id))?.focus()
  }

  return (
    <div className={cx('pestanas flex-nowrap overflow-x-auto', className)} role="tablist" aria-label={etiqueta}>
      {visibles.map((p, i) => {
        const seleccionada = p.id === activa
        return (
          <button
            key={p.id}
            type="button"
            role="tab"
            id={idPestana(prefijo, p.id)}
            aria-selected={seleccionada}
            aria-controls={idPanel(prefijo, p.id)}
            tabIndex={seleccionada ? 0 : -1}
            className={cx('pestana', seleccionada && 'pestana-activa')}
            onClick={() => onCambiar(p.id)}
            onKeyDown={(e) => alTeclear(e, i)}
          >
            {p.etiqueta}
            {p.contador !== undefined && <Chip tono="neutro">{p.contador}</Chip>}
            {p.aviso && (
              <>
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="sr-only">{p.textoAviso ?? 'Pendiente'}</span>
              </>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Contenido de una pestaña. Siempre montado; se oculta con `hidden` si no es la activa. */
export function PanelPestana({
  prefijo,
  id,
  activa,
  children,
  className,
}: {
  prefijo: string
  id: string
  activa: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      role="tabpanel"
      id={idPanel(prefijo, id)}
      aria-labelledby={idPestana(prefijo, id)}
      hidden={id !== activa}
      className={className}
    >
      {children}
    </div>
  )
}

/**
 * Pestaña activa guardada en `location.hash` (`#entregas`), para poder compartir el enlace.
 * Un hash desconocido cae en `porDefecto`. Cambiar de pestaña reemplaza la entrada del
 * historial (no apila una por clic).
 */
export function usePestanaEnHash(ids: string[], porDefecto: string): [string, (id: string) => void] {
  const { hash } = useLocation()
  const navigate = useNavigate()
  const candidata = decodeURIComponent(hash.replace(/^#/, '')).toLowerCase()
  const activa = ids.includes(candidata) ? candidata : porDefecto
  const cambiar = useCallback(
    (id: string) => navigate({ hash: `#${id}` }, { replace: true }),
    [navigate],
  )
  return [activa, cambiar]
}
