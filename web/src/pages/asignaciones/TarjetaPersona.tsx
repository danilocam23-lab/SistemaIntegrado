// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Boton, Chip, Icono, TablaScroll } from '../../components/ui'
import type { BacklogFuturo, Categoria } from '../../types'
import { ETIQUETA_NIVEL, formatearPct, nivelCarga, TONO_CHIP_NIVEL } from './carga'
import type { CargaPersona } from './carga'
import { tonoEstadoChip } from './estados'
import type { AsignacionItem, GrupoPersona, WoPersona } from './tipos'
import { AvatarPersona } from './AvatarPersona'
import { FilaAsignacionMovil } from './FilaAsignacionMovil'
import { MedidorCarga } from './MedidorCarga'
import { PorcentajeEditable } from './PorcentajeEditable'
import { TablaBacklogPersona } from './TablaBacklogPersona'
import { TablaWoPersona } from './TablaWoPersona'
import type { useEscriturasAsignaciones } from './useEscriturasAsignaciones'

interface Props {
  grupo: GrupoPersona
  expandida: boolean
  onToggle: () => void
  categoriaPorId: Map<string, Categoria>
  wos: WoPersona[]
  backlogFuturo: BacklogFuturo[]
  carga: CargaPersona
  puedeEditarAsignaciones: boolean
  escrituras: ReturnType<typeof useEscriturasAsignaciones>
  erroresFila: Record<string, string>
  onCerrarError: (asigId: string) => void
  onEditar: (asig: AsignacionItem) => void
  onEliminar: (asig: AsignacionItem) => void
  onAsignar: (personaId: string) => void
  onRepartir: (personaId: string) => void
}

/**
 * Tarjeta de una persona en la vista "Por Personas": cabecera con medidor de
 * carga y contadores (asignaciones, horas, backlog futuro y WO) + tabla de
 * requerimientos asignados (con Editar / Eliminar) + bloques plegables de
 * backlog futuro informativo y de WO de soporte.
 */
export function TarjetaPersona({
  grupo,
  expandida,
  onToggle,
  categoriaPorId,
  wos,
  backlogFuturo,
  carga,
  puedeEditarAsignaciones,
  escrituras,
  erroresFila,
  onCerrarError,
  onEditar,
  onEliminar,
  onAsignar,
  onRepartir,
}: Props) {
  const { persona } = grupo
  const nivel = nivelCarga(carga.total)
  const sobrecarga = nivel === 'sobrecarga'

  return (
    <section id={`persona-${persona.id}`} className="tarjeta scroll-mt-4 overflow-hidden">
      <div className="grid items-center gap-x-4 gap-y-2 bg-slate-50 px-3.5 py-2.5 md:grid-cols-[minmax(150px,1fr)_minmax(210px,280px)_auto]">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expandida}
          className="flex min-w-0 items-center gap-2 rounded text-left"
        >
          <Icono nombre="chevron-abajo" className={`shrink-0 text-slate-500 transition-transform ${expandida ? '' : '-rotate-90'}`} />
          <AvatarPersona nombre={persona.nombre} />
          <span className="min-w-0">
            <b className="block truncate text-sm text-marca-osc">{persona.nombre}</b>
            <span className="block text-[11px] text-slate-500">
              {persona.rol_operativo || 'Sin rol'} · capacidad {formatearPct(carga.capacidadHoras)} h
              {carga.capacidadPorDefecto && ' · por defecto'}
            </span>
          </span>
        </button>

        <div>
          <MedidorCarga
            activa={carga.activa}
            sinReq={carga.sinReq}
            otros={carga.otros}
            etiqueta={persona.nombre}
            leyenda
          />
          <div className="mt-1 flex justify-between gap-2 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Chip tono={TONO_CHIP_NIVEL[nivel]}>
                {formatearPct(carga.total)}% · {ETIQUETA_NIVEL[nivel]}
              </Chip>
            </span>
            <span className={`tabular-nums ${sobrecarga ? 'font-bold text-red-600' : ''}`}>
              {carga.horas.toFixed(1)} h de {formatearPct(carga.capacidadHoras)} h
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
          <Chip tono="neutro">
            {grupo.reqs.length} asignación{grupo.reqs.length === 1 ? '' : 'es'}
          </Chip>
          {backlogFuturo.length > 0 && <Chip tono="error">{backlogFuturo.length} backlog</Chip>}
          {wos.length > 0 && <Chip tono="exito">{wos.length} WO</Chip>}
          {puedeEditarAsignaciones && (
            <>
              {sobrecarga && carga.nActivas > 0 && (
                <Boton tamano="sm" variante="alerta" onClick={() => onRepartir(persona.id)}>
                  Repartir…
                </Boton>
              )}
              <Boton tamano="sm" variante="suave" onClick={() => onAsignar(persona.id)}>
                + Asignar
              </Boton>
            </>
          )}
        </div>
      </div>

      {expandida && (
        <div>
          <div className="hidden md:block">
            <TablaScroll plano>
              <table className="tabla">
                <thead>
                  <tr>
                    <th className="text-left">Requerimiento</th>
                    <th className="text-left">Estado</th>
                    <th className="text-left">Categoría</th>
                    <th className="text-right">%</th>
                    <th className="text-right">Horas carga</th>
                    <th className="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {grupo.reqs.map((r) => (
                    <FilaPersonaReq
                      key={r.asig.id}
                      r={r}
                      categoriaPorId={categoriaPorId}
                      puedeEditarAsignaciones={puedeEditarAsignaciones}
                      escrituras={escrituras}
                      errorFila={erroresFila[r.asig.id]}
                      onCerrarError={onCerrarError}
                      onEditar={onEditar}
                      onEliminar={onEliminar}
                    />
                  ))}
                  {grupo.reqs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-sm text-slate-400">
                        Sin asignaciones reales para mostrar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </TablaScroll>
          </div>

          <ul className="grid gap-2 p-2.5 md:hidden">
            {grupo.reqs.map((r) => (
              <FilaAsignacionMovil
                key={r.asig.id}
                asig={r.asig}
                titulo={r.reqLabel}
                detalle={
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    {categoriaPorId.get(r.asig.categoria_id)?.nombre ?? '—'}
                    {r.reqEstado && (
                      <Chip tono={tonoEstadoChip(r.reqEstado)} className="px-2 py-0.5 text-[10px]">{r.reqEstado}</Chip>
                    )}
                  </span>
                }
                horasCarga={r.horasCarga}
                puedeEditar={puedeEditarAsignaciones}
                escrituras={escrituras}
                errorFila={erroresFila[r.asig.id]}
                onCerrarError={onCerrarError}
                onEditar={onEditar}
                onEliminar={onEliminar}
              />
            ))}
            {grupo.reqs.length === 0 && (
              <li className="py-3 text-center text-sm text-slate-400">Sin asignaciones reales para mostrar.</li>
            )}
          </ul>

          <TablaBacklogPersona backlogFuturo={backlogFuturo} />
          <TablaWoPersona wos={wos} />
        </div>
      )}
    </section>
  )
}

