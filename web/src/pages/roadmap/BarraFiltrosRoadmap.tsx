// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import type { Dispatch, SetStateAction } from 'react'
import { BarraFiltros, Boton, Campo, Chip, FiltroDesplegable, Selector } from '../../components/ui'
import { SIN_ASIGNAR_ID, TODOS_ID } from './derivados'
import type { ModoAgrupacion, PersonaRoadmap, PresetRango } from './tipos'

interface Props {
  modo: ModoAgrupacion
  onModo: (modo: ModoAgrupacion) => void
  preset: PresetRango
  onPreset: (preset: PresetRango) => void
  desdeIndice: number
  hastaIndice: number
  opcionesMes: { indice: number; etiqueta: string }[]
  onExtremo: (extremo: 'desde' | 'hasta', indice: number) => void
  estadosDisponibles: string[]
  estadosActivos: Set<string>
  setEstadosActivos: Dispatch<SetStateAction<Set<string>>>
  personas: PersonaRoadmap[]
  filtroPersona: string
  onFiltroPersona: (id: string) => void
  busqueda: string
  onBusqueda: (texto: string) => void
}

const ATAJOS: { valor: PresetRango; etiqueta: string }[] = [
  { valor: '3', etiqueta: '3 meses' },
  { valor: '6', etiqueta: '6 meses' },
  { valor: 'todo', etiqueta: 'Todo' },
]

/** Agrupación, rango de meses (atajos + desde/hasta), estados, desarrollador y búsqueda. */
export function BarraFiltrosRoadmap({
  modo, onModo, preset, onPreset, desdeIndice, hastaIndice, opcionesMes, onExtremo,
  estadosDisponibles, estadosActivos, setEstadosActivos, personas, filtroPersona, onFiltroPersona,
  busqueda, onBusqueda,
}: Props) {
  const personasActivas = personas.filter((p) => p.activo).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  return (
    <BarraFiltros className="mb-4">
      <div>
        <span className="etiqueta">Agrupar</span>
        <div className="flex gap-1" role="group" aria-label="Agrupar">
          <Boton tamano="sm" variante={modo === 'usuario' ? 'primario' : 'secundario'}
            aria-pressed={modo === 'usuario'} onClick={() => onModo('usuario')}>Por usuario asignado</Boton>
          <Boton tamano="sm" variante={modo === 'plano' ? 'primario' : 'secundario'}
            aria-pressed={modo === 'plano'} onClick={() => onModo('plano')}>Sin agrupar</Boton>
        </div>
      </div>

      <div>
        <span className="etiqueta">Rango de meses</span>
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Rango de meses">
          {ATAJOS.map((a) => (
            <Boton key={a.valor} tamano="sm" variante={preset === a.valor ? 'primario' : 'secundario'}
              aria-pressed={preset === a.valor} onClick={() => onPreset(a.valor)}>{a.etiqueta}</Boton>
          ))}
          <Selector compacto aria-label="Desde el mes" value={desdeIndice}
            onChange={(e) => onExtremo('desde', Number(e.target.value))}>
            {opcionesMes.map((m) => <option key={m.indice} value={m.indice}>{m.etiqueta}</option>)}
          </Selector>
          <span aria-hidden="true" className="text-xs text-slate-500">–</span>
          <Selector compacto aria-label="Hasta el mes" value={hastaIndice}
            onChange={(e) => onExtremo('hasta', Number(e.target.value))}>
            {opcionesMes.map((m) => <option key={m.indice} value={m.indice}>{m.etiqueta}</option>)}
          </Selector>
        </div>
      </div>

      <div>
        <span className="etiqueta">Estados del requerimiento</span>
        <div className="flex items-center gap-2">
          <FiltroDesplegable
            label="Estados del requerimiento"
            opciones={estadosDisponibles}
            activos={estadosActivos}
            setActivos={setEstadosActivos}
            anchoPanel="320px"
          />
          <Chip>
            {estadosActivos.size === 0 ? 'sin filtro' : `${estadosActivos.size} de ${estadosDisponibles.length}`}
          </Chip>
        </div>
      </div>

      {modo === 'usuario' && (
        <Selector etiqueta="Desarrollador" compacto value={filtroPersona}
          onChange={(e) => onFiltroPersona(e.target.value)}>
          <option value={TODOS_ID}>Todos los desarrolladores</option>
          <option value={SIN_ASIGNAR_ID}>Sin asignar</option>
          {personasActivas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </Selector>
      )}

      <Campo
        etiqueta="Buscar"
        compacto
        type="search"
        value={busqueda}
        onChange={(e) => onBusqueda(e.target.value)}
        placeholder="Código o nombre…"
        aria-label="Buscar requerimiento por código o nombre"
        className="w-48"
      />
    </BarraFiltros>
  )
}
