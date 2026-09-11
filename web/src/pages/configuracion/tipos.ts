export type Tab = 'tarifas' | 'categorias' | 'roles' | 'tipos_contratacion' | 'festivos' | 'parametros' | 'estados' | 'entregas_actas' | 'requerimientos' | 'carga_excel'

export const PESTANAS: { id: Tab; label: string }[] = [
  { id: 'tarifas', label: '💰 Tarifas' },
  { id: 'categorias', label: '🏷️ Categorías' },
  { id: 'roles', label: '👤 Roles' },
  { id: 'tipos_contratacion', label: '📄 Tipo de contratación' },
  { id: 'festivos', label: '📅 Festivos' },
  { id: 'parametros', label: '⚙️ Parámetros' },
  { id: 'estados', label: '🔖 Estados' },
  { id: 'entregas_actas', label: '📋 Entregas de Actas' },
  { id: 'requerimientos', label: '🧾 Requerimientos' },
  { id: 'carga_excel', label: '📂 Carga de Excel' },
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
