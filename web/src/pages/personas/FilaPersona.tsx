// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Boton, Chip, Interruptor, cx } from '../../components/ui'
import type { Persona, SquadDetalle } from '../../types'
import { AvatarRol, ChipRol } from './ChipRol'
import { InsigniasPersona } from './InsigniasPersona'
import { fechaCorta } from './formatoFecha'
import { ROL_SIN_CONTRATACION } from './roles'
import { cierreEnSquad, detalleSquads, estadoEnSquadContexto } from './squadsPersona'

/** Anchos de columna compartidos entre el encabezado y las filas (solo escritorio). */
export const COL_ROL = 'md:w-[150px]'
export const COL_SQUADS = 'md:w-[170px]'
export const COL_CONTRATACION = 'md:w-[210px]'
export const COL_ACTIVA = 'md:w-[70px]'
export const COL_ACCIONES = 'md:w-[130px]'

function dinero(valor: number | undefined): string {
  return `$${(valor ?? 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`
}

interface Props {
  persona: Persona
  verValores: boolean
  puedeEditar: boolean
  puedeEliminar: boolean
  ocupada: boolean
  /** Squad elegido en el filtro (destaca el estado de la persona en ese squad). */
  squadFiltrado?: string
  /** Squad en el que se mide el estado (filtro o aplicación activa); sin él, estado general. */
  squadContexto?: string
  onAbrir: (persona: Persona) => void
  onEliminar: (persona: Persona) => void
  onAlternarActivo: (persona: Persona) => void
}

/** `CRM` o, si está cerrado, `CRM · hasta 13-oct`. */
function etiquetaSquad(d: SquadDetalle): string {
  return d.activo || !d.hasta ? d.squad : `${d.squad} · hasta ${fechaCorta(d.hasta)}`
}

/** Chip de squad: activo en tono normal, cerrado atenuado con su último día activo. */
function ChipSquad({ d, destacado }: { d: SquadDetalle; destacado: boolean }) {
  const cerrado = !d.activo
  return (
    <Chip
      tono={destacado ? (cerrado ? 'alerta' : 'exito') : 'neutro'}
      className={cx('max-w-full truncate', cerrado && 'opacity-60')}
      title={cerrado ? `Inactiva en ${d.squad}${d.hasta ? ` · último día activo ${fechaCorta(d.hasta, true)}` : ''}` : undefined}
    >
      {etiquetaSquad(d)}
    </Chip>
  )
}

/** Fila del directorio: tarjeta en móvil, fila densa en escritorio. */
export function FilaPersona({
  persona: p,
  verValores,
  puedeEditar,
  puedeEliminar,
  ocupada,
  squadFiltrado,
  squadContexto,
  onAbrir,
  onEliminar,
  onAlternarActivo,
}: Props) {
  const detalle = detalleSquads(p)
  const activoEnSquadFiltrado = squadFiltrado ? detalle.some((d) => d.squad === squadFiltrado && d.activo) : null
  // Estado efectivo en el squad de contexto: puede ser inactiva allí aunque esté activa en general.
  const activa = estadoEnSquadContexto(p, squadContexto)
  const cierreContexto = p.activo && !activa && squadContexto ? cierreEnSquad(p, squadContexto) : undefined
  const sinContratacion = p.rol_operativo === ROL_SIN_CONTRATACION
  const mostrarValores = verValores && !sinContratacion && p.valor_persona !== undefined
  return (
    <li
      className={cx(
        'flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-100 px-3 py-2.5 last:border-b-0',
        !activa && 'bg-slate-50/70',
      )}
    >
      <button
        type="button"
        onClick={() => onAbrir(p)}
        aria-label={`Ver detalle de ${p.nombre}`}
        className={cx(
          'flex min-w-[220px] flex-1 items-center gap-3 rounded text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-marca-500',
          !activa && 'opacity-80',
        )}
      >
        <AvatarRol nombre={p.nombre} rol={p.rol_operativo} inactiva={!activa} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-semibold text-slate-800">{p.nombre}</span>
            <InsigniasPersona persona={p} />
            {cierreContexto && (
              <Chip tono="alerta" aria-label={`Inactivo en ${cierreContexto.squad}`}>
                Inactivo en {cierreContexto.squad}
                {cierreContexto.hasta ? ` · hasta ${fechaCorta(cierreContexto.hasta)}` : ''}
              </Chip>
            )}
          </span>
          <span className="block truncate text-xs text-slate-500">
            {p.email ? (
              p.email
            ) : (
              <span className="font-medium text-amber-700">— sin correo —</span>
            )}
            {!p.activo &&
              (p.fecha_efecto_desactivacion ?? p.fecha_desactivacion) &&
              ` · activa hasta ${fechaCorta(p.fecha_efecto_desactivacion ?? p.fecha_desactivacion, true)}`}
          </span>
        </span>
      </button>

      <div className={cx('min-w-0', COL_ROL)}>
        <ChipRol rol={p.rol_operativo} />
      </div>

      <div className={cx('flex min-w-0 flex-wrap gap-1', COL_SQUADS)}>
        {detalle.length === 0 && <span className="text-xs text-slate-400">—</span>}
        {detalle.slice(0, 2).map((d, i) => (
          <ChipSquad key={`${d.squad_id}-${i}`} d={d} destacado={d.squad === squadFiltrado} />
        ))}
        {detalle.length > 2 && (
          <Chip
            tono="neutro"
            title={detalle.slice(2).map((d) => etiquetaSquad(d)).join(', ')}
          >
            +{detalle.length - 2}
          </Chip>
        )}
        {activoEnSquadFiltrado !== null && (
          <span className="sr-only">
            {activoEnSquadFiltrado ? `Activa en ${squadFiltrado}` : `Inactiva en ${squadFiltrado}`}
          </span>
        )}
      </div>

      <div className={cx('hidden min-w-0 text-xs md:block', COL_CONTRATACION)}>
        {sinContratacion ? (
          <span className="text-slate-400">No aplica ({ROL_SIN_CONTRATACION})</span>
        ) : (
          <>
            <span className="block truncate text-slate-700">{p.tipo_contratacion ?? '—'}</span>
            {mostrarValores && (
              <span className="block truncate font-mono text-slate-500">
                {dinero(p.valor_persona)} · per. {dinero(p.valor_perifericos)}
              </span>
            )}
          </>
        )}
      </div>

      <div className={cx('flex items-center gap-2', COL_ACTIVA)}>
        {puedeEditar ? (
          <Interruptor
            activo={p.activo}
            etiquetaActivo={`Desactivar a ${p.nombre}`}
            etiquetaInactivo={`Activar a ${p.nombre}`}
            disabled={ocupada}
            onClick={() => onAlternarActivo(p)}
          />
        ) : (
          <Chip tono={activa ? 'exito' : 'error'}>{activa ? 'Sí' : 'No'}</Chip>
        )}
        <span className="text-xs text-slate-500 md:hidden">{activa ? 'Activa' : 'Inactiva'}</span>
      </div>

      <div className={cx('flex gap-1', COL_ACCIONES)}>
        <Boton tamano="sm" variante="fantasma" onClick={() => onAbrir(p)}>
          {puedeEditar ? 'Editar' : 'Ver'}
        </Boton>
        {puedeEliminar && (
          <Boton tamano="sm" variante="peligro-suave" onClick={() => onEliminar(p)} aria-label={`Eliminar a ${p.nombre}`}>
            Eliminar
          </Boton>
        )}
      </div>
    </li>
  )
}
