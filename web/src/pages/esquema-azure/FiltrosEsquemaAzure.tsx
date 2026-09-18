// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import type { ChangeEvent } from 'react'
import { BarraFiltros, Boton, Campo, Icono, Selector } from '../../components/ui'
import type { AzdoProyecto, TipoWorkItemAzure } from '../../types'

interface Props {
  proyectos: AzdoProyecto[]
  proyecto: string
  tipos: TipoWorkItemAzure[]
  tiposSeleccionados: string[]
  iteraciones: string[]
  iteracionPath: string
  busqueda: string
  cargando: boolean
  onProyecto: (valor: string) => void
  onTipos: (valores: string[]) => void
  onIteracionPath: (valor: string) => void
  onBusqueda: (valor: string) => void
  onRecargar: () => void
}

function etiquetaIteracion(ruta: string): string {
  return ruta.split('\\').pop()?.trim() || ruta
}

export function FiltrosEsquemaAzure({
  proyectos,
  proyecto,
  tipos,
  tiposSeleccionados,
  iteraciones,
  iteracionPath,
  busqueda,
  cargando,
  onProyecto,
  onTipos,
  onIteracionPath,
  onBusqueda,
  onRecargar,
}: Props) {
  function cambiarTipos(evento: ChangeEvent<HTMLSelectElement>) {
    onTipos(Array.from(evento.target.selectedOptions).map((opcion) => opcion.value))
  }

  return (
    <BarraFiltros titulo="Filtros de Azure DevOps" className="items-end">
      <Selector
        etiqueta="Proyecto"
        value={proyecto}
        onChange={(evento) => onProyecto(evento.target.value)}
        className="min-w-56"
        compacto
      >
        {proyecto && !proyectos.some((p) => p.nombre === proyecto) && <option value={proyecto}>{proyecto}</option>}
        <option value="">Proyecto por defecto</option>
        {proyectos.map((item) => (
          <option key={item.id || item.nombre} value={item.nombre}>{item.nombre}</option>
        ))}
      </Selector>

      <Selector
        etiqueta="Tipos"
        multiple
        value={tiposSeleccionados}
        onChange={cambiarTipos}
        className="min-h-24 min-w-56"
        compacto
      >
        {tipos.map((tipo) => (
          <option key={tipo.referencia || tipo.nombre} value={tipo.nombre}>{tipo.nombre}</option>
        ))}
      </Selector>

      <Selector
        etiqueta="Iteración"
        value={iteracionPath}
        onChange={(evento) => onIteracionPath(evento.target.value)}
        className="min-w-56"
        compacto
      >
        <option value="">
          {iteraciones.length === 0
            ? 'Sin iteraciones configuradas; revisa Administración → Aplicaciones'
            : 'Todas las permitidas'}
        </option>
        {iteraciones.map((iteracion) => (
          <option key={iteracion} value={iteracion} title={iteracion}>
            {etiquetaIteracion(iteracion)}
          </option>
        ))}
      </Selector>

      <Campo
        etiqueta="Buscar en cargados"
        value={busqueda}
        onChange={(evento) => onBusqueda(evento.target.value)}
        placeholder="Título o ID"
        className="min-w-56"
        compacto
      />

      <Boton
        variante="secundario"
        tamano="sm"
        onClick={onRecargar}
        disabled={cargando}
        icono={<Icono nombre="recargar" />}
      >
        {cargando ? 'Cargando…' : 'Recargar'}
      </Boton>
    </BarraFiltros>
  )
}
