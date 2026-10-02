// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { Campo, cx, Icono } from '../../components/ui'
import { CLASE_TONO, ETIQUETA_TONO, formatearHoras, textoCelda, validarHoras } from './base'
import { HORAS_MAX, MESES_LARGO } from './tipos'
import type { CeldaCapacidad } from './tipos'

interface PropsEditor {
  celda: CeldaCapacidad
  etiqueta: string
  /** Devuelve el mensaje de error del servidor, o `null` si se guardó. */
  onGuardar: (horas: number) => Promise<string | null>
  onCerrar: () => void
  onEliminar: () => void
}

/**
 * Editor en línea de una celda: Enter guarda, Esc cancela, perder el foco guarda.
 * Rechaza vacío/no numérico/fuera de rango, no envía si el valor no cambió, no
 * guarda dos veces (Enter + blur, Esc + blur) y muestra el error del servidor
 * junto a la celda sin cerrarse.
 */
function EditorCelda({ celda, etiqueta, onGuardar, onCerrar, onEliminar }: PropsEditor) {
  const [texto, setTexto] = useState(celda.horas !== null ? String(celda.horas) : '')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const terminado = useRef(false)
  const contenedor = useRef<HTMLDivElement>(null)

  async function confirmar() {
    if (terminado.current) return
    const validado = validarHoras(texto)
    if ('error' in validado) {
      setError(validado.error)
      return
    }
    terminado.current = true
    if (validado.horas === celda.horas) {
      onCerrar()
      return
    }
    setError('')
    setGuardando(true)
    const mensaje = await onGuardar(validado.horas)
    if (mensaje) {
      terminado.current = false
      setGuardando(false)
      setError(mensaje)
      window.setTimeout(() => contenedor.current?.querySelector('input')?.focus(), 0)
    }
  }

  return (
    <div ref={contenedor} className="min-w-[7.5rem]">
      <div className="flex items-center justify-center gap-1">
        <Campo
          autoFocus
          type="number"
          inputMode="decimal"
          min={0}
          max={HORAS_MAX}
          step="any"
          value={texto}
          disabled={guardando}
          onChange={(e) => { setTexto(e.target.value); setError('') }}
          onBlur={() => { void confirmar() }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void confirmar()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              terminado.current = true
              onCerrar()
            }
          }}
          aria-label={`Horas de ${etiqueta}`}
          aria-invalid={error ? true : undefined}
          compacto
          className="w-[4.5rem] text-right"
        />
        <button
          type="button"
          disabled={guardando}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            terminado.current = true
            onEliminar()
          }}
          aria-label={`Eliminar la capacidad de ${etiqueta}`}
          title="Eliminar (se puede deshacer)"
          className="rounded p-1 text-slate-400 transition-colors hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-marca disabled:opacity-40"
        >
          <Icono nombre="papelera" />
        </button>
      </div>
      {guardando && <p role="status" className="mt-1 text-[10px] text-slate-500">Guardando…</p>}
      {error && (
        <p role="alert" className="mt-1 whitespace-normal text-left text-[10px] leading-tight text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}

interface Props {
  celda: CeldaCapacidad
  nombrePersona: string
  modo: 'horas' | 'pct'
  /** Se puede editar (permiso, no consolidado, persona activa). */
  editable: boolean
  seleccionada: boolean
  editando: boolean
  /** Clic simple (el padre decide: edición en línea o panel); `conMayus` abre el panel. */
  onActivar: (conMayus: boolean) => void
  onGuardar: (horas: number) => Promise<string | null>
  onCerrarEdicion: () => void
  onEliminar: () => void
}

/**
 * Una celda del mapa de calor. Con registro muestra las horas pintadas contra la
 * base del mes; sin registro muestra la base sugerida con asterisco (es la que de
 * verdad se aplica en Asignaciones y Backlog). El estado se dice también con texto
 * (`aria-label`/`title`), no solo con color.
 */
export function CeldaCapacidadVista({
  celda, nombrePersona, modo, editable, seleccionada, editando,
  onActivar, onGuardar, onCerrarEdicion, onEliminar,
}: Props) {
  const nombreMes = MESES_LARGO[celda.indice]
  const etiqueta = `${nombrePersona}, ${nombreMes}`

  if (editando && celda.registro) {
    return <EditorCelda celda={celda} etiqueta={etiqueta} onGuardar={onGuardar} onCerrar={onCerrarEdicion} onEliminar={onEliminar} />
  }

  const valor = celda.horas ?? celda.base
  const texto = textoCelda(valor, celda.base, modo) + (celda.horas === null ? '*' : '')
  const duplicado = celda.duplicados.length > 1
  const descripcion = `${etiqueta}: ${formatearHoras(valor)} h, ${ETIQUETA_TONO[celda.tono]}${duplicado ? `, ${celda.duplicados.length} registros duplicados` : ''}`
  const clases = cx(
    'block w-full min-w-[2.75rem] rounded-md px-1 py-1 text-center text-xs font-semibold tabular-nums',
    CLASE_TONO[celda.tono],
    seleccionada && 'outline outline-2 outline-offset-1 outline-marca',
    duplicado && 'ring-1 ring-amber-500',
  )
  const contenido = (
    <>
      {texto}
      {duplicado && <span className="ml-1 text-[9px] font-bold" aria-hidden="true">· {celda.duplicados.length}×</span>}
    </>
  )

  if (!editable) {
    return <span className={clases} title={descripcion} aria-label={descripcion}>{contenido}</span>
  }
  return (
    <button
      type="button"
      onClick={(e: MouseEvent) => onActivar(e.shiftKey)}
      className={cx(clases, 'cursor-pointer transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-marca')}
      title={`${descripcion}. Clic para ${celda.registro ? 'editar' : 'registrar'}; Mayús + clic abre el panel.`}
      aria-label={descripcion}
    >
      {contenido}
    </button>
  )
}