interface PropsFila {
  r: GrupoPersona['reqs'][number]
  categoriaPorId: Map<string, Categoria>
  puedeEditarAsignaciones: boolean
  escrituras: ReturnType<typeof useEscriturasAsignaciones>
  errorFila: string | undefined
  onCerrarError: (asigId: string) => void
  onEditar: (asig: AsignacionItem) => void
  onEliminar: (asig: AsignacionItem) => void
}

/** Fila (escritorio) de un requerimiento asignado a la persona. */
function FilaPersonaReq({
  r,
  categoriaPorId,
  puedeEditarAsignaciones,
  escrituras,
  errorFila,
  onCerrarError,
  onEditar,
  onEliminar,
}: PropsFila) {
  return (
    <>
      <tr>
        <td className="font-medium">{r.reqLabel}</td>
        <td>
          {r.reqEstado && (
            <Chip tono={tonoEstadoChip(r.reqEstado)} className="px-2 py-0.5 text-[10px]">
              {r.reqEstado}
            </Chip>
          )}
        </td>
        <td>{categoriaPorId.get(r.asig.categoria_id)?.nombre ?? '—'}</td>
        <td className="text-right font-medium">
          <PorcentajeEditable asig={r.asig} puedeEditar={puedeEditarAsignaciones} escrituras={escrituras} />
        </td>
        <td className="text-right font-mono">{r.horasCarga.toFixed(1)}</td>
        <td className="whitespace-nowrap text-center">
          {puedeEditarAsignaciones && (
            <div className="flex items-center justify-center gap-3">
              <button type="button" onClick={() => onEditar(r.asig)} className="enlace-accion">Editar</button>
              <button type="button" onClick={() => onEliminar(r.asig)} className="enlace-accion enlace-accion-peligro">
                Eliminar
              </button>
            </div>
          )}
        </td>
      </tr>
      {errorFila && (
        <tr className="bg-red-50">
          <td colSpan={6} className="!py-2 text-sm text-red-700">
            <span role="alert" className="flex flex-wrap items-center justify-between gap-2">
              <span>{errorFila}</span>
              <button type="button" className="enlace-accion enlace-accion-sutil" onClick={() => onCerrarError(r.asig.id)}>
                Cerrar
              </button>
            </span>
          </td>
        </tr>
      )}
    </>
  )
}
