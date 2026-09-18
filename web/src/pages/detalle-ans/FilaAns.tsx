// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Boton, Campo, Chip } from '../../components/ui'
import type { TonoChip } from './utilidadesAns'

export interface CampoDetalleAns {
  etiqueta: string
  valor: ReactNode
  ancho?: 1 | 2
}

interface Props {
  /** Código REQ (con su `Link`) y, para entregas, el badge de N° de entrega. */
  identidad: ReactNode
  nombre: string
  tono: TonoChip
  etiquetaAns: string
  dias: { dias: number; esNegativo: boolean } | null
  seLevanto: boolean
  puedeEditar: boolean
  guardandoCheck: boolean
  onCambiarCheck: (checked: boolean) => void
  camposDetalle: CampoDetalleAns[]
  obsValor: string
  onCambiarObs: (valor: string) => void
  guardandoObs: boolean
  onGuardarObs: () => void
  /** El usuario ya está editando la observación de esta fila (viene de
   * `obsEdicion`): se despliega sola, mismo criterio que `TarjetaEntrega`
   * en `SeccionEntregas.tsx`. */
  forzarExpandido: boolean
}

function CampoAns({ etiqueta, valor, ancho }: CampoDetalleAns) {
  return (
    <div className={ancho === 2 ? 'col-span-2' : undefined}>
      <p className="etiqueta-sup mb-0.5">{etiqueta}</p>
      <div className="text-sm text-slate-700">{valor}</div>
    </div>
  )
}

/** Fila densa de la lista ANS (Requerimientos o Entregas): siempre visible el
 * código, el nombre, el Chip de cumplimiento ANS, los días de atraso/adelanto
 * y el checkbox "¿Incumplió ANS?" (es una acción, no un dato secundario). El
 * resto de campos y la edición de observaciones quedan tras "Ver más". */
export default function FilaAns({
  identidad,
  nombre,
  tono,
  etiquetaAns,
  dias,
  seLevanto,
  puedeEditar,
  guardandoCheck,
  onCambiarCheck,
  camposDetalle,
  obsValor,
  onCambiarObs,
  guardandoObs,
  onGuardarObs,
  forzarExpandido,
}: Props) {
  const [expandido, setExpandido] = useState(forzarExpandido)

  useEffect(() => {
    if (forzarExpandido && !expandido) setExpandido(true)
  }, [forzarExpandido, expandido])

  return (
    <div className="border-b border-slate-100 px-3 py-3 last:border-0 hover:bg-slate-50/70">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="shrink-0">{identidad}</div>
          <p className="truncate text-sm text-slate-700" title={nombre || undefined}>
            {nombre || '—'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          <Chip tono={tono}>{etiquetaAns}</Chip>
          {dias ? (
            <span
              className={`text-xs font-semibold tabular-nums ${dias.esNegativo ? 'text-red-600' : 'text-emerald-600'}`}
              title="Días de atraso/adelanto"
            >
              {dias.esNegativo ? '-' : '+'}
              {dias.dias}d
            </span>
          ) : (
            <span className="text-xs text-slate-400">—</span>
          )}
          <label
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold ${
              seLevanto ? 'border-green-200 bg-green-50 text-green-700' : 'border-slate-200 bg-slate-50 text-slate-600'
            }`}
          >
            <input
              type="checkbox"
              checked={seLevanto}
              disabled={!puedeEditar || guardandoCheck}
              onChange={(ev) => onCambiarCheck(ev.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-marca focus:ring-marca"
            />
            {guardandoCheck ? '…' : seLevanto ? 'Sí' : 'No'}
          </label>
          <button
            type="button"
            onClick={() => setExpandido((v) => !v)}
            className="enlace-accion enlace-accion-sutil"
          >
            {expandido ? 'Ver menos' : 'Ver más'}
          </button>
        </div>
      </div>

      {expandido && (
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-3 sm:grid-cols-4">
          {camposDetalle.map((campo) => (
            <CampoAns key={campo.etiqueta} {...campo} />
          ))}
          <div className="col-span-2 sm:col-span-4">
            <p className="etiqueta-sup mb-0.5">Observaciones</p>
            <div className="flex min-w-0 gap-1.5">
              <Campo
                value={obsValor}
                onChange={(ev) => onCambiarObs(ev.target.value)}
                readOnly={!puedeEditar}
                compacto
                className="min-w-0 flex-1"
                placeholder={puedeEditar ? 'Observaciones…' : ''}
              />
              {puedeEditar && (
                <Boton
                  variante="primario"
                  tamano="sm"
                  className="shrink-0"
                  type="button"
                  onClick={onGuardarObs}
                  disabled={guardandoObs}
                >
                  {guardandoObs ? '…' : 'Guardar'}
                </Boton>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
