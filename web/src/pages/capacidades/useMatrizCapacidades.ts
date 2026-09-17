import { useEffect, useMemo, useRef, useState } from 'react'
import type { Capacidad, Persona } from '../../types'

export const MESES_ABREV = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
]

export interface FilaMatrizCapacidad {
  personaId: string
  nombre: string
  /** Índice 0 = enero … 11 = diciembre, del año seleccionado. `null` = sin registro. */
  celdas: Array<Capacidad | null>
}

/**
 * Agrupa `capacidadesPersona` (ya filtrado por rol) en una matriz persona × mes
 * para el año seleccionado. No llama a la API: opera solo sobre los datos que
 * ya cargó `useLista('/capacidades')` en la página.
 */
export function useMatrizCapacidades(
  capacidadesPersona: Capacidad[],
  personasPorId: Map<string, Persona>,
) {
  const anioActual = String(new Date().getFullYear())

  const anios = useMemo(() => {
    const set = new Set<string>()
    for (const capacidad of capacidadesPersona) {
      const anio = capacidad.mes?.slice(0, 4)
      if (anio) set.add(anio)
    }
    return Array.from(set).sort()
  }, [capacidadesPersona])

  const [anioSeleccionado, setAnioSeleccionadoState] = useState(anioActual)
  const eligioAnioManualmente = useRef(false)

  useEffect(() => {
    if (eligioAnioManualmente.current) return
    const masReciente = anios[anios.length - 1]
    if (masReciente && masReciente !== anioSeleccionado) {
      setAnioSeleccionadoState(masReciente)
    }
  }, [anios, anioSeleccionado])

  function seleccionarAnio(anio: string) {
    eligioAnioManualmente.current = true
    setAnioSeleccionadoState(anio)
  }

  const aniosParaPestanas = useMemo(
    () => Array.from(new Set([...anios, anioSeleccionado])).sort(),
    [anios, anioSeleccionado],
  )

  const filas = useMemo(() => {
    const capacidadesPorPersona = new Map<string, Map<string, Capacidad>>()
    for (const capacidad of capacidadesPersona) {
      if (!capacidad.persona_id) continue
      if (!capacidadesPorPersona.has(capacidad.persona_id)) {
        capacidadesPorPersona.set(capacidad.persona_id, new Map())
      }
      capacidadesPorPersona.get(capacidad.persona_id)!.set(capacidad.mes, capacidad)
    }

    const lista: FilaMatrizCapacidad[] = []
    for (const [personaId, porMes] of capacidadesPorPersona) {
      const celdas: Array<Capacidad | null> = []
      for (let mesNumero = 1; mesNumero <= 12; mesNumero++) {
        const clave = `${anioSeleccionado}-${String(mesNumero).padStart(2, '0')}`
        celdas.push(porMes.get(clave) ?? null)
      }
      lista.push({
        personaId,
        nombre: personasPorId.get(personaId)?.nombre || '—',
        celdas,
      })
    }
    lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    return lista
  }, [capacidadesPersona, personasPorId, anioSeleccionado])

  return { aniosParaPestanas, anioSeleccionado, seleccionarAnio, filas }
}
