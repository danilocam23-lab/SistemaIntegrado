import { useEffect, useMemo, useState } from 'react'
import client from '../../api/client'
import { useLista } from '../../api/hooks'
import type { Capacidad, Categoria, Configuracion, Persona, Requerimiento } from '../../types'
import type { AsignacionItem } from './tipos'

/**
 * Carga de datos de la pantalla de Asignaciones: las 5 listas (`/asignaciones`,
 * `/personas`, `/categorias`, `/requerimientos`, `/configuracion`) y las
 * capacidades del mes en curso. `error` y `recargar` son los de `/asignaciones`.
 */
export function useDatosAsignaciones() {
  const { datos: asignacionesBase, error, recargar } = useLista<AsignacionItem>('/asignaciones')
  const { datos: personas } = useLista<Persona>('/personas')
  const { datos: categorias } = useLista<Categoria>('/categorias')
  const { datos: requerimientos } = useLista<Requerimiento>('/requerimientos')
  const { datos: configuraciones } = useLista<Configuracion>('/configuracion')

  const asignaciones = useMemo(() => asignacionesBase as AsignacionItem[], [asignacionesBase])

  const mesSel = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }, [])

  const [capacidades, setCapacidades] = useState<Capacidad[]>([])

  useEffect(() => {
    client
      .get<Capacidad[]>(`/capacidades?mes=${mesSel}`)
      .then((r) => setCapacidades(r.data))
      .catch(() => {})
  }, [mesSel])

  return { asignaciones, personas, categorias, requerimientos, configuraciones, capacidades, error, recargar }
}
