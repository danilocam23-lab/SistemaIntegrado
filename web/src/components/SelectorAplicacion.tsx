// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { CONSOLIDADO } from '../api/client'
import { useAplicacion } from '../context/AplicacionContext'
import { Chip } from './ui'

export default function SelectorAplicacion() {
  const { aplicaciones, activa, setActiva, sinSquads } = useAplicacion()
  // La opción consolidada solo se ofrece con más de un squad activo.
  const puedeVerTodos = aplicaciones.length > 1

  function cambiar(codigo: string): void {
    setActiva(codigo)
    // Cambiar de aplicación recarga el contexto completo.
    window.location.reload()
  }

  if (sinSquads) {
    return (
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <span className="shrink-0 text-slate-500">Squad:</span>
        <Chip tono="alerta">Sin squads asignados</Chip>
      </div>
    )
  }

  // Un solo squad: solo se muestra su nombre, sin selector ni opción consolidada.
  if (aplicaciones.length === 1) {
    return (
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <span className="shrink-0 text-slate-500">Squad:</span>
        <span className="truncate font-medium text-slate-800">{aplicaciones[0].nombre}</span>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <span className="shrink-0 text-slate-500">Squad:</span>
      <select
        id="selector-squad-principal"
        value={activa}
        onChange={(e) => cambiar(e.target.value)}
        className="campo campo-sm min-w-0 max-w-full flex-1 sm:flex-none"
      >
        {aplicaciones.map((a) => (
          <option key={a.codigo} value={a.codigo}>
            {a.nombre}
          </option>
        ))}
        {puedeVerTodos && <option value={CONSOLIDADO}>★ Todos los squads</option>}
      </select>
    </div>
  )
}
