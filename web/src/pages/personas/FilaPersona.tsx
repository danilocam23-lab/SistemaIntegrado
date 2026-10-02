// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Boton, Chip, Interruptor, cx } from '../../components/ui'
import type { Persona } from '../../types'
import { AvatarRol, ChipRol } from './ChipRol'
import { InsigniasPersona } from './InsigniasPersona'
import { ROL_SIN_CONTRATACION } from './roles'

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
  onAbrir: (persona: Persona) => void
  onEliminar: (persona: Persona) => void
  onAlternarActivo: (persona: Persona) => void
}

/** Fila del directorio: tarjeta en móvil, fila densa en escritorio. */
export function FilaPersona({
  persona: p,
  verValores,
  puedeEditar,
  puedeEliminar,
  ocupada,
  onAbrir,
  onEliminar,
  onAlternarActivo,
}: Props) {
  const squads = p.squads ?? []
  const sinContratacion = p.rol_operativo === ROL_SIN_CONTRATACION
  const mostrarValores = verValores && !sinContratacion && p.valor_persona !== undefined
  return (
    <li
      className={cx(
        'flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-100 px-3 py-2.5 last:border-b-0',
        !p.activo && 'bg-slate-50/70',
      )}
    >
      <button
        type="button"
        onClick={() => onAbrir(p)}
        aria-label={`Ver detalle de ${p.nombre}`}
        className={cx(
          'flex min-w-[220px] flex-1 items-center gap-3 rounded text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-marca-500',
          !p.activo && 'opacity-80',
        )}
      >
        <AvatarRol nombre={p.nombre} rol={p.rol_operativo} inactiva={!p.activo} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-semibold text-slate-800">{p.nombre}</span>
            <InsigniasPersona persona={p} />
          </span>
          <span className="block truncate text-xs text-slate-500">
            {p.email ? (
              p.email
            ) : (
              <span className="font-medium text-amber-700">— sin correo —</span>
            )}
            {!p.activo && p.fecha_desactivacion && ` · desactivada el ${p.fecha_desactivacion.slice(0, 10)}`}
          </span>
        </span>
      </button>

      <div className={cx('min-w-0', COL_ROL)}>
        <ChipRol rol={p.rol_operativo} />
      </div>

      <div className={cx('flex min-w-0 flex-wrap gap-1', COL_SQUADS)}>
        {squads.length === 0 && <span className="text-xs text-slate-400">—</span>}
        {squads.slice(0, 2).map((s) => (
          <Chip key={s} tono="neutro" className="max-w-full truncate">{s}</Chip>
        ))}
        {squads.length > 2 && (
          <Chip tono="neutro" title={squads.slice(2).join(', ')}>+{squads.length - 2}</Chip>
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
          <Chip tono={p.activo ? 'exito' : 'error'}>{p.activo ? 'Sí' : 'No'}</Chip>
        )}
        <span className="text-xs text-slate-500 md:hidden">{p.activo ? 'Activa' : 'Inactiva'}</span>
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
