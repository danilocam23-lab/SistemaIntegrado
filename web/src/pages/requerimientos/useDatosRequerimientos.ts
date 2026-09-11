import { useEffect, useMemo, useState } from 'react'
import client from '../../api/client'
import { useEstados, useLista } from '../../api/hooks'
import type { Aplicacion, Categoria, Configuracion as ConfigItem, Persona, Requerimiento, Squad } from '../../types'

export function useDatosRequerimientos() {
  const { datos, error, recargar } = useLista<Requerimiento>('/requerimientos')
  // INVARIANTE 10: useEstados() pide /configuracion ademas del useLista('/configuracion') de este hook.
  const { estadosReq, estadosEnt } = useEstados()
  const { datos: personas } = useLista<Persona>('/personas')
  const { datos: categorias } = useLista<Categoria>('/categorias')
  const { datos: configuracion } = useLista<ConfigItem>('/configuracion')
  // Aplicaciones: fuente principal de nombre de squad (squad_id = codigo de app)
  const { datos: aplicaciones } = useLista<Aplicacion>('/aplicaciones')

  // Squads de la colección squads (para registros importados con _id numérico)
  const [squadsCol, setSquadsCol] = useState<Squad[]>([])
  useEffect(() => {
    // INVARIANTE 8: GET /squads conserva X-Aplicacion '__todas__', doble catch y deps [].
    client.get<Squad[]>('/squads', { headers: { 'X-Aplicacion': '__todas__' } })
      .then((r) => setSquadsCol(r.data))
      .catch(() => {
        client.get<Squad[]>('/squads').then((r) => setSquadsCol(r.data)).catch(() => {})
      })
  }, [])

  const nombrePersona = (id: string | null): string =>
    id ? (personas.find((p) => p.id === id)?.nombre ?? id) : '—'

  // Mapa id → nombre combinando aplicaciones (fuente principal: squad_id = codigo de app)
  // y la colección squads (para registros importados con _id numérico).
  const squadPorId = useMemo(() => {
    const m = new Map<string, string>()
    // INVARIANTE 9: primero squadsCol; aplicaciones pisa a squadsCol como regla de precedencia.
    // Primero squads de colección (menor prioridad, colección puede estar vacía)
    squadsCol.forEach((s) => m.set(String(s.id), s.nombre))
    // Luego aplicaciones (mayor prioridad, fuente real de squad_id en la mayoría de los casos)
    aplicaciones.forEach((a) => m.set(String(a.codigo), a.nombre))
    return m
  }, [squadsCol, aplicaciones])

  const personaPorId = useMemo(() => {
    const m = new Map<string, string>()
    personas.forEach((p) => m.set(String(p.id), p.nombre))
    return m
  }, [personas])

  const categoriaPorId = useMemo(() => {
    const m = new Map<string, string>()
    categorias.forEach((c) => m.set(String(c.id), c.nombre))
    return m
  }, [categorias])

  return {
    datos,
    error,
    recargar,
    estadosReq,
    estadosEnt,
    personas,
    categorias,
    configuracion,
    squadPorId,
    personaPorId,
    categoriaPorId,
    nombrePersona,
  }
}
