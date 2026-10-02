// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLista } from '../../api/hooks'
import type { Asignacion, Configuracion, Festivo, Requerimiento } from '../../types'
import { HORAS_MES_POR_DEFECTO } from '../asignaciones/carga'
import { ESTADO_ACTIVO } from '../asignaciones/tipos'
import { fechaKey } from '../dashboard-backlog/utilidades'
import type { CapacidadFila, CargaFila, PersonaConApp } from './tipos'

/**
 * Carga de datos de Capacidades: `/capacidades` y `/personas` (bloqueantes),
 * `/festivos` y `/configuracion` (la base sugerida cae a 180 h sin festivos si
 * fallan) y `/asignaciones` + `/requerimientos` (solo para la carga vigente por
 * persona; si fallan la columna de carga queda "no disponible").
 *
 * `cargandoInicial` es `true` solo en la primera carga: los refrescos tras
 * escribir no vuelven a mostrar el esqueleto (se perdería el panel abierto).
 */
export function useDatosCapacidades() {
  const lCapacidades = useLista<CapacidadFila>('/capacidades')
  const lPersonas = useLista<PersonaConApp>('/personas')
  const lFestivos = useLista<Festivo>('/festivos')
  const lConfiguracion = useLista<Configuracion>('/configuracion')
  const lAsignaciones = useLista<Asignacion>('/asignaciones')
  const lRequerimientos = useLista<Requerimiento>('/requerimientos')

  const cargando = lCapacidades.cargando || lPersonas.cargando
  const yaCargo = useRef(false)
  const [cargandoInicial, setCargandoInicial] = useState(true)
  useEffect(() => {
    if (!cargando && !yaCargo.current) {
      yaCargo.current = true
      setCargandoInicial(false)
    }
  }, [cargando])

  const horasMesDefault = useMemo(() => {
    const config = lConfiguracion.datos.find((item) => item.clave === 'horas_mes_default')
    const horas = config ? Number(config.valor) : HORAS_MES_POR_DEFECTO
    return Number.isFinite(horas) && horas > 0 ? horas : HORAS_MES_POR_DEFECTO
  }, [lConfiguracion.datos])

  const festivosPorMes = useMemo(() => {
    const mapa = new Map<string, Set<string>>()
    for (const festivo of lFestivos.datos) {
      const dia = fechaKey(festivo.fecha)
      const mes = dia.slice(0, 7)
      if (!mapa.has(mes)) mapa.set(mes, new Set<string>())
      mapa.get(mes)?.add(dia)
    }
    return mapa
  }, [lFestivos.datos])

  const cargaDisponible = !lAsignaciones.error && !lRequerimientos.error
    && !lAsignaciones.cargando && !lRequerimientos.cargando

  // Carga vigente por persona (misma regla que el medidor de Asignaciones):
  // cuenta el % en requerimientos activos y en asignaciones sin requerimiento.
  const cargaPorPersona = useMemo(() => {
    const activos = new Set<string>()
    for (const req of lRequerimientos.datos) {
      if (req.estado === ESTADO_ACTIVO) activos.add(req.id)
    }
    const mapa = new Map<string, CargaFila>()
    for (const asig of lAsignaciones.datos) {
      const fila = mapa.get(asig.persona_id) ?? { pct: 0, nAsignaciones: 0 }
      fila.nAsignaciones += 1
      const reqIds = asig.proyectos.map((p) => p.requerimiento_id).filter(Boolean)
      const esActiva = reqIds.some((id) => id && activos.has(id))
      if (esActiva || reqIds.length === 0) fila.pct += asig.total_porcentaje
      mapa.set(asig.persona_id, fila)
    }
    return mapa
  }, [lAsignaciones.datos, lRequerimientos.datos])

  const { recargar: recargarCapacidades } = lCapacidades
  const { recargar: recargarPersonas } = lPersonas
  const { recargar: recargarFestivos } = lFestivos
  const { recargar: recargarConfiguracion } = lConfiguracion
  const { recargar: recargarAsignaciones } = lAsignaciones
  const { recargar: recargarRequerimientos } = lRequerimientos

  /** Refresca solo las capacidades (tras escribir). */
  const recargar = recargarCapacidades

  const recargarTodo = useCallback(() => {
    recargarCapacidades()
    recargarPersonas()
    recargarFestivos()
    recargarConfiguracion()
    recargarAsignaciones()
    recargarRequerimientos()
  }, [
    recargarCapacidades, recargarPersonas, recargarFestivos,
    recargarConfiguracion, recargarAsignaciones, recargarRequerimientos,
  ])

  const avisosSecundarios = useMemo(() => {
    const lista: string[] = []
    if (lFestivos.error) lista.push('festivos (la base sugerida no los descuenta)')
    if (lConfiguracion.error) lista.push(`configuración (se usan ${HORAS_MES_POR_DEFECTO} h por mes)`)
    if (lAsignaciones.error || lRequerimientos.error) lista.push('asignaciones (la carga no está disponible)')
    return lista
  }, [lFestivos.error, lConfiguracion.error, lAsignaciones.error, lRequerimientos.error])

  return {
    capacidades: lCapacidades.datos,
    personas: lPersonas.datos,
    horasMesDefault,
    festivosPorMes,
    cargaPorPersona,
    cargaDisponible,
    cargandoInicial,
    errorPrincipal: lCapacidades.error || lPersonas.error,
    avisosSecundarios,
    recargar,
    recargarTodo,
  }
}
