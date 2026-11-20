// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import type { TemaEstacional } from '../hooks/useTemaEstacional'

/** Adorno SVG sobre el logo del Sidebar. No ocupa espacio (absoluto), no recibe foco ni clics. */
export default function DecoracionEstacional({ tema }: { tema: TemaEstacional }) {
  if (tema === 'ninguno') return null

  const base = 'pointer-events-none absolute -left-1.5 -top-3 z-10 h-6 w-6 drop-shadow'
  const comunes = { viewBox: '0 0 32 32', 'aria-hidden': true, focusable: 'false' } as const

  if (tema === 'navidad') {
    return (
      <svg {...comunes} className={`${base} -rotate-[18deg]`}>
        <path d="M5 24C6 12 13 4 24 6c-5 2-7 7-7 18H5Z" fill="#dc2626" />
        <path d="M24 6c3 1 4 4 3 7-1-3-3-5-6-5l3-2Z" fill="#b91c1c" />
        <rect x="3" y="21" width="22" height="6" rx="3" fill="#ffffff" />
        <circle cx="26" cy="8" r="3.2" fill="#ffffff" />
      </svg>
    )
  }

  if (tema === 'halloween') {
    // Sombrero de bruja: ala negra, cono morado, cinta naranja.
    return (
      <svg {...comunes} className={`${base} -rotate-[14deg]`}>
        <path d="M13 3c3 0 5 6 6 18H8c1-8 2-14 5-18Z" fill="#6d28d9" />
        <path d="M15 3c2 1 3 3 5 7-2-2-3-3-5-3V3Z" fill="#4c1d95" />
        <rect x="8.6" y="15" width="10.8" height="3.4" fill="#f97316" />
        <ellipse cx="14" cy="22" rx="12" ry="3.6" fill="#1e1b2e" />
      </svg>
    )
  }

  // amor_amistad: dos corazones, uno rojo y uno rosa.
  return (
    <svg {...comunes} className={`${base} -rotate-[10deg]`}>
      <path
        d="M11 28C3 22 2 15 5.5 11.5 8 9 10.5 10 11 12.5c.5-2.5 3-3.500 5.500-1C20 15 19 22 11 28Z"
        fill="#e11d48"
      />
      <path
        d="M23 17c-4-3-5-6.500-3.200-8.300 1.300-1.300 2.700-.8 3.200.6.500-1.400 1.900-1.900 3.200-.6C28 10.500 27 14 23 17Z"
        fill="#f9a8d4"
      />
    </svg>
  )
}
