// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import type { CSSProperties } from 'react'
import { Chip, cx } from '../../components/ui'
import { iniciales } from '../asignaciones/carga'
import { bordePunteado, colorRol, etiquetaRol } from './roles'

/** Chip categórico del rol: color de identidad + nombre siempre escrito. */
export function ChipRol({ rol }: { rol: string | null | undefined }) {
  const color = colorRol(rol)
  const estilo: CSSProperties = {
    color,
    backgroundColor: `color-mix(in srgb, ${color} 12%, white)`,
    borderColor: `color-mix(in srgb, ${color} 34%, white)`,
    borderStyle: bordePunteado(rol) ? 'dashed' : 'solid',
    borderWidth: 1,
  }
  return (
    <span style={estilo} className="inline-flex max-w-full rounded-full">
      <Chip tono="categoria" className="max-w-full gap-1.5">
        <i aria-hidden="true" className="h-[7px] w-[7px] shrink-0 rounded-sm" style={{ backgroundColor: color }} />
        <span className="truncate">{etiquetaRol(rol)}</span>
      </Chip>
    </span>
  )
}

/** Avatar con iniciales en el color del rol (decorativo: el nombre va siempre en texto). */
export function AvatarRol({
  nombre,
  rol,
  inactiva,
  grande,
}: {
  nombre: string
  rol: string | null | undefined
  inactiva?: boolean
  grande?: boolean
}) {
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: colorRol(rol) }}
      className={cx(
        'inline-grid shrink-0 place-items-center font-extrabold text-white',
        grande ? 'h-[42px] w-[42px] rounded-xl text-sm' : 'h-[30px] w-[30px] rounded-[9px] text-[10.5px]',
        inactiva && 'opacity-60 grayscale',
      )}
    >
      {nombre ? iniciales(nombre) : '+'}
    </span>
  )
}
