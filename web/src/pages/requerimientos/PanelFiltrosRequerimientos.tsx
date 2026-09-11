import type { Dispatch, SetStateAction } from 'react'
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
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Filtros</span>
        {hayFiltrosActivos && (
          <button onClick={() => setFiltros(FILTROS_INIT)} className="enlace-accion enlace-accion-peligro text-xs">
            Limpiar filtros
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {/* Código REQ */}
        {filtrosActivos.has('codigoReq') && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Código REQ</label>
          <input type="text" value={filtros.codigoReq} placeholder="Buscar..."
            onChange={(e) => setFiltros((f) => ({ ...f, codigoReq: e.target.value }))}
            className="campo campo-sm w-full" />
        </div>
        )}
        {/* SC */}
        {filtrosActivos.has('sc') && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">SC</label>
          <input type="text" value={filtros.sc} placeholder="Buscar..."
            onChange={(e) => setFiltros((f) => ({ ...f, sc: e.target.value }))}
            className="campo campo-sm w-full" />
        </div>
        )}
        {/* Squad */}
        {filtrosActivos.has('squad') && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Squad</label>
          <select value={filtros.squad}
            onChange={(e) => setFiltros((f) => ({ ...f, squad: e.target.value }))}
            className="campo campo-sm w-full">
            <option value="">Todos</option>
            {squadsDisponibles.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        )}
        {/* Estado */}
        {filtrosActivos.has('estado') && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Estado</label>
          <select value={filtros.estado}
            onChange={(e) => setFiltros((f) => ({ ...f, estado: e.target.value }))}
            className="campo campo-sm w-full">
            <option value="">Todos</option>
            {estadosReq.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        )}
        {/* Líder técnico */}
        {filtrosActivos.has('liderTecnico') && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Líder técnico</label>
          <select value={filtros.liderTecnico}
            onChange={(e) => setFiltros((f) => ({ ...f, liderTecnico: e.target.value }))}
            className="campo campo-sm w-full">
            <option value="">Todos</option>
            {lideresDisponibles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        )}
        {/* Estado entregas */}
        {filtrosActivos.has('estadoEntrega') && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Estado (entregas)</label>
          <select value={filtros.estadoEntrega}
            onChange={(e) => setFiltros((f) => ({ ...f, estadoEntrega: e.target.value }))}
            className="campo campo-sm w-full">
            <option value="">Todos</option>
            {estadosEnt.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        )}
        {/* ANS Estimación */}
        {filtrosActivos.has('ansEstimacion') && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">ANS Estimación</label>
          <select value={filtros.ansEstimacion}
            onChange={(e) => setFiltros((f) => ({ ...f, ansEstimacion: e.target.value }))}
            className="campo campo-sm w-full">
            <option value="">Todos</option>
            <option value="CUMPLE">Cumple</option>
            <option value="NO CUMPLE">No cumple</option>
          </select>
        </div>
        )}
        {/* Categoría */}
        {filtrosActivos.has('categoria') && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Categoría</label>
          <select value={filtros.categoria}
            onChange={(e) => setFiltros((f) => ({ ...f, categoria: e.target.value }))}
            className="campo campo-sm w-full">
            <option value="">Todas</option>
            {categoriasDisponibles.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        )}
        {/* Tipificación */}
        {filtrosActivos.has('tipificacion') && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Tipificación</label>
          <select value={filtros.tipificacion}
            onChange={(e) => setFiltros((f) => ({ ...f, tipificacion: e.target.value }))}
            className="campo campo-sm w-full">
            <option value="">Todas</option>
            {tipificacionesDisponibles.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        )}
        {/* Tipo de costo */}
        {filtrosActivos.has('tipoCosto') && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Tipo de costo</label>
          <select value={filtros.tipoCosto}
            onChange={(e) => setFiltros((f) => ({ ...f, tipoCosto: e.target.value }))}
            className="campo campo-sm w-full">
            <option value="">Todos</option>
            {tiposCostoDisponibles.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        )}
        {/* Fecha solicitud */}
        {filtrosActivos.has('fechaSolicitud') && (
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">Fecha y hora de solicitud</label>
          <div className="flex items-center gap-1">
            <input type="date" value={filtros.fechaSolicitudDesde}
              onChange={(e) => setFiltros((f) => ({ ...f, fechaSolicitudDesde: e.target.value }))}
              className="campo campo-sm w-full" />
            <span className="text-xs text-slate-400">–</span>
            <input type="date" value={filtros.fechaSolicitudHasta}
              onChange={(e) => setFiltros((f) => ({ ...f, fechaSolicitudHasta: e.target.value }))}
              className="campo campo-sm w-full" />
          </div>
        </div>
        )}
        {/* Fecha comprometida */}
        {filtrosActivos.has('fechaComprometida') && (
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">Fecha comprometida</label>
          <div className="flex items-center gap-1">
            <input type="date" value={filtros.fechaComprometidaDesde}
              onChange={(e) => setFiltros((f) => ({ ...f, fechaComprometidaDesde: e.target.value }))}
              className="campo campo-sm w-full" />
            <span className="text-xs text-slate-400">–</span>
            <input type="date" value={filtros.fechaComprometidaHasta}
              onChange={(e) => setFiltros((f) => ({ ...f, fechaComprometidaHasta: e.target.value }))}
              className="campo campo-sm w-full" />
          </div>
        </div>
        )}
        {/* Fecha real entrega de estimaciones */}
        {filtrosActivos.has('fechaLimite') && (
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">Fecha real entrega de estimaciones</label>
          <div className="flex items-center gap-1">
            <input type="date" value={filtros.fechaLimiteDesde}
              onChange={(e) => setFiltros((f) => ({ ...f, fechaLimiteDesde: e.target.value }))}
              className="campo campo-sm w-full" />
            <span className="text-xs text-slate-400">–</span>
            <input type="date" value={filtros.fechaLimiteHasta}
              onChange={(e) => setFiltros((f) => ({ ...f, fechaLimiteHasta: e.target.value }))}
              className="campo campo-sm w-full" />
          </div>
        </div>
        )}
      </div>
    </div>
  )
}
