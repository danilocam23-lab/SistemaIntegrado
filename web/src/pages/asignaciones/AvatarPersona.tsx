// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { cx } from '../../components/ui'
import { iniciales } from './carga'

/** Círculo con las iniciales de la persona (decorativo: el nombre va siempre en texto). */
export function AvatarPersona({ nombre, pequeno }: { nombre: string; pequeno?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'inline-grid shrink-0 place-items-center rounded-full bg-marca-600 font-extrabold text-white',
        pequeno ? 'h-[22px] w-[22px] text-[9px]' : 'h-[26px] w-[26px] text-[10px]',
      )}
    >
      {iniciales(nombre)}
    </span>
  )
}
