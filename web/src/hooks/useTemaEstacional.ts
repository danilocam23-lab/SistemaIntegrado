// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useEffect, useSyncExternalStore } from 'react'
import client from '../api/client'

/** Clave del parámetro global en Configuración (grupo `apariencia`). */
export const CLAVE_TEMA_ESTACIONAL = 'tema_estacional'

export type TemaEstacional = 'ninguno' | 'navidad' | 'halloween' | 'amor_amistad'
export type ValorTemaEstacional = 'auto' | TemaEstacional

/** Valores permitidos del parámetro con su etiqueta legible (para el <select> de Parámetros). */
export const OPCIONES_TEMA_ESTACIONAL: { valor: ValorTemaEstacional; etiqueta: string }[] = [
  { valor: 'auto', etiqueta: 'Automático por fecha' },
  { valor: 'ninguno', etiqueta: 'Ninguno' },
  { valor: 'navidad', etiqueta: 'Navidad' },
  { valor: 'halloween', etiqueta: 'Halloween (octubre)' },
  { valor: 'amor_amistad', etiqueta: 'Amor y amistad' },
]

const VALORES_FIJOS: TemaEstacional[] = ['ninguno', 'navidad', 'halloween', 'amor_amistad']

/** Resuelve el tema según la fecha local: sep → amor y amistad; oct → halloween; 15 nov–6 ene → navidad. */
export function temaPorFecha(fecha: Date): TemaEstacional {
  const mes = fecha.getMonth() + 1
  const dia = fecha.getDate()
  if (mes === 9) return 'amor_amistad'
  if (mes === 10) return 'halloween'
  if ((mes === 11 && dia >= 15) || mes === 12 || (mes === 1 && dia <= 6)) return 'navidad'
  return 'ninguno'
}

/** Función pura: valor del parámetro (o undefined/desconocido => `auto`) + fecha => tema a mostrar. */
export function resolverTema(valor: string | null | undefined, fecha: Date): TemaEstacional {
  const v = (valor ?? '').trim().toLowerCase()
  if ((VALORES_FIJOS as string[]).includes(v)) return v as TemaEstacional
  return temaPorFecha(fecha)
}

// --- Almacén a nivel de módulo: una sola lectura de /configuracion por sesión de la SPA ---
// El Sidebar se desmonta/monta poco, pero así ni navegar ni re-renderizar vuelve a pedirla, y
// Parámetros puede publicar el cambio tras guardar sin recargar la página.
// Mientras el valor real no se conoce (`null`) no se decora: evita el parpadeo de un tema no
// activado en cada recarga. La última lectura se cachea en localStorage para que un tema SÍ
// activo aparezca desde el primer render; el valor del servidor siempre manda.
const CLAVE_CACHE = 'tema_estacional_cache'

function leerCache(): string | null {
  try {
    const v = globalThis.localStorage?.getItem(CLAVE_CACHE)
    return typeof v === 'string' && v.trim() ? v : null
  } catch {
    return null
  }
}

function guardarCache(valor: string) {
  try {
    globalThis.localStorage?.setItem(CLAVE_CACHE, valor)
  } catch {
    /* sin localStorage: la página funciona igual */
  }
}

let valorActual: string | null = leerCache()
let leido = false
let leyendo = false
const oyentes = new Set<() => void>()

/** Tema a mostrar: sin valor conocido (aún sin leer ni caché) => `ninguno`. */
export function temaVigente(valor: string | null, fecha: Date): TemaEstacional {
  return valor === null ? 'ninguno' : resolverTema(valor, fecha)
}

function emitir() {
  oyentes.forEach((o) => o())
}

function leerConfiguracion() {
  if (leido || leyendo) return
  leyendo = true
  client
    .get<{ clave: string; valor: string }[]>('/configuracion')
    .then((r) => {
      valorActual = r.data.find((c) => c.clave === CLAVE_TEMA_ESTACIONAL)?.valor ?? 'auto'
      guardarCache(valorActual)
      leido = true
    })
    .catch((err: unknown) => {
      // Sin respuesta del servidor (fallo de red): ninguno. Otro error HTTP: se trata como `auto`.
      const hayRespuesta = Boolean((err as { response?: unknown })?.response)
      valorActual = hayRespuesta ? 'auto' : 'ninguno'
      leido = hayRespuesta
    })
    .finally(() => {
      leyendo = false
      emitir()
    })
}

/** Publica el valor guardado en Parámetros para que el Sidebar se actualice sin recargar. */
export function publicarTemaEstacional(valor: string) {
  valorActual = valor
  guardarCache(valor)
  leido = true
  emitir()
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente)
  return () => {
    oyentes.delete(oyente)
  }
}

/** Tema estacional vigente (parámetro global + fecha local del navegador). */
export function useTemaEstacional(): TemaEstacional {
  const valor = useSyncExternalStore(suscribir, () => valorActual)
  useEffect(() => {
    leerConfiguracion()
  }, [])
  return temaVigente(valor, new Date())
}
