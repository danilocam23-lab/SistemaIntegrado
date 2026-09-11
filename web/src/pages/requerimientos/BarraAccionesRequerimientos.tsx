import type { Dispatch, SetStateAction } from 'react'
import { Link } from 'react-router-dom'
import { Boton, EncabezadoPagina, Icono } from '../../components/ui'

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
    <EncabezadoPagina
      icono={<Icono nombre="portafolio" />}
      titulo="Requerimientos"
      acciones={
        <>
          {puedeCrear && (
            <Link to="/requerimientos/nuevo" className="btn btn-primario">
              Crear
            </Link>
          )}
          <Boton
            variante={mostrarFiltros || hayFiltrosActivos ? 'suave' : 'secundario'}
            onClick={() => setMostrarFiltros((v) => !v)}
            icono={<Icono nombre="filtro" />}
          >
            Filtros{hayFiltrosActivos && <span className="contador-filtro ml-1">ON</span>}
          </Boton>
          {puedeExportar && (
            <Boton
              variante="exito"
              onClick={onExportar}
              disabled={exportarDeshabilitado}
              title="Exporta a Excel el listado con los filtros actualmente aplicados"
            >
              Exportar a Excel
            </Boton>
          )}
        </>
      }
    />
  )
}
