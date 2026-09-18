// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useCallback, useEffect, useState } from 'react'
import client from '../../api/client'
import type { PersonaConfigAzure, RespuestaPersonasConfigAzure } from '../../types'

/** Clave de localStorage compartida por el Esquema de Azure y el tab de
 * configuración para recordar qué PAT (persona) está usando el usuario. */
export const CLAVE_USUARIO_ESQUEMA = 'azdo-esquema-usuario-id'

export interface ConfigPersonaAzure {
  usuarioId: string
  configPersonas: RespuestaPersonasConfigAzure | null
  puedeElegir: boolean
  personasConConfig: PersonaConfigAzure[]
  personaSeleccionada: PersonaConfigAzure | null
  cambiarUsuario: (valor: string) => void
}

/** Resuelve el selector de persona (PAT) de Azure DevOps: carga las personas
 * configurables, persiste la elección en localStorage y descarta selecciones
 * que ya no tengan configuración. Reutilizado por el Esquema y por el tab. */
export function useConfigPersonaAzure(
  target: string,
  claveStorage: string = CLAVE_USUARIO_ESQUEMA,
): ConfigPersonaAzure {
  const [configPersonas, setConfigPersonas] = useState<RespuestaPersonasConfigAzure | null>(null)
  const [usuarioId, setUsuarioId] = useState<string>(
    () => window.localStorage.getItem(claveStorage) ?? '',
  )

  useEffect(() => {
    let cancelado = false
    client
      .get<RespuestaPersonasConfigAzure>(`/azdo/personas-config?target=${target}`)
      .then(({ data }) => {
        if (cancelado) return
        setConfigPersonas(data)
        const guardado = window.localStorage.getItem(claveStorage)
        if (guardado && !data.personas.some((p) => p.tiene_config && p.id === guardado)) {
          window.localStorage.removeItem(claveStorage)
          setUsuarioId('')
        }
      })
      .catch(() => {
        if (!cancelado) setConfigPersonas(null)
      })
    return () => {
      cancelado = true
    }
  }, [target, claveStorage])

  const cambiarUsuario = useCallback(
    (valor: string) => {
      setUsuarioId(valor)
      if (valor) window.localStorage.setItem(claveStorage, valor)
      else window.localStorage.removeItem(claveStorage)
    },
    [claveStorage],
  )

  const puedeElegir = configPersonas?.puede_elegir_cualquiera ?? false
  const personasConConfig = configPersonas?.personas.filter((p) => p.tiene_config) ?? []
  const personaSeleccionada = personasConConfig.find((p) => p.id === usuarioId) ?? null

  return { usuarioId, configPersonas, puedeElegir, personasConConfig, personaSeleccionada, cambiarUsuario }
}
