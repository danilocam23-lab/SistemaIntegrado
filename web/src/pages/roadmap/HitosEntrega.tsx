// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { cx } from '../../components/ui'
import { fechaEnRango, posicionPct } from './derivados'
import { fechaCorta } from './fechas'
import type { HitoEntrega, RangoRoadmap, TonoHito } from './tipos'

/** Clases literales (el JIT de Tailwind no ve nombres compuestos). */
export const CLASE_HITO: Record<TonoHito, string> = {
  ok: 'border-emerald-600 bg-emerald-50',
  pend: 'border-amber-500 bg-white',
  bad: 'border-red-600 bg-red-50',
}

export const ETIQUETA_HITO: Record<TonoHito, string> = {
  ok: 'aprobada',
  pend: 'pendiente',
  bad: 'vencida',
}

const MAX_HITOS_SUELTOS = 6
const DISTANCIA_AGRUPAR_PCT = 1.5
const PRIORIDAD: Record<TonoHito, number> = { ok: 0, pend: 1, bad: 2 }

interface HitoDibujado {
  pct: number
  tono: TonoHito
  hitos: HitoEntrega[]
}

/** Con más de 6 entregas visibles, las que quedan muy juntas se funden en un hito con contador. */
function dibujarHitos(hitos: HitoEntrega[], rango: RangoRoadmap): HitoDibujado[] {
  const visibles = hitos.filter((h) => fechaEnRango(h.fecha, rango))
  const sueltos: HitoDibujado[] = visibles.map((h) => ({ pct: posicionPct(h.fecha, rango), tono: h.tono, hitos: [h] }))
  if (visibles.length <= MAX_HITOS_SUELTOS) return sueltos
  const resultado: HitoDibujado[] = []
  for (const actual of sueltos) {
    const previo = resultado[resultado.length - 1]
    if (previo && actual.pct - previo.pct < DISTANCIA_AGRUPAR_PCT) {
      previo.hitos.push(...actual.hitos)
      if (PRIORIDAD[actual.tono] > PRIORIDAD[previo.tono]) previo.tono = actual.tono
    } else {
      resultado.push(actual)
    }
  }
  return resultado
}

function tituloHito(h: HitoDibujado): string {
  return h.hitos.map((x) => `Entrega ${x.numero} · ${fechaCorta(x.fecha)} · ${ETIQUETA_HITO[x.tono]}`).join('\n')
}

/** Hitos ◆ de las entregas de un requerimiento sobre su barra (decorativos: el detalle va en el panel). */
export function HitosEntrega({ hitos, rango }: { hitos: HitoEntrega[]; rango: RangoRoadmap }) {
  return (
    <>
      {dibujarHitos(hitos, rango).map((h) => (
        <span
          key={`${h.hitos[0].numero}-${h.hitos[0].fecha.getTime()}`}
          aria-hidden="true"
          title={tituloHito(h)}
          className="pointer-events-auto absolute top-[13px] z-[3] -ml-[5px]"
          style={{ left: `${h.pct}%` }}
        >
          <i className={cx('block h-2.5 w-2.5 rotate-45 rounded-sm border-2', CLASE_HITO[h.tono])} />
          {h.hitos.length > 1 && (
            <b className="absolute -right-3 -top-2 rounded-full bg-slate-700 px-1 text-[9px] leading-3 text-white">
              {h.hitos.length}
            </b>
          )}
        </span>
      ))}
    </>
  )
}
