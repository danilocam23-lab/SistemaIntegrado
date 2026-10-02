// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Boton, Chip, Icono, TablaScroll } from '../../components/ui'
import type { Categoria, Persona } from '../../types'
import { FACTOR_HORAS_REALES } from './carga'
import type { CargaPersona } from './carga'
import { tonoEstadoChip } from './estados'
import type { AsignacionItem, GrupoReq } from './tipos'
import type { useEscriturasAsignaciones } from './useEscriturasAsignaciones'
import { FilaAsignacion } from './FilaAsignacion'
import { FilaAsignacionMovil } from './FilaAsignacionMovil'
import { ModalDetalleHorasAzure } from './ModalDetalleHorasAzure'

interface Props {
  grupo: GrupoReq
  expandido: boolean
  onToggle: (reqId: string | null) => void
  puedeEditarAsignaciones: boolean
  personaPorId: Map<string, Persona>
  personaPorEmail: Map<string, Persona>
  categoriaPorId: Map<string, Categoria>
  editandoAsigId: string | undefined
  cargaDe: (personaId: string) => CargaPersona
  escrituras: ReturnType<typeof useEscriturasAsignaciones>
  erroresFila: Record<string, string>
  onCerrarError: (asigId: string) => void
  onEditar: (asig: AsignacionItem) => void
  onEliminar: (asig: AsignacionItem) => void
  /** "+ Asignar" del grupo: abre el panel con el requerimiento ya elegido. */
  onAsignar: (reqId: string | null) => void
  onAsignarSintetica: (personaId: string, reqId: string | null) => void
}

const suma = (grupo: GrupoReq, campo: 'originalEstimate' | 'completedWork' | 'remainingWork') =>
  grupo.items.reduce((sum, item) => sum + (item.horasAzure?.[campo] ?? 0), 0)

/**
 * Cabecera de un grupo (acta/requerimiento) + su tabla de asignaciones,
 * colapsable. Si el requerimiento no tiene horas estimadas (`0` o `null`),
 * el bloque de horas de la cabecera no se muestra. Con Feature de Azure
 * vinculada, la cabecera muestra la barra de avance (trabajado / estimado).
 */
