// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useCallback, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Capacidad, Requerimiento } from '../../types'
import type { PresetRango, RegistroSoporteResumen } from './tipos'
import { mesActual, mesDesdeEntrega, mesDesdeFecha } from './utilidades'

const TODOS_LOS_MESES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']

/** Últimos `cantidad` meses terminando en el mes actual (inclusive), ordenados. */
function ultimosMeses(cantidad: number): string[] {
  const hoy = new Date()
  const periodos: string[] = []
  for (let i = cantidad - 1; i >= 0; i -= 1) {
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
    periodos.push(`${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`)
  }
  return periodos
}

/** Periodos `"YYYY-MM"` de un preset; "todo" abarca todos los años con datos. */
function periodosDePreset(preset: PresetRango, anosDisponibles: string[], anoInicial: string): string[] {
  if (preset !== 'todo') return ultimosMeses(preset)
  const anos = anosDisponibles.length > 0 ? anosDisponibles : [anoInicial]
  return anos.flatMap((ano) => TODOS_LOS_MESES.map((mes) => `${ano}-${mes.padStart(2, '0')}`)).sort()
}

/**
 * Estado del filtro de periodo del dashboard. Única fuente de
 * `periodosSeleccionados` (`"YYYY-MM"`), que consumen todos los cálculos.
 *
 * Hay dos formas de fijarlo: los filtros Año/Mes (producto cartesiano) o un
 * preset rápido (rango relativo a hoy, que puede cruzar de año y por eso no
 * se puede expresar como Año x Mes). El preset queda como estado intermedio y
 * se descarta en cuanto el usuario toca Año o Mes.
 */
export function useFiltroPeriodo(
  capacidades: Capacidad[],
  requerimientos: Requerimiento[],
  soporteResumen: RegistroSoporteResumen[],
) {
  const mesInicial = mesActual()
  const anoInicial = mesInicial.slice(0, 4)
  const mesInicialNumero = String(Number(mesInicial.slice(5, 7)))

  const [anosActivos, setAnosCrudo] = useState<Set<string>>(() => new Set([anoInicial]))
  const [mesesActivos, setMesesCrudo] = useState<Set<string>>(() => new Set([mesInicialNumero]))
  const [presetActivo, setPresetActivo] = useState<PresetRango | null>(null)

  const anosDisponibles = useMemo(() => {
    const set = new Set<string>()
    for (const capacidad of capacidades) {
      if (capacidad.mes && capacidad.mes.length >= 4) set.add(capacidad.mes.slice(0, 4))
    }
    for (const registro of soporteResumen) {
      const mes = mesDesdeFecha(registro.Fecha_Fin_Real)
      if (mes) set.add(mes.slice(0, 4))
    }
    for (const req of requerimientos) {
      for (const entrega of req.entregas ?? []) {
        const mes = mesDesdeEntrega(req, entrega)
        if (mes) set.add(mes.slice(0, 4))
      }
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [capacidades, requerimientos, soporteResumen])

  // Tocar Año o Mes a mano descarta el preset.
  const setAnosActivos: Dispatch<SetStateAction<Set<string>>> = useCallback((valor) => {
    setPresetActivo(null)
    setAnosCrudo(valor)
  }, [])
  const setMesesActivos: Dispatch<SetStateAction<Set<string>>> = useCallback((valor) => {
    setPresetActivo(null)
    setMesesCrudo(valor)
  }, [])

  const periodosPreset = useMemo(
    () => (presetActivo === null ? null : periodosDePreset(presetActivo, anosDisponibles, anoInicial)),
    [presetActivo, anosDisponibles, anoInicial],
  )

  const periodosSeleccionados = useMemo(() => {
    if (periodosPreset) return periodosPreset
    const anos = anosActivos.size > 0
      ? Array.from(anosActivos)
      : (anosDisponibles.length > 0 ? anosDisponibles : [anoInicial])
    const meses = mesesActivos.size > 0 ? Array.from(mesesActivos) : TODOS_LOS_MESES
    const periodos = anos.flatMap((ano) => meses.map((mes) => `${ano}-${mes.padStart(2, '0')}`))
    return Array.from(new Set(periodos)).sort()
  }, [periodosPreset, anosActivos, anosDisponibles, anoInicial, mesesActivos])

  /** Aplica un preset y refleja el rango en los desplegables Año/Mes. */
  const aplicarPreset = useCallback((preset: PresetRango) => {
    const periodos = periodosDePreset(preset, anosDisponibles, anoInicial)
    setAnosCrudo(new Set(periodos.map((periodo) => periodo.slice(0, 4))))
    setMesesCrudo(new Set(periodos.map((periodo) => String(Number(periodo.slice(5, 7))))))
    setPresetActivo(preset)
  }, [anosDisponibles, anoInicial])

  const restablecer = useCallback(() => {
    setPresetActivo(null)
    setAnosCrudo(new Set([anoInicial]))
    setMesesCrudo(new Set([mesInicialNumero]))
  }, [anoInicial, mesInicialNumero])

  return {
    anoInicial,
    mesInicialNumero,
    anosDisponibles,
    anosActivos,
    setAnosActivos,
    mesesActivos,
    setMesesActivos,
    presetActivo,
    aplicarPreset,
    restablecer,
    periodosSeleccionados,
  }
}
