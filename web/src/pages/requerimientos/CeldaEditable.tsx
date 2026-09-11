import type React from 'react'
import type { Persona, Requerimiento } from '../../types'

export interface ContextoCeldaEditable {
  editValue: string
  setEditValue: (v: string) => void
  guardarCelda: (req: Requerimiento) => Promise<void>
  handleKeyDown: (e: React.KeyboardEvent, req: Requerimiento) => void
  isEditing: (reqId: string, campo: string) => boolean
  iniciarEdicionCelda: (req: Requerimiento, campo: string) => void
  puedeEditar: boolean
  estadosReq: string[]
  personas: Persona[]
}

/** Fábrica de `renderCelda`: cierra sobre el contexto de edición (estado de
 *  `useEscriturasRequerimientos`) y devuelve una función con la misma firma que
 *  usaban los llamados dentro de la tabla, para no tocar cada call site.
 *  INVARIANTE 17: guarda en `onBlur`, incluido `select-persona` (no en `onChange`).
 *  No envolver el resultado en memoización: se recrea en cada render, igual que
 *  antes del troceo. */
export function crearRenderCelda(ctx: ContextoCeldaEditable) {
  return function renderCelda(
    req: Requerimiento,
    campo: string,
    displayValue: string,
    type?: 'select' | 'select-persona' | 'number',
    rolFiltro?: string | string[],
  ): JSX.Element {
    if (ctx.isEditing(req.id, campo)) {
      if (type === 'select') {
        return (
          <select value={ctx.editValue} onChange={(e) => ctx.setEditValue(e.target.value)}
            onBlur={() => ctx.guardarCelda(req)} autoFocus
            className="campo campo-sm w-full">
            {ctx.estadosReq.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )
      }
      if (type === 'select-persona') {
        const roles = rolFiltro ? (Array.isArray(rolFiltro) ? rolFiltro : [rolFiltro]) : []
        const lista = (roles.length > 0 ? ctx.personas.filter((p) => roles.includes(p.rol_operativo)) : ctx.personas).filter((p) => p.activo)
        return (
          <select value={ctx.editValue} onChange={(e) => { ctx.setEditValue(e.target.value) }}
            onBlur={() => ctx.guardarCelda(req)} autoFocus
            className="campo campo-sm w-full">
            <option value="">—</option>
            {lista.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        )
      }
      return (
        <input value={ctx.editValue} onChange={(e) => ctx.setEditValue(e.target.value)}
          onBlur={() => ctx.guardarCelda(req)} onKeyDown={(e) => ctx.handleKeyDown(e, req)}
          type={type === 'number' ? 'number' : 'text'} autoFocus
          className="campo campo-sm w-full" />
      )
    }
    return (
      <span onDoubleClick={ctx.puedeEditar ? () => ctx.iniciarEdicionCelda(req, campo) : undefined}
        className={`block w-full rounded px-1 py-0.5 ${ctx.puedeEditar ? 'cursor-pointer hover:bg-slate-100' : ''}`}
        title={ctx.puedeEditar ? 'Doble clic para editar' : undefined}>
        {displayValue || '—'}
      </span>
    )
  }
}
