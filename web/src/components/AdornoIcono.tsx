// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import type { TemaEstacional } from '../hooks/useTemaEstacional'

type TemaConEmojis = Exclude<TemaEstacional, 'ninguno'>

/** Seis emojis por tema (escapes unicode). El orden es fijo: el índice los elige módulo 6. */
const EMOJIS: Record<TemaConEmojis, readonly string[]> = {
  // 🎅 ❄️ 🎄 🔔 🎁 ⭐
  navidad: ['\u{1F385}', '❄️', '\u{1F384}', '\u{1F514}', '\u{1F381}', '⭐'],
  // 🎃 🦇 🕸️ 👻 🕷️ 🧙
  halloween: ['\u{1F383}', '\u{1F987}', '\u{1F578}️', '\u{1F47B}', '\u{1F577}️', '\u{1F9D9}'],
  // ❤️ 🌸 🎀 ✨ 💖 💌
  amor_amistad: ['❤️', '\u{1F338}', '\u{1F380}', '✨', '\u{1F496}', '\u{1F48C}'],
}

/**
 * Emoji pequeño en la esquina superior derecha de un icono del menú.
 * El contenedor del icono debe ser `relative`. No ocupa espacio ni recibe foco/clics.
 */
export default function AdornoIcono({ tema, indice }: { tema: TemaEstacional; indice: number }) {
  if (tema === 'ninguno') return null
  const lista = EMOJIS[tema]
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute -right-2 -top-[9px] z-10 select-none text-[11px] leading-none drop-shadow-sm"
      style={{ fontFamily: '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif' }}
    >
      {lista[((indice % lista.length) + lista.length) % lista.length]}
    </span>
  )
}
