// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Campo, cx, Icono } from '../../components/ui'

export interface OpcionCombobox {
  id: string
  etiqueta: string
  /** Texto secundario a la derecha (carga actual, estado…). */
  detalle?: ReactNode
}

interface Props {
  etiqueta: string
  /** Texto tras la etiqueta, p. ej. "(opcional)". */
  notaEtiqueta?: string
  opciones: OpcionCombobox[]
  /** Id seleccionado (`''` = ninguno). */
  valor: string
  onCambio: (id: string) => void
  placeholder?: string
  /** Máximo de opciones visibles (por rendimiento con listas largas). */
  maximo?: number
  vacio?: string
  compacto?: boolean
  className?: string
  autoFocus?: boolean
  /** Si es `false` no aparece la "x" para limpiar la selección. */
  limpiable?: boolean
}

/**
 * Selector de una opción con búsqueda por texto (combobox): escribe para filtrar,
 * flechas + Enter para elegir, Esc para cerrar la lista. Reemplaza al par
 * "buscar + dropdown" que hacía lo mismo con dos controles.
 */
export function Combobox({
  etiqueta,
  notaEtiqueta,
  opciones,
  valor,
  onCambio,
  placeholder,
  maximo = 30,
  vacio = 'Sin coincidencias.',
  compacto,
  className,
  autoFocus,
  limpiable = true,
}: Props) {
  const idLista = useId()
  const contenedor = useRef<HTMLDivElement | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [consulta, setConsulta] = useState('')
  const [activo, setActivo] = useState(0)

  const seleccionada = useMemo(() => opciones.find((o) => o.id === valor) ?? null, [opciones, valor])

  useEffect(() => {
    function cerrarAlHacerClicFuera(evento: MouseEvent) {
      if (contenedor.current && !contenedor.current.contains(evento.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', cerrarAlHacerClicFuera)
    return () => document.removeEventListener('mousedown', cerrarAlHacerClicFuera)
  }, [])

  const visibles = useMemo(() => {
    const filtro = consulta.trim().toLocaleLowerCase('es')
    const lista = filtro ? opciones.filter((o) => o.etiqueta.toLocaleLowerCase('es').includes(filtro)) : opciones
    return lista.slice(0, maximo)
  }, [consulta, maximo, opciones])

  function elegir(id: string) {
    onCambio(id)
    setConsulta('')
    setAbierto(false)
  }

  function alPulsarTecla(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'ArrowDown') {
      evento.preventDefault()
      setAbierto(true)
      setActivo((i) => Math.min(i + 1, visibles.length - 1))
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault()
      setActivo((i) => Math.max(i - 1, 0))
    } else if (evento.key === 'Enter' && abierto) {
      evento.preventDefault()
      const opcion = visibles[activo]
      if (opcion) elegir(opcion.id)
    } else if (evento.key === 'Escape' && abierto) {
      // No dejar que el Esc cierre también el panel que contiene este control.
      evento.stopPropagation()
      setAbierto(false)
      setConsulta('')
    }
  }

  return (
    <div ref={contenedor} className={cx('relative min-w-0 text-sm', className)}>
      <span className="etiqueta">
        {etiqueta} {notaEtiqueta && <span className="text-slate-400">{notaEtiqueta}</span>}
      </span>
      <Campo
        compacto={compacto}
        role="combobox"
        aria-expanded={abierto}
        aria-controls={idLista}
        aria-autocomplete="list"
        autoComplete="off"
        autoFocus={autoFocus}
        value={abierto ? consulta : (seleccionada?.etiqueta ?? '')}
        placeholder={seleccionada && abierto ? seleccionada.etiqueta : placeholder}
        onFocus={() => {
          setAbierto(true)
          setConsulta('')
          setActivo(0)
        }}
        onChange={(e) => {
          setConsulta(e.target.value)
          setAbierto(true)
          setActivo(0)
        }}
        onKeyDown={alPulsarTecla}
        className={cx('w-full', limpiable && valor && 'pr-8')}
      />
      {limpiable && valor && (
        <button
          type="button"
          onClick={() => elegir('')}
          className={cx(
            'absolute right-2.5 text-slate-400 hover:text-slate-700',
            compacto ? 'top-[27px]' : 'top-[31px]',
          )}
          aria-label={`Quitar ${etiqueta.toLowerCase()}`}
        >
          <Icono nombre="x" />
        </button>
      )}
      {abierto && (
        <div id={idLista} role="listbox" className="panel-desplegable max-h-64 w-full overflow-y-auto p-0">
          {visibles.length > 0 ? (
            visibles.map((opcion, i) => (
              <button
                key={opcion.id}
                type="button"
                role="option"
                aria-selected={opcion.id === valor}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(opcion.id)}
                className={cx(
                  'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50',
                  (i === activo || opcion.id === valor) && 'bg-marca-50 text-marca-800',
                )}
              >
                <span className="min-w-0 truncate">{opcion.etiqueta}</span>
                {opcion.detalle && <span className="shrink-0 text-xs text-slate-500">{opcion.detalle}</span>}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-slate-500">{vacio}</div>
          )}
        </div>
      )}
    </div>
  )
}
