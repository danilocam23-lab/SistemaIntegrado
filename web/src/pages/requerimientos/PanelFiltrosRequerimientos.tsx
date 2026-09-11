import type { Dispatch, SetStateAction } from 'react'
import { BarraFiltros, Campo, Selector } from '../../components/ui'
import type { Persona } from '../../types'
import type { Filtros } from './tipos'
import { FILTROS_INIT } from './tipos'

interface PanelFiltrosRequerimientosProps {
  filtros: Filtros
  setFiltros: Dispatch<SetStateAction<Filtros>>
  hayFiltrosActivos: boolean
  filtrosActivos: Set<string>
  estadosReq: string[]
  estadosEnt: string[]
  squadsDisponibles: string[]
  lideresDisponibles: Persona[]
  categoriasDisponibles: string[]
  tipificacionesDisponibles: string[]
  tiposCostoDisponibles: string[]
}

/** Panel de los 13 filtros del listado de requerimientos. Cada filtro se pinta
 *  solo si `filtrosActivos` (catálogo de Configuración) lo trae activo; el
 *  panel entero se monta/desmonta desde el shell según `mostrarFiltros`. */
export function PanelFiltrosRequerimientos({
  filtros, setFiltros, hayFiltrosActivos, filtrosActivos,
  estadosReq, estadosEnt, squadsDisponibles, lideresDisponibles,
  categoriasDisponibles, tipificacionesDisponibles, tiposCostoDisponibles,
}: PanelFiltrosRequerimientosProps) {
  return (
    <BarraFiltros className="mb-4" titulo="Filtros">
      {hayFiltrosActivos && (
        <button onClick={() => setFiltros(FILTROS_INIT)} className="enlace-accion enlace-accion-peligro mb-2 text-xs">
          Limpiar filtros
        </button>
      )}
      {filtrosActivos.has('codigoReq') && (
        <Campo
          etiqueta="Código REQ"
          compacto
          type="text"
          value={filtros.codigoReq}
          placeholder="Buscar..."
          onChange={(e) => setFiltros((f) => ({ ...f, codigoReq: e.target.value }))}
        />
      )}
      {filtrosActivos.has('sc') && (
        <Campo
          etiqueta="SC"
          compacto
          type="text"
          value={filtros.sc}
          placeholder="Buscar..."
          onChange={(e) => setFiltros((f) => ({ ...f, sc: e.target.value }))}
        />
      )}
      {filtrosActivos.has('squad') && (
        <Selector
          etiqueta="Squad"
          compacto
          value={filtros.squad}
          onChange={(e) => setFiltros((f) => ({ ...f, squad: e.target.value }))}
        >
          <option value="">Todos</option>
          {squadsDisponibles.map((s) => <option key={s} value={s}>{s}</option>)}
        </Selector>
      )}
      {filtrosActivos.has('estado') && (
        <Selector
          etiqueta="Estado"
          compacto
          value={filtros.estado}
          onChange={(e) => setFiltros((f) => ({ ...f, estado: e.target.value }))}
        >
          <option value="">Todos</option>
          {estadosReq.map((s) => <option key={s} value={s}>{s}</option>)}
        </Selector>
      )}
      {filtrosActivos.has('liderTecnico') && (
        <Selector
          etiqueta="Líder técnico"
          compacto
          value={filtros.liderTecnico}
          onChange={(e) => setFiltros((f) => ({ ...f, liderTecnico: e.target.value }))}
        >
          <option value="">Todos</option>
          {lideresDisponibles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </Selector>
      )}
      {filtrosActivos.has('estadoEntrega') && (
        <Selector
          etiqueta="Estado (entregas)"
          compacto
          value={filtros.estadoEntrega}
          onChange={(e) => setFiltros((f) => ({ ...f, estadoEntrega: e.target.value }))}
        >
          <option value="">Todos</option>
          {estadosEnt.map((s) => <option key={s} value={s}>{s}</option>)}
        </Selector>
      )}
      {filtrosActivos.has('ansEstimacion') && (
        <Selector
          etiqueta="ANS Estimación"
          compacto
          value={filtros.ansEstimacion}
          onChange={(e) => setFiltros((f) => ({ ...f, ansEstimacion: e.target.value }))}
        >
          <option value="">Todos</option>
          <option value="CUMPLE">Cumple</option>
          <option value="NO CUMPLE">No cumple</option>
        </Selector>
      )}
      {filtrosActivos.has('categoria') && (
        <Selector
          etiqueta="Categoría"
          compacto
          value={filtros.categoria}
          onChange={(e) => setFiltros((f) => ({ ...f, categoria: e.target.value }))}
        >
          <option value="">Todas</option>
          {categoriasDisponibles.map((c) => <option key={c} value={c}>{c}</option>)}
        </Selector>
      )}
      {filtrosActivos.has('tipificacion') && (
        <Selector
          etiqueta="Tipificación"
          compacto
          value={filtros.tipificacion}
          onChange={(e) => setFiltros((f) => ({ ...f, tipificacion: e.target.value }))}
        >
          <option value="">Todas</option>
          {tipificacionesDisponibles.map((t) => <option key={t} value={t}>{t}</option>)}
        </Selector>
      )}
      {filtrosActivos.has('tipoCosto') && (
        <Selector
          etiqueta="Tipo de costo"
          compacto
          value={filtros.tipoCosto}
          onChange={(e) => setFiltros((f) => ({ ...f, tipoCosto: e.target.value }))}
        >
          <option value="">Todos</option>
          {tiposCostoDisponibles.map((t) => <option key={t} value={t}>{t}</option>)}
        </Selector>
      )}
      {filtrosActivos.has('fechaSolicitud') && (
        <div className="grupo-filtro">
          <span className="etiqueta">Fecha y hora de solicitud</span>
          <div className="flex items-center gap-1">
            <Campo
              compacto
              type="date"
              value={filtros.fechaSolicitudDesde}
              onChange={(e) => setFiltros((f) => ({ ...f, fechaSolicitudDesde: e.target.value }))}
            />
            <span className="text-xs text-slate-400">–</span>
            <Campo
              compacto
              type="date"
              value={filtros.fechaSolicitudHasta}
              onChange={(e) => setFiltros((f) => ({ ...f, fechaSolicitudHasta: e.target.value }))}
            />
          </div>
        </div>
      )}
      {filtrosActivos.has('fechaComprometida') && (
        <div className="grupo-filtro">
          <span className="etiqueta">Fecha comprometida</span>
          <div className="flex items-center gap-1">
            <Campo
              compacto
              type="date"
              value={filtros.fechaComprometidaDesde}
              onChange={(e) => setFiltros((f) => ({ ...f, fechaComprometidaDesde: e.target.value }))}
            />
            <span className="text-xs text-slate-400">–</span>
            <Campo
              compacto
              type="date"
              value={filtros.fechaComprometidaHasta}
              onChange={(e) => setFiltros((f) => ({ ...f, fechaComprometidaHasta: e.target.value }))}
            />
          </div>
        </div>
      )}
      {filtrosActivos.has('fechaLimite') && (
        <div className="grupo-filtro">
          <span className="etiqueta">Fecha real entrega de estimaciones</span>
          <div className="flex items-center gap-1">
            <Campo
              compacto
              type="date"
              value={filtros.fechaLimiteDesde}
              onChange={(e) => setFiltros((f) => ({ ...f, fechaLimiteDesde: e.target.value }))}
            />
            <span className="text-xs text-slate-400">–</span>
            <Campo
              compacto
              type="date"
              value={filtros.fechaLimiteHasta}
              onChange={(e) => setFiltros((f) => ({ ...f, fechaLimiteHasta: e.target.value }))}
            />
          </div>
        </div>
      )}
    </BarraFiltros>
  )
}
