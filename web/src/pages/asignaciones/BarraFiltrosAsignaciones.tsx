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
    <div className="mb-4 flex flex-wrap items-center gap-6">
      <div className="flex items-center gap-3">
        <label className="text-sm text-slate-600">Filtrar por estado del requerimiento:</label>
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="campo campo-sm"
        >
          <option value="__todos__">Todos</option>
          {estadosUnicos.map((estado) => (
            <option key={estado} value={estado}>{estado}</option>
          ))}
          <option value="__sin_estado__">Sin estado</option>
        </select>
        {filtroEstado !== '__todos__' && (
          <button
            type="button"
            onClick={() => setFiltroEstado('__todos__')}
            className="enlace-accion-sutil"
          >
            Limpiar ✕
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm text-slate-600">Buscar persona:</label>
        <input
          type="text"
          value={busquedaPersona}
          onChange={(e) => setBusquedaPersona(e.target.value)}
          placeholder="Nombre de la persona…"
          className="campo campo-sm w-56"
        />
        <select
          value={filtroPersona}
          onChange={(e) => setFiltroPersona(e.target.value)}
          className="campo campo-sm"
        >
          <option value="__todos__">Todas</option>
          {personasDisponibles.map((persona) => (
            <option key={persona.id} value={persona.id}>{persona.nombre}</option>
          ))}
        </select>
        {(filtroPersona !== '__todos__' || busquedaPersona) && (
          <button
            type="button"
            onClick={() => { setFiltroPersona('__todos__'); setBusquedaPersona('') }}
            className="enlace-accion-sutil"
          >
            Limpiar ✕
          </button>
        )}
      </div>
    </div>
  )
}
