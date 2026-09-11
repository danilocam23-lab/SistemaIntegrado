import * as XLSX from 'xlsx'
import { REQUERIMIENTOS_COLUMNAS } from '../../constantes'
import type { Requerimiento } from '../../types'

/** Exporta a Excel el listado actualmente filtrado, según los campos
 *  configurados desde Configuración. Único import de `xlsx` de la pantalla. */
export function useExportarExcel(
  puedeExportar: boolean,
  exportCamposActivos: Set<string>,
  datosFiltrados: Requerimiento[],
  camposAccesor: Record<string, (r: Requerimiento) => string | number>,
) {
  function exportarExcel(): void {
    if (!puedeExportar) return
    // INVARIANTE 16: exporta datosFiltrados (no datos) y respeta el orden del catálogo.
    const columnasExport = REQUERIMIENTOS_COLUMNAS.filter((c) => exportCamposActivos.has(c.key))
    const filas = datosFiltrados.map((r) => {
      const fila: Record<string, string | number> = {}
      for (const c of columnasExport) {
        fila[c.label] = camposAccesor[c.key]?.(r) ?? ''
      }
      return fila
    })
    const hoja = XLSX.utils.json_to_sheet(filas)
    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(libro, hoja, 'Requerimientos')
    // INVARIANTE 16: nombre de archivo con fecha UTC.
    const fecha = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(libro, `requerimientos_${fecha}.xlsx`)
  }

  return { exportarExcel }
}
