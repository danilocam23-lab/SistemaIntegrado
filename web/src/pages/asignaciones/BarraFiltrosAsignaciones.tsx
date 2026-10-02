// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useMemo, useState } from 'react'
import { BarraFiltros, Boton, Icono, Selector } from '../../components/ui'
import type { Persona } from '../../types'
import { Combobox } from './Combobox'
import type { FiltroMostrar, FiltrosAsignaciones } from './tipos'

interface Props {
  filtros: FiltrosAsignaciones
  onCambio: (parcial: Partial<FiltrosAsignaciones>) => void
  onLimpiar: () => void
  hayFiltros: boolean
  nFiltros: number
  estadosUnicos: string[]
  personasDisponibles: Persona[]
}

const OPCIONES_MOSTRAR: { valor: FiltroMostrar; etiqueta: string }[] = [
  { valor: 'todo', etiqueta: 'Todo' },
  { valor: 'alerta', etiqueta: 'Con alerta' },
  { valor: 'prioridad', etiqueta: '★ Prioridad' },
]

/**
 * Barra de filtros: estado del requerimiento, un solo selector de persona con
 * búsqueda y "Mostrar: Todo / Con alerta / ★ Prioridad". Los filtros se guardan
 * en la sesión (ver `useFiltrosAsignaciones`). En móvil quedan detrás de un
 * botón "Filtros (n)". Controlada por props.
 */
export function BarraFiltrosAsignaciones({
  filtros,
  onCambio,
  onLimpiar,
  hayFiltros,
  nFiltros,
  estadosUnicos,
  personasDisponibles,
}: Props) {
  const [abiertoMovil, setAbiertoMovil] = useState(false)

  const opcionesPersona = useMemo(
    () => personasDisponibles.map((p) => ({ id: p.id, etiqueta: p.nombre, detalle: p.rol_operativo })),
    [personasDisponibles],
  )

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between gap-2 md:hidden">
        <Boton
          variante="secundario"
          aria-expanded={abiertoMovil}
          icono={<Icono nombre="filtro" />}
          onClick={() => setAbiertoMovil((v) => !v)}
        >
          Filtros{nFiltros > 0 ? ` (${nFiltros})` : ''}
        </Boton>
        {hayFiltros && (
          <button type="button" onClick={onLimpiar} className="enlace-accion-sutil inline-flex items-center gap-1">
            Limpiar <Icono nombre="x" />
          </button>
        )}
      </div>

      <div className={abiertoMovil ? 'mt-2' : 'hidden md:block'}>
        <BarraFiltros>
          <Selector
            etiqueta="Estado del requerimiento"
            compacto
            value={filtros.estado}
            onChange={(e) => onCambio({ estado: e.target.value })}
          >
            <option value="__todos__">Todos</option>
            {estadosUnicos.map((estado) => (
              <option key={estado} value={estado}>{estado}</option>
            ))}
            <option value="__sin_estado__">Sin estado</option>
          </Selector>

          <Combobox
            etiqueta="Persona"
            compacto
            opciones={opcionesPersona}
            valor={filtros.persona === '__todos__' ? '' : filtros.persona}
            onCambio={(id) => onCambio({ persona: id || '__todos__' })}
            placeholder="Buscar o elegir persona…"
            className="w-64"
          />

          <div>
            <span className="etiqueta">Mostrar</span>
            <div className="flex flex-wrap gap-1" role="group" aria-label="Mostrar">
              {OPCIONES_MOSTRAR.map((opcion) => (
                <Boton
                  key={opcion.valor}
                  tamano="sm"
                  variante={filtros.mostrar === opcion.valor ? 'primario' : 'secundario'}
                  aria-pressed={filtros.mostrar === opcion.valor}
                  onClick={() => onCambio({ mostrar: opcion.valor })}
                >
                  {opcion.etiqueta}
                </Boton>
              ))}
            </div>
          </div>

          <div className="flex items-end gap-3 pb-2">
            {hayFiltros && (
              <button type="button" onClick={onLimpiar} className="enlace-accion-sutil inline-flex items-center gap-1">
                Limpiar <Icono nombre="x" />
              </button>
            )}
            <span className="text-[11px] text-slate-400">Filtros guardados en la sesión</span>
          </div>
        </BarraFiltros>
      </div>
    </div>
  )
}
