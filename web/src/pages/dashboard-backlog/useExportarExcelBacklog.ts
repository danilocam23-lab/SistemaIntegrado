// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import * as XLSX from 'xlsx'
import type { FilaSquadAnalisis } from './tipos'

const ETIQUETA_ESTADO = { exito: 'Cumple', alerta: 'En atención', error: 'Crítico' } as const

/** Exporta a Excel la tabla "Detalle Completo por Squad" (ANS como % numérico). */
export function useExportarExcelBacklog(filas: FilaSquadAnalisis[]) {
  function exportarExcel(): void {
    if (filas.length === 0) return
    const datos = filas.map((fila) => ({
      Squad: fila.squad,
      Requerimientos: fila.reqs,
      'Horas estimadas (requerimientos)': Math.round(fila.horas * 10) / 10,
      'Horas de entregas del periodo': Math.round(fila.horasEntregas * 10) / 10,
      Entregas: fila.entregas,
      'ANS Acta cumple': fila.ansActaCumple,
      'ANS Acta total': fila.ansActaTotal,
      'ANS Acta %': fila.porcentajeActa ?? '',
      'ANS Entrega cumple': fila.ansEntregaCumple,
      'ANS Entrega total': fila.ansEntregaTotal,
      'ANS Entrega %': fila.porcentajeEntrega ?? '',
      'Aplicaciones EPM': fila.aplicacionesEpmCount,
      'Capacidad disponible (h)': fila.capacidadHoras === null ? '' : Math.round(fila.capacidadHoras * 10) / 10,
      'Utilización % (horas de entregas / capacidad)': fila.utilizacion ?? '',
      Sobrecarga: fila.sobrecarga ? 'Sí' : 'No',
      'Estado ANS': fila.nivelGlobal === null ? 'Sin datos' : ETIQUETA_ESTADO[fila.nivelGlobal],
    }))
    const hoja = XLSX.utils.json_to_sheet(datos)
    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(libro, hoja, 'Detalle por Squad')
    const fecha = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(libro, `dashboard-backlog_${fecha}.xlsx`)
  }

  return { exportarExcel }
}
