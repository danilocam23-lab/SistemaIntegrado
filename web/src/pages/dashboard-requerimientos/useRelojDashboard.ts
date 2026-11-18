// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useEffect, useMemo, useState } from 'react'
import type { SetStateAction } from 'react'
import { filtroInicial, hoyColombia } from './filtrosFechas'

const relojActual = () => new Date()

/** Reevalúa filas ya cargadas al cambiar el día; no dispara peticiones de red. */
export function useCorteColombia(ahora: () => Date = relojActual): string {
  const [corte, setCorte] = useState(() => hoyColombia(ahora()))
  useEffect(() => {
    const actualizar = () => setCorte(hoyColombia(ahora()))
    const alMostrar = () => {
      if (document.visibilityState === 'visible') actualizar()
    }
    const intervalo = window.setInterval(actualizar, 30_000)
    window.addEventListener('focus', actualizar)
    document.addEventListener('visibilitychange', alMostrar)
    actualizar()
    return () => {
      window.clearInterval(intervalo)
      window.removeEventListener('focus', actualizar)
      document.removeEventListener('visibilitychange', alMostrar)
    }
  }, [ahora])
  return corte
}

/** El año automático sigue al reloj solo hasta la primera selección manual o un restablecimiento. */
export function useFiltroTemporal(hasta: string) {
  const [seleccion, setSeleccion] = useState<{ anos: Set<string>; meses: Set<string> } | null>(null)
  const filtro = useMemo(() => seleccion ? { ...seleccion, hasta } : filtroInicial(hasta), [seleccion, hasta])
  const cambiar = (campo: 'anos' | 'meses', accion: SetStateAction<Set<string>>) => {
    setSeleccion((anterior) => {
      const base = anterior ?? filtroInicial(hasta)
      return { anos: new Set(base.anos), meses: new Set(base.meses),
        [campo]: typeof accion === 'function' ? accion(new Set(base[campo])) : new Set(accion) }
    })
  }
  return {
    ...filtro,
    setAnos: (accion: SetStateAction<Set<string>>) => cambiar('anos', accion),
    setMeses: (accion: SetStateAction<Set<string>>) => cambiar('meses', accion),
    restablecer: () => setSeleccion(null),
  }
}
