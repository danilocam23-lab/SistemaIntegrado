// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import * as XLSX from 'xlsx'
import type { Persona } from '../../types'

/** Exporta a Excel el listado filtrado. Las columnas de valores solo van con `personas.ver_valores`. */
export function exportarPersonasExcel(personas: Persona[], incluirValores: boolean): void {
  const filas = personas.map((p) => {
    const fila: Record<string, string | number> = {
      Nombre: p.nombre,
      Correo: p.email ?? '',
      Squads: (p.squads ?? []).join(', '),
      Rol: p.rol_operativo ?? '',
      'Tipo de contratación': p.tipo_contratacion ?? '',
      Activo: p.activo ? 'Sí' : 'No',
      'F. desactivación': p.fecha_desactivacion ? p.fecha_desactivacion.slice(0, 10) : '',
    }
    if (incluirValores) {
      fila['Valor persona'] = p.valor_persona ?? 0
      fila['Valor periféricos'] = p.valor_perifericos ?? 0
    }
    return fila
  })
  const hoja = XLSX.utils.json_to_sheet(filas)
  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hoja, 'Personas')
  const fecha = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(libro, `personas_${fecha}.xlsx`)
}
