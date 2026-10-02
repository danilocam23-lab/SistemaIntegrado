// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import client from '../../api/client'
import { useLista } from '../../api/hooks'
import { useAplicacion } from '../../context/AplicacionContext'
import type { BacklogFuturo, Capacidad, Categoria, Configuracion, Persona, Requerimiento } from '../../types'
import type { AsignacionItem } from './tipos'

/**
 * Carga de datos de la pantalla de Asignaciones: las listas base
 * (`/asignaciones`, `/personas`, `/categorias`, `/requerimientos`,
 * `/configuracion`, `/backlog-futuro`) y las capacidades del mes en curso
 * (recargadas al cambiar la aplicación activa).
 *
 * Expone el estado de cada fuente: `cargandoInicial` (solo la primera carga, no
 * los refrescos tras escribir), `errorPrincipal` (`/asignaciones`) y
 * `erroresSecundarios` (el resto), para no mostrar ceros silenciosos cuando
 * algo falla. `recargar` refresca solo `/asignaciones` (tras una escritura);
 * `recargarTodo` reintenta todas las fuentes.
 */
export function useDatosAsignaciones() {
  const { activa } = useAplicacion()
  const lAsignaciones = useLista<AsignacionItem>('/asignaciones')
  const lPersonas = useLista<Persona>('/personas')
  const lCategorias = useLista<Categoria>('/categorias')
  const lRequerimientos = useLista<Requerimiento>('/requerimientos')
  const lConfiguracion = useLista<Configuracion>('/configuracion')
  const lBacklog = useLista<BacklogFuturo>('/backlog-futuro')

  const asignaciones = useMemo(() => lAsignaciones.datos as AsignacionItem[], [lAsignaciones.datos])

  const requerimientoPorId = useMemo(() => {
    const map = new Map<string, Requerimiento>()
    for (const req of lRequerimientos.datos) map.set(req.id, req)
    return map
  }, [lRequerimientos.datos])

  const mesSel = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }, [])

  const [capacidades, setCapacidades] = useState<Capacidad[]>([])
  const [errorCapacidades, setErrorCapacidades] = useState('')
  const [intentoCapacidades, setIntentoCapacidades] = useState(0)

  useEffect(() => {
    setErrorCapacidades('')
    client
      .get<Capacidad[]>(`/capacidades?mes=${mesSel}`)
      .then((r) => setCapacidades(Array.isArray(r.data) ? r.data : []))
      .catch(() => {
        setCapacidades([])
        setErrorCapacidades('No fue posible cargar las capacidades')
      })
  }, [mesSel, activa, intentoCapacidades])

  const cargando =
    lAsignaciones.cargando || lPersonas.cargando || lRequerimientos.cargando || lCategorias.cargando
  const yaCargo = useRef(false)
  const [cargandoInicial, setCargandoInicial] = useState(true)
  useEffect(() => {
    if (!cargando && !yaCargo.current) {
      yaCargo.current = true
      setCargandoInicial(false)
    }
  }, [cargando])

  const erroresSecundarios = useMemo(() => {
    const lista: string[] = []
    if (lPersonas.error) lista.push('personas')
    if (lCategorias.error) lista.push('categorías')
    if (lRequerimientos.error) lista.push('requerimientos')
    if (lConfiguracion.error) lista.push('configuración (se usan las horas base por defecto)')
    if (lBacklog.error) lista.push('backlog futuro')
    if (errorCapacidades) lista.push('capacidades (se usan las horas base por defecto)')
    return lista
  }, [
    lPersonas.error,
    lCategorias.error,
    lRequerimientos.error,
    lConfiguracion.error,
    lBacklog.error,
    errorCapacidades,
  ])

  const { recargar: recargarAsignaciones } = lAsignaciones
  const { recargar: recargarPersonas } = lPersonas
  const { recargar: recargarCategorias } = lCategorias
  const { recargar: recargarRequerimientos } = lRequerimientos
  const { recargar: recargarConfiguracion } = lConfiguracion
  const { recargar: recargarBacklog } = lBacklog

  const recargarTodo = useCallback(() => {
    recargarAsignaciones()
    recargarPersonas()
    recargarCategorias()
    recargarRequerimientos()
    recargarConfiguracion()
    recargarBacklog()
    setIntentoCapacidades((n) => n + 1)
  }, [
    recargarAsignaciones,
    recargarPersonas,
    recargarCategorias,
    recargarRequerimientos,
    recargarConfiguracion,
    recargarBacklog,
  ])

  return {
    asignaciones,
    personas: lPersonas.datos,
    categorias: lCategorias.datos,
    requerimientos: lRequerimientos.datos,
    configuraciones: lConfiguracion.datos,
    backlogFuturo: lBacklog.datos,
    capacidades,
    requerimientoPorId,
    cargandoInicial,
    errorPrincipal: lAsignaciones.error,
    erroresSecundarios,
    capacidadesFallaron: errorCapacidades !== '',
    recargar: recargarAsignaciones,
    recargarTodo,
  }
}
