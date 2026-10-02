// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import type { ReactNode } from 'react'
import { Boton, Chip } from '../../components/ui'
import { ETIQUETA_NIVEL, formatearPct, nivelCarga, TONO_CHIP_NIVEL } from './carga'
import type { CargaPersona } from './carga'
import { AvatarPersona } from './AvatarPersona'
import { MedidorCarga } from './MedidorCarga'
import { PorcentajeEditable } from './PorcentajeEditable'
import type { AsignacionItem, HorasAzureGrupo } from './tipos'
import type { useEscriturasAsignaciones } from './useEscriturasAsignaciones'

interface Props {
  asig: AsignacionItem
  /** Nombre de la persona (en "Por Actas") o del requerimiento (en "Por Personas"). */
  titulo: ReactNode
  /** Texto de avatar (nombre de la persona); omitir en "Por Personas". */
  nombreAvatar?: string
  /** Línea secundaria: categoría y, si aplica, estado del requerimiento. */
  detalle: ReactNode
  horasCarga: number
  /** Carga total de la persona (se muestra en "Por Actas"). */
  cargaPersona?: CargaPersona
  horasAzure?: HorasAzureGrupo | null
  sinAsignacionFormal?: boolean
  puedeEditar: boolean
  escrituras: ReturnType<typeof useEscriturasAsignaciones>
  errorFila: string | undefined
  onCerrarError: (asigId: string) => void
  onEditar: (asig: AsignacionItem) => void
  onEliminar: (asig: AsignacionItem) => void
  onAsignarSintetica?: () => void
}

/**
 * Versión de tarjeta (móvil) de una fila de asignación: no se pierde ninguna
 * columna de la tabla, solo cambian de forma. Se muestra bajo `md`.
 */
export function FilaAsignacionMovil({
  asig,
  titulo,
  nombreAvatar,
  detalle,
  horasCarga,
  cargaPersona,
  horasAzure,
  sinAsignacionFormal,
  puedeEditar,
  escrituras,
  errorFila,
  onCerrarError,
  onEditar,
  onEliminar,
  onAsignarSintetica,
}: Props) {
  const nivel = cargaPersona ? nivelCarga(cargaPersona.total) : null
  return (
    <li className="grid gap-2 rounded-lg border border-slate-200 bg-white p-2.5 text-xs">
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 font-medium text-slate-800">
          {nombreAvatar && <AvatarPersona nombre={nombreAvatar} pequeno />}
          <span className="min-w-0">{titulo}</span>
        </span>
        {cargaPersona && nivel && (
          <Chip tono={TONO_CHIP_NIVEL[nivel]} title={`Carga total de la persona: ${ETIQUETA_NIVEL[nivel]}`}>
            {formatearPct(cargaPersona.total)}%
          </Chip>
        )}
      </div>
      <div className="text-slate-500">{detalle}</div>
      {cargaPersona && (
        <MedidorCarga
          activa={cargaPersona.activa}
          sinReq={cargaPersona.sinReq}
          otros={cargaPersona.otros}
          tamano="sm"
        />
      )}
      {sinAsignacionFormal ? (
        <div className="flex items-center justify-between gap-2">
          <Chip tono="neutro">Sin asignación formal</Chip>
          {puedeEditar && onAsignarSintetica && (
            <Boton tamano="sm" variante="suave" onClick={onAsignarSintetica}>+ Asignar</Boton>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2">
            <PorcentajeEditable asig={asig} puedeEditar={puedeEditar} escrituras={escrituras} alinear="inicio" />
            <span className="text-slate-500 tabular-nums">· {horasCarga.toFixed(1)} h</span>
          </span>
          {puedeEditar && (
            <span className="flex items-center gap-3">
              <button type="button" onClick={() => onEditar(asig)} className="enlace-accion">Editar</button>
              <button type="button" onClick={() => onEliminar(asig)} className="enlace-accion enlace-accion-peligro">
                Eliminar
              </button>
            </span>
          )}
        </div>
      )}
      {horasAzure && (
        <div className="text-slate-500 tabular-nums">
          Azure · Est {horasAzure.originalEstimate.toFixed(1)} h · Trab {horasAzure.completedWork.toFixed(1)} h · Rest{' '}
          {horasAzure.remainingWork.toFixed(1)} h
        </div>
      )}
      {errorFila && (
        <p role="alert" className="flex items-center justify-between gap-2 rounded bg-red-50 px-2 py-1 text-red-700">
          <span>{errorFila}</span>
          <button type="button" className="enlace-accion enlace-accion-sutil" onClick={() => onCerrarError(asig.id)}>
            Cerrar
          </button>
        </p>
      )}
    </li>
  )
}
