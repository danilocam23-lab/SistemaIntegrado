import { BarraFiltros, Campo, Icono, Selector } from '../../components/ui'
import type { Persona } from '../../types'

interface Props {
  filtroEstado: string
  setFiltroEstado: (valor: string) => void
  filtroPersona: string
  setFiltroPersona: (valor: string) => void
  busquedaPersona: string
  setBusquedaPersona: (valor: string) => void
  estadosUnicos: string[]
  personasDisponibles: Persona[]
}

/**
 * Barra de filtros de la pantalla de Asignaciones: estado del requerimiento
 * (`<select>`), búsqueda de persona por texto y dropdown de persona, cada uno
 * con su botón "Limpiar". Controlada por props (no tiene estado propio).
 */
export function BarraFiltrosAsignaciones({
  filtroEstado,
  setFiltroEstado,
  filtroPersona,
  setFiltroPersona,
  busquedaPersona,
  setBusquedaPersona,
  estadosUnicos,
  personasDisponibles,
}: Props) {
  return (
    <BarraFiltros className="mb-4">
      <div className="flex items-end gap-2">
        <Selector
          etiqueta="Estado del requerimiento"
          compacto
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
        >
          <option value="__todos__">Todos</option>
          {estadosUnicos.map((estado) => (
            <option key={estado} value={estado}>{estado}</option>
          ))}
          <option value="__sin_estado__">Sin estado</option>
        </Selector>
        {filtroEstado !== '__todos__' && (
          <button
            type="button"
            onClick={() => setFiltroEstado('__todos__')}
            className="enlace-accion-sutil mb-2 inline-flex items-center gap-1"
          >
            Limpiar <Icono nombre="x" />
          </button>
        )}
      </div>

      <div className="flex items-end gap-2">
        <Campo
          etiqueta="Buscar persona"
          compacto
          type="text"
          value={busquedaPersona}
          onChange={(e) => setBusquedaPersona(e.target.value)}
          placeholder="Nombre de la persona…"
          className="w-56"
        />
        <Selector
          etiqueta="Persona"
          compacto
          value={filtroPersona}
          onChange={(e) => setFiltroPersona(e.target.value)}
        >
          <option value="__todos__">Todas</option>
          {personasDisponibles.map((persona) => (
            <option key={persona.id} value={persona.id}>{persona.nombre}</option>
          ))}
        </Selector>
        {(filtroPersona !== '__todos__' || busquedaPersona) && (
          <button
            type="button"
            onClick={() => { setFiltroPersona('__todos__'); setBusquedaPersona('') }}
            className="enlace-accion-sutil mb-2 inline-flex items-center gap-1"
          >
            Limpiar <Icono nombre="x" />
          </button>
        )}
      </div>
    </BarraFiltros>
  )
}
