import type { FilaEstimacion, Requerimiento } from '../../types'
import type { GrupoHU } from './tipos'

export function agruparPorHU(filas: FilaEstimacion[]): GrupoHU[] {
  const mapa = new Map<string, GrupoHU>()
  for (const fila of filas) {
    const key = fila.historia_usuario || `__sin_hu_${fila.numero ?? Math.random()}`
    let grupo = mapa.get(key)
    if (!grupo) {
      grupo = {
        key,
        historia_usuario: fila.historia_usuario || 'Sin Historia de Usuario',
        epica_feature: fila.epica_feature || '—',
        filas: [],
        totalHorasEstimadas: 0,
        totalHorasFinales: 0,
        totalMejor: 0,
        totalPeor: 0,
        totalPromedio: 0,
        createdHU: null,
        createdTasks: [],
        createdTasksEpm: [],
      }
      mapa.set(key, grupo)
    }
    grupo.filas.push(fila)
    grupo.totalHorasEstimadas += fila.horas_estimadas ?? 0
    grupo.totalHorasFinales += fila.horas_totales ?? fila.metodologia_10 ?? 0
    grupo.totalMejor += fila.mejor_caso ?? 0
    grupo.totalPeor += fila.peor_caso ?? 0
    grupo.totalPromedio += fila.promedio ?? 0
    if (fila.created_hu_hitss) grupo.createdHU = fila.created_hu_hitss
    if (fila.created_task_hitss) grupo.createdTasks.push(fila.created_task_hitss)
    if (fila.created_task_epm) grupo.createdTasksEpm.push(fila.created_task_epm)
  }
  return Array.from(mapa.values())
}

export function fechaComprometidaReq(req: Requerimiento): string | null {
  const fechas = (req.entregas ?? [])
    .map((e) => e.fecha_comprometida)
    .filter(Boolean) as string[]
  if (fechas.length === 0) return null
  const hoy = new Date().toISOString().slice(0, 10)
  const futuras = fechas.filter((f) => f.slice(0, 10) >= hoy).sort()
  if (futuras.length > 0) return futuras[0].slice(0, 10)
  return fechas.sort().reverse()[0].slice(0, 10)
}

// INVARIANTE 13 / Lo que NO se toca: copia local; no unificar con otras pantallas.
export function calcularDiasTranscurridos(fechaLimite: string | null, fechaReal: string | null): { dias: number; esNegativo: boolean } | null {
  const hoy = new Date().toISOString().slice(0, 10)
  
  if (!fechaLimite) return null
  
  // Fecha a usar para el cálculo del rango
  const fechaFin = fechaReal ? fechaReal.slice(0, 10) : hoy
  const fechaInicio = fechaLimite.slice(0, 10)
  
  // Calcular diferencia en días
  const fecha1 = new Date(fechaInicio)
  const fecha2 = new Date(fechaFin)
  const diferencia = Math.floor((fecha2.getTime() - fecha1.getTime()) / (1000 * 60 * 60 * 24))
  
  // Determinar si es negativo:
  // - Si no hay fecha real y hoy > fechaLimite: negativo (atraso)
  // - Si hay fecha real y fechaReal > fechaLimite: negativo (atraso)
  // - En caso contrario: positivo (días restantes o dentro de plazo)
  let esNegativo = false
  if (!fechaReal && hoy > fechaInicio) {
    esNegativo = true
  } else if (fechaReal && fechaReal.slice(0, 10) > fechaInicio) {
    esNegativo = true
  }
  
  return { dias: Math.abs(diferencia), esNegativo }
}

export function formatNumber(value: number | null | undefined): string {
  const num = Number(value ?? 0)
  if (!Number.isFinite(num)) return '0'
  return num.toLocaleString('es-CO', { maximumFractionDigits: 2 })
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
}

export function sortEntries<T>(entries: Array<[string, T]>): Array<[string, T]> {
  return [...entries].sort(([a], [b]) => {
    const numA = Number(a)
    const numB = Number(b)
    if (!Number.isNaN(numA) && !Number.isNaN(numB)) return numA - numB
    return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' })
  })
}

export function taskTypeColor(tipo: string | null): string {
  switch (tipo?.toUpperCase()) {
    case 'DESARROLLO': return '#22c55e'
    case 'PRUEBAS': return '#f97316'
    case 'DESPLIEGUE': return '#3b82f6'
    case 'ESTABILIZACION': return '#6b7280'
    default: return '#94a3b8'
  }
}

export function complexityColor(cx: string | null): string {
  switch (cx?.toLowerCase()) {
    case 'bajo': return '#22c55e'
    case 'medio': return '#f59e0b'
    case 'alto': return '#ef4444'
    default: return '#94a3b8'
  }
}

export function normalizarAns(valor: string | null | undefined): string {
  const v = (valor ?? '').trim().toUpperCase().replace(/[_-]+/g, ' ')
  return v === 'CUMPLE' ? 'Cumple' : v === 'NO CUMPLE' ? 'No cumple' : v
}