export function GrupoRequerimiento({
  grupo,
  expandido,
  onToggle,
  puedeEditarAsignaciones,
  personaPorId,
  personaPorEmail,
  categoriaPorId,
  editandoAsigId,
  cargaDe,
  escrituras,
  erroresFila,
  onCerrarError,
  onEditar,
  onEliminar,
  onAsignar,
  onAsignarSintetica,
}: Props) {
  const [mostrarDetalle, setMostrarDetalle] = useState(false)

  const tieneAzure = grupo.idAzureHitss !== null
  const columnas = 7 + (tieneAzure ? 3 : 0)
  const sinPersona = tieneAzure ? grupo.horasAzureSinPersona : null
  const mostrarSinPersona = sinPersona !== null && (
    sinPersona.originalEstimate > 0 || sinPersona.completedWork > 0 || sinPersona.remainingWork > 0
  )
  const total = grupo.horasAzureTotal
  const avanceAzure = total && total.originalEstimate > 0 ? (total.completedWork / total.originalEstimate) * 100 : null
  const nAsignaciones = grupo.items.filter((item) => !item.sinAsignacionFormal).length

  return (
    <section className="tarjeta overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-100 bg-slate-50 px-3.5 py-2.5">
        <button
          type="button"
          onClick={() => onToggle(grupo.reqId)}
          aria-expanded={expandido}
          title={grupo.reqLabel}
          className="flex min-w-0 flex-1 basis-56 items-center gap-2 rounded text-left"
        >
          <Icono nombre="chevron-abajo" className={`shrink-0 text-slate-500 transition-transform ${expandido ? '' : '-rotate-90'}`} />
          <span className="min-w-0 truncate text-sm font-semibold text-marca-osc">{grupo.reqLabel}</span>
        </button>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
          {grupo.reqId && !!grupo.horasEstimadas && (
            <>
              <div>
                Horas est.
                <b className="block text-xs normal-case tracking-normal tabular-nums text-slate-900">
                  {grupo.horasEstimadas.toFixed(1)} h
                </b>
              </div>
              <div>
                Horas reales ({Math.round(FACTOR_HORAS_REALES * 100)}%)
                <b className="block text-xs normal-case tracking-normal tabular-nums text-slate-900">
                  {(grupo.horasEstimadas * FACTOR_HORAS_REALES).toFixed(1)} h
                </b>
              </div>
            </>
          )}
          {avanceAzure !== null && total && (
            <div className="min-w-[140px]" title={`Azure: trabajado ${total.completedWork.toFixed(1)} h de ${total.originalEstimate.toFixed(1)} h estimadas`}>
              Azure
              <b className="block text-xs normal-case tracking-normal tabular-nums text-slate-900">
                {Math.round(avanceAzure)}% · {total.completedWork.toFixed(1)} / {total.originalEstimate.toFixed(1)} h
              </b>
              <span
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(100, Math.round(avanceAzure))}
                aria-label={`Avance de Azure ${Math.round(avanceAzure)}%`}
                className="mt-0.5 block h-[5px] overflow-hidden rounded-full bg-slate-200"
              >
                <span
                  className={`block h-full rounded-full ${avanceAzure > 100 ? 'bg-amber-500' : 'bg-marca-600'}`}
                  style={{ width: `${Math.min(100, avanceAzure)}%` }}
                />
              </span>
            </div>
          )}
          {mostrarSinPersona && sinPersona && (
            <div>
              Sin persona (Azure)
              <b className="block text-xs normal-case tracking-normal tabular-nums text-slate-900">
                {`Est ${sinPersona.originalEstimate.toFixed(1)}h · Trab ${sinPersona.completedWork.toFixed(1)}h · Rest ${sinPersona.remainingWork.toFixed(1)}h`}
              </b>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {grupo.reqId && (
            <Link to={`/requerimientos/${grupo.reqId}`} className="enlace-accion text-xs">
              Ver req
            </Link>
          )}
          {tieneAzure && (
            <button type="button" onClick={() => setMostrarDetalle(true)} className="enlace-accion text-xs">
              Detalle
            </button>
          )}
          <Chip tono={tonoEstadoChip(grupo.reqEstado)}>{grupo.reqEstado ?? 'Sin estado'}</Chip>
          <Chip tono="neutro">
            {nAsignaciones} asignación{nAsignaciones === 1 ? '' : 'es'}
          </Chip>
          {puedeEditarAsignaciones && (
            <Boton tamano="sm" variante="suave" onClick={() => onAsignar(grupo.reqId)}>
              + Asignar
            </Boton>
          )}
        </div>
      </div>

      {expandido && (
        <>
          <div className="hidden md:block">
            <TablaScroll plano>
              <table className="tabla">
                <thead>
                  <tr>
                    <th className="text-left">Persona</th>
                    <th className="text-left">Categoría</th>
                    <th className="text-center">Prioridad</th>
                    <th className="text-left">Carga total</th>
                    <th className="text-right">% carga</th>
                    <th className="text-right">Horas según carga</th>
                    {tieneAzure && (
                      <>
                        <th className="text-center">Azure: Estimado</th>
                        <th className="text-center">Azure: Trabajado</th>
                        <th className="text-center">Azure: Restante</th>
                      </>
                    )}
                    <th className="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {grupo.items.map((item) => (
                    <FilaAsignacion
                      key={item.asig.id}
                      item={item}
                      personaPorId={personaPorId}
                      categoriaPorId={categoriaPorId}
                      puedeEditarAsignaciones={puedeEditarAsignaciones}
                      resaltada={editandoAsigId === item.asig.id}
                      cargaPersona={cargaDe(item.asig.persona_id)}
                      escrituras={escrituras}
                      errorFila={erroresFila[item.asig.id]}
                      onCerrarError={onCerrarError}
                      onEditar={onEditar}
                      onEliminar={onEliminar}
                      onAsignarSintetica={onAsignarSintetica}
                      columnas={columnas}
                    />
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-semibold">
                  <tr>
                    <td colSpan={5} className="text-left">Total</td>
                    <td className="text-right tabular-nums">
                      {grupo.items.reduce((sum, item) => sum + item.horasCarga, 0).toFixed(1)} h
                    </td>
                    {tieneAzure && (
                      <>
                        <td className="text-right tabular-nums">{suma(grupo, 'originalEstimate').toFixed(1)} h</td>
                        <td className="text-right tabular-nums">{suma(grupo, 'completedWork').toFixed(1)} h</td>
                        <td className="text-right tabular-nums">{suma(grupo, 'remainingWork').toFixed(1)} h</td>
                      </>
                    )}
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </TablaScroll>
          </div>

          <ul className="grid gap-2 p-2.5 md:hidden">
            {grupo.items.map((item) => {
              const nombre = personaPorId.get(item.asig.persona_id)?.nombre ?? item.asig.persona_id
              return (
                <FilaAsignacionMovil
                  key={item.asig.id}
                  asig={item.asig}
                  titulo={nombre}
                  nombreAvatar={nombre}
                  detalle={
                    item.sinAsignacionFormal
                      ? 'Horas de Azure sin asignación'
                      : (categoriaPorId.get(item.asig.categoria_id)?.nombre ?? item.asig.categoria_id)
                  }
                  horasCarga={item.horasCarga}
                  cargaPersona={item.sinAsignacionFormal ? undefined : cargaDe(item.asig.persona_id)}
                  horasAzure={item.horasAzure}
                  sinAsignacionFormal={item.sinAsignacionFormal}
                  puedeEditar={puedeEditarAsignaciones}
                  escrituras={escrituras}
                  errorFila={erroresFila[item.asig.id]}
                  onCerrarError={onCerrarError}
                  onEditar={onEditar}
                  onEliminar={onEliminar}
                  onAsignarSintetica={() => onAsignarSintetica(item.asig.persona_id, grupo.reqId)}
                />
              )
            })}
            <li className="px-1 text-xs font-semibold text-slate-600">
              Total: {grupo.items.reduce((sum, item) => sum + item.horasCarga, 0).toFixed(1)} h según carga
              {tieneAzure && ` · Azure ${suma(grupo, 'completedWork').toFixed(1)} h trabajadas`}
            </li>
          </ul>
        </>
      )}

      {mostrarDetalle && grupo.idAzureHitss !== null && (
        <ModalDetalleHorasAzure
          idAzureHitss={grupo.idAzureHitss}
          reqLabel={grupo.reqLabel}
          personaPorEmail={personaPorEmail}
          onCerrar={() => setMostrarDetalle(false)}
        />
      )}
    </section>
  )
}
