import { useMemo } from 'react'
import { REQUERIMIENTOS_CONFIG_CLAVES, REQUERIMIENTOS_COLUMNAS, REQUERIMIENTOS_FILTROS, leerCamposActivos } from '../../constantes'
import type { Configuracion as ConfigItem } from '../../types'
import { CORE_COLUMNAS } from './tipos'

export function useCamposRequerimientos(configuracion: ConfigItem[]) {
  /** Columnas, filtros y campos de exportación activados desde /configuracion
   *  (tab "Requerimientos" en Configuración). Por defecto, todo lo histórico activo. */
  const columnasActivas = useMemo(
    () => leerCamposActivos(configuracion, REQUERIMIENTOS_CONFIG_CLAVES.columnas, REQUERIMIENTOS_COLUMNAS),
    [configuracion],
  )
  const filtrosActivos = useMemo(
    () => leerCamposActivos(configuracion, REQUERIMIENTOS_CONFIG_CLAVES.filtros, REQUERIMIENTOS_FILTROS),
    [configuracion],
  )
  const exportCamposActivos = useMemo(
    () => leerCamposActivos(configuracion, REQUERIMIENTOS_CONFIG_CLAVES.exportCampos, REQUERIMIENTOS_COLUMNAS),
    [configuracion],
  )
  // INVARIANTE 13: columnasExtra es "el catalogo menos las 15 historicas", en orden de catalogo.
  const columnasExtra = useMemo(
    () => REQUERIMIENTOS_COLUMNAS.filter((c) => !CORE_COLUMNAS.includes(c.key) && columnasActivas.has(c.key)),
    [columnasActivas],
  )

  // INVARIANTE 12: totalColumnasTabla se calcula una vez aqui y se inyecta; no recalcular en subfilas.
  const coreVisibleCount = CORE_COLUMNAS.filter((k) => columnasActivas.has(k)).length
  const metricasVisibles = ['horas', 'entregasCount'].filter((k) => columnasActivas.has(k))
  const totalColumnasTabla = 2 + coreVisibleCount + columnasExtra.length

  return { columnasActivas, filtrosActivos, exportCamposActivos, columnasExtra, coreVisibleCount, metricasVisibles, totalColumnasTabla }
}
