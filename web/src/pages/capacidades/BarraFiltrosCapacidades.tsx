// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { BarraFiltros, Boton, Campo, Selector } from '../../components/ui'
import type { FiltrosCapacidades } from './useMatrizCapacidades'

export type VistaCapacidades = 'persona' | 'equipo'
export type ModoCapacidades = 'horas' | 'pct'

interface Props {
  anio: number
  onAnio: (anio: number) => void
  vista: VistaCapacidades
  onVista: (vista: VistaCapacidades) => void
  modo: ModoCapacidades
  onModo: (modo: ModoCapacidades) => void
  filtros: FiltrosCapacidades
  onFiltros: (cambio: Partial<FiltrosCapacidades>) => void
  roles: string[]
  /** Personas activas con alerta (sobrecarga, subutilización o mes sin registro). */
  nAlertas: number
}

/** Año, vista (persona/equipo), modo (horas/% de la base) y filtros del mapa de calor. */
export function BarraFiltrosCapacidades({
  anio, onAnio, vista, onVista, modo, onModo, filtros, onFiltros, roles, nAlertas,
}: Props) {
  return (
    <BarraFiltros className="mb-4">
      <div>
        <span className="etiqueta">Año</span>
        <div className="flex items-center gap-1" role="group" aria-label="Año">
          <Boton tamano="sm" aria-label="Año anterior" onClick={() => onAnio(anio - 1)}>‹</Boton>
          {[anio - 1, anio, anio + 1].map((a) => (
            <Boton
              key={a}
              tamano="sm"
              variante={a === anio ? 'primario' : 'secundario'}
              aria-pressed={a === anio}
              onClick={() => onAnio(a)}
            >
              {a}
            </Boton>
          ))}
          <Boton tamano="sm" aria-label="Año siguiente" onClick={() => onAnio(anio + 1)}>›</Boton>
        </div>
      </div>

      <div>
        <span className="etiqueta">Vista</span>
        <div className="flex gap-1" role="group" aria-label="Vista">
          <Boton tamano="sm" variante={vista === 'persona' ? 'primario' : 'secundario'}
            aria-pressed={vista === 'persona'} onClick={() => onVista('persona')}>Por persona</Boton>
          <Boton tamano="sm" variante={vista === 'equipo' ? 'primario' : 'secundario'}
            aria-pressed={vista === 'equipo'} onClick={() => onVista('equipo')}>Por equipo</Boton>
        </div>
      </div>

      <div>
        <span className="etiqueta">Mostrar</span>
        <div className="flex gap-1" role="group" aria-label="Mostrar">
          <Boton tamano="sm" variante={modo === 'horas' ? 'primario' : 'secundario'}
            aria-pressed={modo === 'horas'} onClick={() => onModo('horas')}>Horas</Boton>
          <Boton tamano="sm" variante={modo === 'pct' ? 'primario' : 'secundario'}
            aria-pressed={modo === 'pct'} onClick={() => onModo('pct')}>% de la base</Boton>
        </div>
      </div>

      <Campo
        etiqueta="Buscar"
        compacto
        type="search"
        value={filtros.busqueda}
        onChange={(e) => onFiltros({ busqueda: e.target.value })}
        placeholder="Persona…"
        aria-label="Buscar persona"
        className="w-48"
      />

      <Selector
        etiqueta="Rol"
        compacto
        value={filtros.rol}
        onChange={(e) => onFiltros({ rol: e.target.value })}
      >
        <option value="">Todos</option>
        {roles.map((rol) => <option key={rol} value={rol}>{rol}</option>)}
      </Selector>

      <div>
        <span className="etiqueta">&nbsp;</span>
        <Boton
          tamano="sm"
          variante={filtros.soloAlertas ? 'primario' : 'secundario'}
          aria-pressed={filtros.soloAlertas}
          onClick={() => onFiltros({ soloAlertas: !filtros.soloAlertas })}
        >
          Solo con alertas ({nAlertas})
        </Boton>
      </div>
    </BarraFiltros>
  )
}
