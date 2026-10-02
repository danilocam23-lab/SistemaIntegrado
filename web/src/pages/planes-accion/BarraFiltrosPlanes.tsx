// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { BarraFiltros, Boton, Campo, Selector } from '../../components/ui'
import { ESTADOS, ESTADO_LABEL, SIN_RESPONSABLE } from './tipos'
import type { FiltroVencimiento, FiltrosPlanes, OrdenPlanes, VistaPlanes } from './tipos'

const VENCIMIENTOS: Array<{ valor: FiltroVencimiento; etiqueta: string }> = [
  { valor: '', etiqueta: 'Todos' },
  { valor: 'vencidos', etiqueta: 'Vencidos' },
  { valor: 'semana', etiqueta: '≤ 7 días' },
  { valor: 'sin_fecha', etiqueta: 'Sin fecha' },
]

interface Props {
  filtros: FiltrosPlanes
  alCambiar: (cambios: Partial<FiltrosPlanes>) => void
  vista: VistaPlanes
  alCambiarVista: (vista: VistaPlanes) => void
  contadoresEstado: Record<string, number>
  total: number
  responsables: Array<{ id: string; nombre: string }>
}

/** Vista (lista/tablero), segmentos de estado y vencimiento, responsable, búsqueda y orden. */
export function BarraFiltrosPlanes({
  filtros, alCambiar, vista, alCambiarVista, contadoresEstado, total, responsables,
}: Props) {
  return (
    <BarraFiltros className="mb-3">
      <div className="grupo-filtro">
        <span className="etiqueta">Vista</span>
        <div className="flex gap-1" role="group" aria-label="Vista">
          {(['lista', 'tablero'] as const).map((v) => (
            <Boton
              key={v}
              tamano="sm"
              variante={vista === v ? 'primario' : 'secundario'}
              aria-pressed={vista === v}
              onClick={() => alCambiarVista(v)}
            >
              {v === 'lista' ? 'Lista' : 'Tablero'}
            </Boton>
          ))}
        </div>
      </div>

      <div className="grupo-filtro">
        <span className="etiqueta">Estado</span>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Estado">
          <Boton
            tamano="sm"
            variante={filtros.estado === '' ? 'primario' : 'secundario'}
            aria-pressed={filtros.estado === ''}
            onClick={() => alCambiar({ estado: '' })}
          >
            Todos {total}
          </Boton>
          {ESTADOS.map((e) => (
            <Boton
              key={e}
              tamano="sm"
              variante={filtros.estado === e ? 'primario' : 'secundario'}
              aria-pressed={filtros.estado === e}
              onClick={() => alCambiar({ estado: e })}
            >
              {ESTADO_LABEL[e]} {contadoresEstado[e] ?? 0}
            </Boton>
          ))}
        </div>
      </div>

      <div className="grupo-filtro">
        <span className="etiqueta">Vencimiento</span>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Vencimiento">
          {VENCIMIENTOS.map((v) => (
            <Boton
              key={v.valor || 'todos'}
              tamano="sm"
              variante={filtros.vencimiento === v.valor ? 'primario' : 'secundario'}
              aria-pressed={filtros.vencimiento === v.valor}
              onClick={() => alCambiar({ vencimiento: v.valor })}
            >
              {v.etiqueta}
            </Boton>
          ))}
        </div>
      </div>

      <Selector
        etiqueta="Responsable"
        value={filtros.responsable}
        onChange={(e) => alCambiar({ responsable: e.target.value })}
      >
        <option value="">Todos</option>
        <option value={SIN_RESPONSABLE}>Sin responsable</option>
        {responsables.map((r) => (
          <option key={r.id} value={r.id}>{r.nombre}</option>
        ))}
      </Selector>

      <Selector
        etiqueta="Orden"
        value={filtros.orden}
        onChange={(e) => alCambiar({ orden: e.target.value as OrdenPlanes })}
      >
        <option value="reciente">Más reciente primero</option>
        <option value="fecha">Fecha límite</option>
      </Selector>

      <Campo
        etiqueta="Buscar"
        type="search"
        placeholder="Título o descripción…"
        value={filtros.busqueda}
        onChange={(e) => alCambiar({ busqueda: e.target.value })}
        className="w-56"
      />
    </BarraFiltros>
  )
}
