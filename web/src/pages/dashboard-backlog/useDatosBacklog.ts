// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useCallback, useEffect, useMemo, useState } from 'react'
import client, { CONSOLIDADO } from '../../api/client'
import { useLista } from '../../api/hooks'
import { useAplicacion } from '../../context/AplicacionContext'
import type { Aplicacion, Capacidad, Configuracion, Festivo, Persona, Requerimiento, Squad } from '../../types'
import type { RegistroSoporteResumen, ResumenSoporteResponse } from './tipos'

/**
 * Carga de datos crudos del dashboard de Backlog (requerimientos, personas,
 * capacidades, festivos, configuración, squads y resumen de soporte) y los
 * resolvedores de nombre de squad. No aplica ningún filtro de periodo.
 */
export function useDatosBacklog() {
  const { datos: reqs, cargando } = useLista<Requerimiento>('/requerimientos')
  const { datos: aplicaciones } = useLista<Aplicacion>('/aplicaciones')
  const { datos: personas, cargando: cargandoPersonas } = useLista<Persona>('/personas')
  const { datos: capacidades, cargando: cargandoCapacidades } = useLista<Capacidad>('/capacidades')
  const { datos: festivos, cargando: cargandoFestivos } = useLista<Festivo>('/festivos')
  const { datos: configuraciones, cargando: cargandoConfiguraciones } = useLista<Configuracion>('/configuracion')
  const { activa } = useAplicacion()
  const [squadsDoc, setSquadsDoc] = useState<Squad[]>([])
  const [soporteResumen, setSoporteResumen] = useState<RegistroSoporteResumen[]>([])

  useEffect(() => {
    client.get<Squad[]>('/squads', { headers: { 'X-Aplicacion': '__todas__' } })
      .then((r) => setSquadsDoc(r.data))
      .catch(() => {
        client.get<Squad[]>('/squads').then((r) => setSquadsDoc(r.data)).catch(() => {})
      })
  }, [])

  useEffect(() => {
    client
      .get<ResumenSoporteResponse>('/soporte/solicitudes-fabrica/resumen')
      .then((r) => setSoporteResumen(r.data.registros ?? []))
      .catch(() => setSoporteResumen([]))
  }, [])

  const requerimientos = useMemo(() => {
    if (!activa || activa === CONSOLIDADO) return reqs
    return reqs.filter((req) => req.aplicacion_id === activa || req.solicitud?.squad_id === activa)
  }, [reqs, activa])

  const appActiva = useMemo(() => {
    if (activa === CONSOLIDADO) return 'Todos los squads'
    return aplicaciones.find((app) => app.codigo === activa)?.nombre ?? activa
  }, [activa, aplicaciones])

  const resolverNombreSquad = useCallback((id: string | null): string => {
    if (!id) return 'Sin squad'
    const valor = String(id)
    const porDocId = squadsDoc.find((s) => String(s.id) === valor)
    if (porDocId) return porDocId.nombre
    const porDocNombre = squadsDoc.find((s) => s.nombre === valor)
    if (porDocNombre) return porDocNombre.nombre
    const porAppCodigo = aplicaciones.find((a) => a.codigo === valor)
    if (porAppCodigo) return porAppCodigo.nombre
    const porAppNombre = aplicaciones.find((a) => a.nombre === valor)
    if (porAppNombre) return porAppNombre.nombre
    return valor
  }, [aplicaciones, squadsDoc])

  const squadCodigoPorNombre = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const app of aplicaciones) mapa.set(app.nombre, app.codigo)
    for (const squad of squadsDoc) mapa.set(squad.nombre, String(squad.id))
    return mapa
  }, [aplicaciones, squadsDoc])

  const cargandoTodo =
    cargando || cargandoPersonas || cargandoCapacidades || cargandoFestivos || cargandoConfiguraciones

  return {
    activa,
    appActiva,
    requerimientos,
    personas,
    capacidades,
    festivos,
    configuraciones,
    soporteResumen,
    resolverNombreSquad,
    squadCodigoPorNombre,
    cargandoTodo,
  }
}
