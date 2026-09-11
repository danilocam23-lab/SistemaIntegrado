import type { EstadosConfigurablesState } from './useEstadosConfigurables'

type Props = EstadosConfigurablesState

export function SeccionEstados({
  estReq,
  estEnt,
  nuevoEstReq,
  setNuevoEstReq,
  nuevoEstEnt,
  setNuevoEstEnt,
  estAviso,
  estOk,
  agregarEstadoReq,
  quitarEstadoReq,
  agregarEstadoEnt,
  quitarEstadoEnt,
}: Props) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">
        Configura los estados disponibles para requerimientos y entregas. Los cambios se reflejan
        automáticamente al crear o editar requerimientos.
      </p>

      {estAviso && <div className="aviso aviso-error">{estAviso}</div>}
      {estOk && <div className="aviso aviso-exito">{estOk}</div>}

      {/* Estados de Requerimiento */}
      <div className="tarjeta tarjeta-pad">
        <h2 className="etiqueta-sup mb-3">
          Estados de Requerimiento
        </h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {estReq.map((e) => (
            <span key={e} className="chip chip-marca">
              {e}
              <button onClick={() => quitarEstadoReq(e)} className="enlace-accion enlace-accion-peligro ml-1" title="Quitar">✕</button>
            </span>
          ))}
          {estReq.length === 0 && <span className="text-sm text-slate-400">Sin estados configurados</span>}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={nuevoEstReq}
            onChange={(e) => setNuevoEstReq(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), agregarEstadoReq())}
            placeholder="Nuevo estado (ej: EN REVISION)"
            className="campo w-72"
          />
          <button onClick={agregarEstadoReq} className="btn btn-primario btn-sm">
            Agregar
          </button>
        </div>
      </div>

      {/* Estados de Entrega */}
      <div className="tarjeta tarjeta-pad">
        <h2 className="etiqueta-sup mb-3">
          Estados de Entrega
        </h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {estEnt.map((e) => (
            <span key={e} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-800">
              {e}
              <button onClick={() => quitarEstadoEnt(e)} className="enlace-accion enlace-accion-peligro ml-1" title="Quitar">✕</button>
            </span>
          ))}
          {estEnt.length === 0 && <span className="text-sm text-slate-400">Sin estados configurados</span>}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={nuevoEstEnt}
            onChange={(e) => setNuevoEstEnt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), agregarEstadoEnt())}
            placeholder="Nuevo estado (ej: EN GARANTIA)"
            className="campo w-72"
          />
          <button onClick={agregarEstadoEnt} className="btn btn-primario btn-sm">
            Agregar
          </button>
        </div>
      </div>
    </div>
  )
}
