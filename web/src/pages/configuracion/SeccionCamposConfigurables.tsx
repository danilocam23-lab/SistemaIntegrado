import type { ReactNode } from 'react'
import type { EntregasActasCampo } from '../../constantes'
import { Aviso } from '../../components/ui'
import { agruparCampos } from './utilidades'
import type { CamposConfigurablesState } from './useCamposConfigurables'

interface Props extends CamposConfigurablesState {
  descripcion: ReactNode
  columnasCatalogo: EntregasActasCampo[]
  filtrosCatalogo: EntregasActasCampo[]
}

export function SeccionCamposConfigurables({
  descripcion,
  columnasCatalogo,
  filtrosCatalogo,
  columnas,
  filtros,
  exportCampos,
  aviso,
  ok,
  alternarColumna,
  alternarFiltro,
  alternarExport,
}: Props) {
  return (
    <div className="space-y-6">
      {descripcion}

      {aviso && <Aviso tono="error">{aviso}</Aviso>}
      {ok && <Aviso tono="exito">{ok}</Aviso>}

      {/* Columnas de la tabla */}
      <div className="tarjeta tarjeta-pad">
        <h2 className="etiqueta-sup mb-3">
          Columnas de la tabla
        </h2>
        <div className="space-y-4">
          {agruparCampos(columnasCatalogo).map(({ grupo, items }) => (
            <div key={grupo}>
              <h3 className="mb-2 text-xs font-semibold text-slate-400">{grupo}</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {items.map((c) => (
                  <label key={c.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={columnas.has(c.key)}
                      onChange={() => alternarColumna(c.key)}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filtros de búsqueda */}
      <div className="tarjeta tarjeta-pad">
        <h2 className="etiqueta-sup mb-3">
          Filtros de búsqueda
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {filtrosCatalogo.map((f) => (
            <label key={f.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filtros.has(f.key)}
                onChange={() => alternarFiltro(f.key)}
              />
              {f.label}
            </label>
          ))}
        </div>
      </div>

      {/* Campos de exportación a Excel */}
      <div className="tarjeta tarjeta-pad">
        <h2 className="etiqueta-sup mb-3">
          Campos incluidos al exportar a Excel
        </h2>
        <div className="space-y-4">
          {agruparCampos(columnasCatalogo).map(({ grupo, items }) => (
            <div key={grupo}>
              <h3 className="mb-2 text-xs font-semibold text-slate-400">{grupo}</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {items.map((c) => (
                  <label key={c.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={exportCampos.has(c.key)}
                      onChange={() => alternarExport(c.key)}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
