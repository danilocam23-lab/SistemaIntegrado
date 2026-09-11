import type { Dispatch, SetStateAction } from 'react'
import { Link } from 'react-router-dom'

interface BarraAccionesRequerimientosProps {
  puedeCrear: boolean
  puedeExportar: boolean
  mostrarFiltros: boolean
  setMostrarFiltros: Dispatch<SetStateAction<boolean>>
  hayFiltrosActivos: boolean
  exportarDeshabilitado: boolean
  onExportar: () => void
}

/** Cabecera de la página: título, Crear, toggle del panel de Filtros y
 *  Exportar a Excel. */
export function BarraAccionesRequerimientos({
  puedeCrear, puedeExportar, mostrarFiltros, setMostrarFiltros, hayFiltrosActivos,
  exportarDeshabilitado, onExportar,
}: BarraAccionesRequerimientosProps) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h1 className="titulo-pagina">Requerimientos</h1>
      <div className="flex items-center gap-2">
        {puedeCrear && (
          <Link to="/requerimientos/nuevo" className="rounded bg-marca px-4 py-2 text-white hover:bg-marca-osc text-sm">
            Crear
          </Link>
        )}
        <button
          onClick={() => setMostrarFiltros((v) => !v)}
          className={`btn ${mostrarFiltros || hayFiltrosActivos ? 'btn-suave' : 'btn-secundario'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          Filtros{hayFiltrosActivos && <span className="contador-filtro ml-1">ON</span>}
        </button>
        {puedeExportar && (
          <button
            onClick={onExportar}
            disabled={exportarDeshabilitado}
            title="Exporta a Excel el listado con los filtros actualmente aplicados"
            className="btn btn-exito items-center gap-1"
          >
            Exportar a Excel
          </button>
        )}
      </div>
    </div>
  )
}
