// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import type { ReactNode } from 'react'
import type { EntregasActasCampo } from '../../constantes'
import { Aviso, Selector } from '../../components/ui'
import { agruparCampos } from './utilidades'
import type { CamposConfigurablesState } from './useCamposConfigurables'

interface Props extends CamposConfigurablesState {
  descripcion: ReactNode
  columnasCatalogo: EntregasActasCampo[]
  filtrosCatalogo: EntregasActasCampo[]
  bloqueado?: boolean
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
  ordenColumnas,
  cambiarPosicion,
  guardando,
  bloqueado = false,
}: Props) {
  const visibles = ordenColumnas.filter((clave) => columnas.has(clave))
  return (
    <fieldset className="min-w-0 space-y-6" disabled={bloqueado || guardando} aria-busy={bloqueado || guardando}>
      {descripcion}

      {aviso && <div role="alert"><Aviso tono="error">{aviso}</Aviso></div>}
      {(guardando || ok) && (
        <div role="status" aria-live="polite">
          {guardando ? 'Guardando configuración…' : <Aviso tono="exito">{ok}</Aviso>}
        </div>
      )}

      {/* Columnas de la tabla */}
      <div className="tarjeta tarjeta-pad">
        <h2 className="etiqueta-sup mb-3">
          Columnas de la tabla
        </h2>
        <p className="mb-3 text-sm text-slate-500">
          La posición solo afecta a la tabla, no a Excel ni a las tarjetas móviles.
          Se numeran las columnas visibles; al mover una, las demás se desplazan.
          Los cambios son globales para todos los usuarios y aplicaciones.
        </p>
        <div className="space-y-4">
          {agruparCampos(columnasCatalogo).map(({ grupo, items }) => (
            <div key={grupo}>
              <h3 className="mb-2 text-xs font-semibold text-slate-400">{grupo}</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {items.map((c) => (
                  <div key={c.key} className="min-w-0 space-y-1">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={columnas.has(c.key)}
                        onChange={() => alternarColumna(c.key)}
                      />
                      {c.label}
                    </label>
                    {columnas.has(c.key) && (
                      <Selector
                        compacto
                        aria-label={`Posición de ${c.label}`}
                        value={visibles.indexOf(c.key) + 1}
                        onChange={(evento) => cambiarPosicion(c.key, Number(evento.target.value))}
                      >
                        {visibles.map((clave, indice) => (
                          <option key={clave} value={indice + 1}>{indice + 1}</option>
                        ))}
                      </Selector>
                    )}
                  </div>
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
    </fieldset>
  )
}
