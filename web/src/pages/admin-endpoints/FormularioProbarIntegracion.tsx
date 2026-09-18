// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import type { FormEvent, ReactNode } from 'react'
import { Boton, Campo, Selector } from '../../components/ui'
import type { Aplicacion } from '../../types'

interface Props {
  titulo: string
  descripcion: ReactNode
  etiquetaApiKey: string
  placeholderApiKey: string
  apiKey: string
  onApiKeyChange: (valor: string) => void
  apps: Aplicacion[]
  aplicacion: string
  onAplicacionChange: (valor: string) => void
  /** Campo adicional propio de un endpoint (p. ej. "Estado" en requerimientos). */
  campoExtra?: ReactNode
  cargando: boolean
  onSubmit: (e: FormEvent) => void
  urlPreview: ReactNode
}

/**
 * Bloque genérico de "probar integración": X-API-Key + aplicación/squad opcional +
 * botón de prueba + previsualización de la URL. Común a los ~4 endpoints de
 * `/api/integracion/*` (cada uno con su propia API Key, ver `api/README.md`).
 */
export function FormularioProbarIntegracion({
  titulo,
  descripcion,
  etiquetaApiKey,
  placeholderApiKey,
  apiKey,
  onApiKeyChange,
  apps,
  aplicacion,
  onAplicacionChange,
  campoExtra,
  cargando,
  onSubmit,
  urlPreview,
}: Props) {
  return (
    <form onSubmit={onSubmit} className="tarjeta tarjeta-pad">
      <div className="mb-3">
        <h2 className="titulo-seccion">{titulo}</h2>
        <p className="text-xs text-slate-500">{descripcion}</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">{etiquetaApiKey}</span>
          <Campo
            type="password"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder={placeholderApiKey}
            required
            className="min-w-72"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Aplicación / squad (opcional)</span>
          <Selector
            value={aplicacion}
            onChange={(e) => onAplicacionChange(e.target.value)}
            className="min-w-64"
          >
            <option value="">Todas</option>
            {apps.map((a) => (
              <option key={a.codigo} value={a.codigo}>
                {a.nombre} ({a.codigo})
              </option>
            ))}
          </Selector>
        </label>
        {campoExtra}
        <Boton
          variante="primario"
          type="submit"
          disabled={cargando}
        >
          {cargando ? 'Probando...' : 'Probar endpoint'}
        </Boton>
      </div>
      <p className="mt-2 font-mono text-xs text-slate-500">{urlPreview}</p>
    </form>
  )
}
