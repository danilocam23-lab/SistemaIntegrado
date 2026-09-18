// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useCallback, useEffect, useState } from 'react'
import client, { APP_KEY } from './client'
import { ESTADOS_ENTREGA, ESTADOS_REQUERIMIENTO } from '../constantes'

/**
 * Dedup/caché ligero para GETs de lista, compartido por `useLista` y `useEstados`.
 *
 * Motivo: varios componentes de una misma pantalla llaman `useLista('/mismoEndpoint')` de
 * forma independiente (p. ej. filtros, tablas y hooks de datos que leen `/aplicaciones` o
 * `/configuracion` cada uno por su cuenta), lo que sin esto dispara N peticiones HTTP
 * idénticas en paralelo. No se usa React Query a propósito (ver CLAUDE.md); esto resuelve
 * el mismo problema con dos estructuras a nivel de módulo:
 *
 * - `peticionesEnCurso`: si ya hay un GET en vuelo para el mismo endpoint+aplicación, las
 *   llamadas concurrentes reutilizan esa misma promesa en vez de lanzar otra petición.
 * - `cacheCorta`: una ventana breve (`VENTANA_CACHE_MS`) para servir sin red una carga
 *   inicial que ya se resolvió hace instantes (otro componente pidió lo mismo un momento
 *   antes). Los refrescos explícitos (`recargar()`, típicamente tras crear/editar/borrar)
 *   nunca leen de aquí: siempre piden datos frescos, aunque sí comparten `peticionesEnCurso`
 *   si otra carga para el mismo recurso ya está en vuelo en ese instante.
 *
 * Aislamiento multi-aplicación (crítico, ver ADR-0008 de backend): la clave de ambas
 * estructuras siempre incluye la aplicación activa vigente en el momento del pedido, leída
 * de la misma fuente que usa el interceptor de `client.ts` (`localStorage[APP_KEY]`). Nunca
 * se sirve ni se comparte una respuesta entre aplicaciones distintas.
 */
const VENTANA_CACHE_MS = 500

interface EntradaCache<T> {
  datos: T
  marca: number
}

const peticionesEnCurso = new Map<string, Promise<unknown>>()
const cacheCorta = new Map<string, EntradaCache<unknown>>()

function claveDeduplicacion(endpoint: string): string {
  const aplicacion = localStorage.getItem(APP_KEY) ?? ''
  return `${aplicacion}::${endpoint}`
}

function obtenerDeduplicado<T>(endpoint: string, usarCache: boolean): Promise<T> {
  const clave = claveDeduplicacion(endpoint)

  if (usarCache) {
    const cacheado = cacheCorta.get(clave) as EntradaCache<T> | undefined
    if (cacheado && Date.now() - cacheado.marca < VENTANA_CACHE_MS) {
      return Promise.resolve(cacheado.datos)
    }
  }

  const enCurso = peticionesEnCurso.get(clave) as Promise<T> | undefined
  if (enCurso) return enCurso

  const promesa = client
    .get<T>(endpoint)
    .then((r) => {
      cacheCorta.set(clave, { datos: r.data, marca: Date.now() })
      return r.data
    })
    .finally(() => {
      peticionesEnCurso.delete(clave)
    })

  peticionesEnCurso.set(clave, promesa)
  return promesa
}

/** Carga una lista desde la API y la mantiene refrescable. */
export function useLista<T>(endpoint: string) {
  const [datos, setDatos] = useState<T[]>([])
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(
    (usarCache: boolean) => {
      setCargando(true)
      obtenerDeduplicado<T[]>(endpoint, usarCache)
        .then((data) => {
          setDatos(data)
          setError('')
        })
        .catch(() => setError('No fue posible cargar los datos'))
        .finally(() => setCargando(false))
    },
    [endpoint],
  )

  // Refresco explícito: siempre pide datos frescos (nunca lee `cacheCorta`), aunque
  // comparte la petición en curso si otro componente ya la disparó en este instante.
  const recargar = useCallback(() => cargar(false), [cargar])

  useEffect(() => {
    // Carga inicial: puede servirse desde `cacheCorta` si otro componente de la misma
    // pantalla ya pidió este endpoint hace instantes.
    cargar(true)
  }, [cargar])

  return { datos, error, cargando, recargar }
}

/** Extrae el mensaje `detail` de un error de Axios. */
export function mensajeError(err: unknown): string {
  const data = (err as { response?: { data?: { detail?: unknown } } })?.response?.data
  const detalle = data?.detail
  
  // Log para debugging
  if (typeof window !== 'undefined' && window.console) {
    console.error('Error completo:', err)
    console.error('Datos de error:', data)
    console.error('Detalle:', detalle)
  }
  
  if (typeof detalle === 'string') return detalle
  // Pydantic validation errors return detail as an array of objects
  if (Array.isArray(detalle) && detalle.length > 0) {
    const primero = detalle[0] as { msg?: string; loc?: string[] }
    const campo = primero.loc ? primero.loc.filter((l) => l !== 'body').join('.') : ''
    return campo ? `${campo}: ${primero.msg ?? 'Error de validación'}` : (primero.msg ?? 'Error de validación')
  }
  return 'Ocurrió un error (revisa la consola del navegador para más detalles)'
}

/** Carga los estados de requerimiento y entrega desde la configuración. */
export function useEstados() {
  const [estadosReq, setEstadosReq] = useState<string[]>(ESTADOS_REQUERIMIENTO)
  const [estadosEnt, setEstadosEnt] = useState<string[]>(ESTADOS_ENTREGA)

  const cargar = useCallback((usarCache: boolean) => {
    // Comparte clave de dedup/caché con `useLista('/configuracion')`: varias pantallas
    // llaman ambos hooks a la vez y sin esto salían dos GET /configuracion idénticos.
    obtenerDeduplicado<{ clave: string; valor: string }[]>('/configuracion', usarCache)
      .then((data) => {
        const req = data.find((c) => c.clave === 'estados_requerimiento')
        const ent = data.find((c) => c.clave === 'estados_entrega')
        if (req?.valor) setEstadosReq(req.valor.split(',').map((s) => s.trim()).filter(Boolean))
        if (ent?.valor) setEstadosEnt(ent.valor.split(',').map((s) => s.trim()).filter(Boolean))
      })
      .catch(() => {})
  }, [])

  const recargar = useCallback(() => cargar(false), [cargar])

  useEffect(() => {
    cargar(true)
  }, [cargar])

  return { estadosReq, estadosEnt, recargar }
}
