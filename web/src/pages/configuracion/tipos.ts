import type { NombreIcono } from '../../components/ui'

export type Tab = 'tarifas' | 'categorias' | 'roles' | 'tipos_contratacion' | 'festivos' | 'parametros' | 'estados' | 'entregas_actas' | 'requerimientos' | 'carga_excel'

export const PESTANAS: { id: Tab; label: string; icono?: NombreIcono }[] = [
  { id: 'tarifas', label: 'Tarifas', icono: 'facturacion' },
  { id: 'categorias', label: 'Categorías' },
  { id: 'roles', label: 'Roles', icono: 'personas' },
  { id: 'tipos_contratacion', label: 'Tipo de contratación', icono: 'documento' },
  { id: 'festivos', label: 'Festivos', icono: 'calendario' },
  { id: 'parametros', label: 'Parámetros', icono: 'administracion' },
  { id: 'estados', label: 'Estados' },
  { id: 'entregas_actas', label: 'Entregas de Actas', icono: 'documento' },
  { id: 'requerimientos', label: 'Requerimientos', icono: 'documento' },
  { id: 'carga_excel', label: 'Carga de Excel', icono: 'caja' },
]

export interface UltimaSincronizacionResumen {
  sync_id: string
  estado: string
  archivo: string | null
  total_encontrados: number
  cargados: number
  con_error: number
  iniciado_en: string | null
  finalizado_en: string | null
  error_general: string | null
}
