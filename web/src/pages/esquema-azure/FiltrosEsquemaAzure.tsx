import type { ChangeEvent } from 'react'
import { BarraFiltros, Boton, Campo, Icono, Selector } from '../../components/ui'
import type { AzdoIteracion, AzdoProyecto, TipoWorkItemAzure } from '../../types'

interface Props {
  proyectos: AzdoProyecto[]
  proyecto: string
  tipos: TipoWorkItemAzure[]
  tiposSeleccionados: string[]
  areaPath: string
  iteraciones: AzdoIteracion[]
  iteracionPath: string
  busqueda: string
  cargando: boolean
  onProyecto: (valor: string) => void
  onTipos: (valores: string[]) => void
  onAreaPath: (valor: string) => void
  onIteracionPath: (valor: string) => void
  onBusqueda: (valor: string) => void
  onRecargar: () => void
}

export function FiltrosEsquemaAzure({
  proyectos,
  proyecto,
  tipos,
  tiposSeleccionados,
  areaPath,
  iteraciones,
  iteracionPath,
  busqueda,
  cargando,
  onProyecto,
  onTipos,
  onAreaPath,
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

      <Campo
        etiqueta="Área"
        value={areaPath}
        onChange={(evento) => onAreaPath(evento.target.value)}
        placeholder="Area path"
        className="min-w-56"
        compacto
      />

      <Selector
        etiqueta="Iteración"
        value={iteracionPath}
        onChange={(evento) => onIteracionPath(evento.target.value)}
        className="min-w-56"
        compacto
      >
        <option value="">Todas</option>
        {iteraciones.map((iteracion) => (
          <option key={iteracion.path} value={iteracion.path}>{iteracion.path || iteracion.nombre}</option>
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
