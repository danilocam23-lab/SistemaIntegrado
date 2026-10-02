// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Boton, Chip, cx } from '../../components/ui'
import type { Categoria, Persona } from '../../types'
import { ETIQUETA_NIVEL, formatearPct, nivelCarga } from './carga'
import type { CargaPersona } from './carga'
import { AvatarPersona } from './AvatarPersona'
import { MedidorCarga } from './MedidorCarga'
import { PorcentajeEditable } from './PorcentajeEditable'
import type { AsignacionItem, ItemGrupo } from './tipos'
import type { useEscriturasAsignaciones } from './useEscriturasAsignaciones'

interface Props {
  item: ItemGrupo
  personaPorId: Map<string, Persona>
  categoriaPorId: Map<string, Categoria>
  puedeEditarAsignaciones: boolean
  resaltada: boolean
  cargaPersona: CargaPersona
  escrituras: ReturnType<typeof useEscriturasAsignaciones>
  errorFila: string | undefined
  onCerrarError: (asigId: string) => void
  onEditar: (asig: AsignacionItem) => void
  onEliminar: (asig: AsignacionItem) => void
  /** Abre el panel "Asignar" con persona y requerimiento ya cargados (fila sintética de Azure). */
  onAsignarSintetica: (personaId: string, reqId: string | null) => void
  /** Nº de columnas de la tabla (para el colSpan de la fila de error). */
  columnas: number
}

/**
 * Fila de una asignación dentro de la tabla de un grupo (acta/requerimiento):
 * persona, categoría, prioridad (estrella), carga total de la persona, % de
 * carga (editable en línea) y acciones. La fila sintética de Azure ("Sin
 * asignación formal") es de solo lectura, con un botón "+ Asignar".
 *
 * INVARIANTE: no lleva `React.memo` ni recibe `key` propia (la pone quien
 * mapea sobre `grupo.items`, con `asig.id`, en `GrupoRequerimiento`): el
 * orden de montaje/desmontaje del input de edición en línea al hacer blur
 * depende de eso.
 */
export function FilaAsignacion({
  item,
  personaPorId,
  categoriaPorId,
  puedeEditarAsignaciones,
  resaltada,
  cargaPersona,
  escrituras,
  errorFila,
  onCerrarError,
  onEditar,
  onEliminar,
  onAsignarSintetica,
  columnas,
}: Props) {
  const { asig, horasCarga, horasAzure, sinAsignacionFormal } = item
  const nombre = personaPorId.get(asig.persona_id)?.nombre ?? asig.persona_id
  const nivel = nivelCarga(cargaPersona.total)
  const reqId = asig.proyectos[0]?.requerimiento_id ?? null

  return (
    <>
      <tr className={cx(resaltada && 'bg-amber-50', sinAsignacionFormal && 'bg-slate-50')}>
        <td>
          <span className={cx('inline-flex items-center gap-2', sinAsignacionFormal && 'italic text-slate-600')}>
            <AvatarPersona nombre={nombre} pequeno />
            <span className="font-medium">{nombre}</span>
            {sinAsignacionFormal && <Chip tono="neutro">Sin asignación formal</Chip>}
          </span>
        </td>
        <td>{sinAsignacionFormal ? '—' : (categoriaPorId.get(asig.categoria_id)?.nombre ?? asig.categoria_id)}</td>
        <td className="text-center">
          {sinAsignacionFormal ? (
            <span className="text-slate-300">—</span>
          ) : (
            <Boton
              variante="fantasma"
              tamano="sm"
              aria-pressed={asig.prioridad === true}
              aria-label={asig.prioridad === true ? 'Quitar prioridad' : 'Marcar como prioridad'}
              title={asig.prioridad === true ? 'Quitar prioridad' : 'Marcar como prioridad'}
              disabled={!puedeEditarAsignaciones}
              onClick={() => void escrituras.cambiarPrioridad(asig)}
              className={asig.prioridad === true ? '!text-amber-500' : '!text-slate-300'}
            >
              <span aria-hidden="true">{asig.prioridad === true ? '★' : '☆'}</span>
            </Boton>
          )}
        </td>
        <td>
          {sinAsignacionFormal ? (
            <span className="text-slate-300">—</span>
          ) : (
            <div className="w-32" title={`${ETIQUETA_NIVEL[nivel]} · ${cargaPersona.horas.toFixed(1)} h de ${formatearPct(cargaPersona.capacidadHoras)} h`}>
              <MedidorCarga
                activa={cargaPersona.activa}
                sinReq={cargaPersona.sinReq}
                otros={cargaPersona.otros}
                tamano="sm"
                etiqueta={nombre}
              />
              <span className="mt-0.5 block text-[10px] tabular-nums text-slate-500">
                {formatearPct(cargaPersona.total)}% · {ETIQUETA_NIVEL[nivel]}
              </span>
            </div>
          )}
        </td>
        <td className="text-right font-medium">
          {sinAsignacionFormal ? (
            <span className="text-slate-400">—</span>
          ) : (
            <PorcentajeEditable asig={asig} puedeEditar={puedeEditarAsignaciones} escrituras={escrituras} />
          )}
        </td>
        <td className="text-right text-slate-700">{sinAsignacionFormal ? '—' : `${horasCarga.toFixed(1)} h`}</td>
        {horasAzure !== null && (
          <>
            <td className="text-right text-slate-700">{horasAzure.originalEstimate.toFixed(1)} h</td>
            <td className="text-right text-slate-700">{horasAzure.completedWork.toFixed(1)} h</td>
            <td className="text-right text-slate-700">{horasAzure.remainingWork.toFixed(1)} h</td>
          </>
        )}
        <td className="whitespace-nowrap text-center">
          {sinAsignacionFormal ? (
            puedeEditarAsignaciones ? (
              <Boton tamano="sm" variante="suave" onClick={() => onAsignarSintetica(asig.persona_id, reqId)}>
                + Asignar
              </Boton>
            ) : (
              <span className="text-slate-300">—</span>
            )
          ) : puedeEditarAsignaciones && (
            <div className="flex items-center justify-center gap-3">
              <button type="button" onClick={() => onEditar(asig)} className="enlace-accion">
                Editar
              </button>
              <button type="button" onClick={() => onEliminar(asig)} className="enlace-accion enlace-accion-peligro">
                Eliminar
              </button>
            </div>
          )}
        </td>
      </tr>
      {errorFila && (
        <tr className="bg-red-50">
          <td colSpan={columnas} className="!py-2 text-sm text-red-700">
            <span role="alert" className="flex flex-wrap items-center justify-between gap-2">
              <span>{errorFila}</span>
              <button type="button" className="enlace-accion enlace-accion-sutil" onClick={() => onCerrarError(asig.id)}>
                Cerrar
              </button>
            </span>
          </td>
        </tr>
      )}
    </>
  )
}
