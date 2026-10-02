// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { BarraFiltros, Boton, Campo, Selector } from '../../components/ui'
import { etiquetaRol } from './roles'
import type { EstadoFiltro, FiltrosPersonas, VistaPersonas } from './tipos'

interface Props {
  filtros: FiltrosPersonas
  onCambiar: (parcial: Partial<FiltrosPersonas>) => void
  onLimpiar: () => void
  hayFiltros: boolean
  roles: string[]
  squads: string[]
  contrataciones: string[]
  vista: VistaPersonas
  onVista: (vista: VistaPersonas) => void
  /** Solo con `personas.ver_valores`; si es `false` no existe el control. */
  mostrarControlValores: boolean
  verValores: boolean
  onVerValores: (ver: boolean) => void
}

const ESTADOS: Array<{ id: EstadoFiltro; texto: string }> = [
  { id: 'todas', texto: 'Todas' },
  { id: 'activas', texto: 'Activas' },
  { id: 'inactivas', texto: 'Inactivas' },
]

const VISTAS: Array<{ id: VistaPersonas; texto: string }> = [
  { id: 'lista', texto: 'Lista' },
  { id: 'por-rol', texto: 'Por rol' },
]

function Segmentado<T extends string>({
  etiqueta,
  opciones,
  valor,
  onElegir,
}: {
  etiqueta: string
  opciones: Array<{ id: T; texto: string }>
  valor: T
  onElegir: (id: T) => void
}) {
  return (
    <div className="grupo-filtro">
      <span className="etiqueta">{etiqueta}</span>
      <div role="group" aria-label={etiqueta} className="flex gap-1">
        {opciones.map((o) => (
          <Boton
            key={o.id}
            tamano="sm"
            variante={valor === o.id ? 'primario' : 'secundario'}
            aria-pressed={valor === o.id}
            onClick={() => onElegir(o.id)}
          >
            {o.texto}
          </Boton>
        ))}
      </div>
    </div>
  )
}

/** Búsqueda, filtros (rol, squad, contratación, estado), vista y control de valores. */
export function BarraFiltrosPersonas({
  filtros,
  onCambiar,
  onLimpiar,
  hayFiltros,
  roles,
  squads,
  contrataciones,
  vista,
  onVista,
  mostrarControlValores,
  verValores,
  onVerValores,
}: Props) {
  return (
    <BarraFiltros className="mb-4">
      <Campo
        etiqueta="Buscar"
        value={filtros.busqueda}
        onChange={(e) => onCambiar({ busqueda: e.target.value })}
        placeholder="Nombre, correo, squad o rol…"
        className="w-full sm:w-64"
      />
      <Selector etiqueta="Rol" value={filtros.rol} onChange={(e) => onCambiar({ rol: e.target.value })}>
        <option value="">Todos</option>
        {roles.map((r) => (
          <option key={r} value={r}>{etiquetaRol(r)}</option>
        ))}
      </Selector>
      <Selector etiqueta="Squad" value={filtros.squad} onChange={(e) => onCambiar({ squad: e.target.value })}>
        <option value="">Todos</option>
        {squads.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </Selector>
      <Selector
        etiqueta="Contratación"
        value={filtros.contratacion}
        onChange={(e) => onCambiar({ contratacion: e.target.value })}
      >
        <option value="">Todas</option>
        {contrataciones.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </Selector>
      <Segmentado
        etiqueta="Estado"
        opciones={ESTADOS}
        valor={filtros.estado}
        onElegir={(estado) => onCambiar({ estado })}
      />
      <Segmentado etiqueta="Vista" opciones={VISTAS} valor={vista} onElegir={onVista} />
      {mostrarControlValores && (
        <Segmentado
          etiqueta="Valores"
          opciones={[
            { id: 'ver', texto: 'Visibles' },
            { id: 'ocultar', texto: 'Ocultar' },
          ]}
          valor={verValores ? 'ver' : 'ocultar'}
          onElegir={(id) => onVerValores(id === 'ver')}
        />
      )}
      {hayFiltros && (
        <Boton tamano="sm" variante="fantasma" onClick={onLimpiar}>
          Quitar filtros
        </Boton>
      )}
    </BarraFiltros>
  )
}
