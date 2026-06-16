export type RolUsuario = 'superadmin' | 'admin_app' | 'editor' | 'viewer'

export const ROLES_ADMIN: RolUsuario[] = ['superadmin', 'admin_app']

export interface Usuario {
  id: string
  nombre: string
  email: string
  rol: RolUsuario
  activo: boolean
  aplicaciones_codigos: string[]
  permisos: string[]
}

export interface Aplicacion {
  id: string
  codigo: string
  nombre: string
  descripcion: string
  activa: boolean
  creada_por: string | null
}

export interface TokenResponse {
  access_token: string
  token_type: string
  usuario: Usuario
}

// --- Dominio de liquidación ---

export interface Solicitud {
  codigo_sc: string
  fecha_solicitud: string | null
  tipo_costo: string | null
  tecnologia: string | null
  estado: string | null
  aplicativo_id: string | null
  squad_id: string | null
  lt_hitss_id: string | null
  lt_epm_id: string | null
  scrum_id: string | null
  tarifa_id: string | null
  anio_tarifa: number | null
}

export interface Squad {
  id: string
  nombre: string
  lt_hitss_id: string | null
  activo: boolean
}

export interface Entrega {
  numero: number
  horas: number | null
  porcentaje: number | null
  fecha_comprometida: string | null
  fecha_recepcion: string | null
  fecha_cargue: string | null
  fecha_aprobacion: string | null
  fecha_ejecucion: string | null
  estado: string | null
  ans_entrega: string | null
  garantia: boolean
}

export interface Requerimiento {
  id: string
  aplicacion_id: string
  codigo_req: string
  nombre: string | null
  estado: string
  solicitud: Solicitud
  total_horas_estimadas: number | null
  fecha_real_entrega_estimacion: string | null
  ans_estimacion: string | null
  fecha_solicitud_acta: string | null
  fecha_limite: string | null
  ans_acta: string | null
  motivo_cierre: string | null
  seguimiento: string | null
  acta_trabajo: string | null
  monto_pactado: number | null
  cantidad_entregas: number
  categoria_id: string | null
  developers_asignados: string[]
  fecha_inicio: string | null
  fecha_fin: string | null
  entregas: Entrega[]
}

export interface Tarifa {
  id: string
  anio: number
  valor_hora: number
  ramificacion: string | null
}

export interface Festivo {
  id: string
  fecha: string
  descripcion: string | null
}

export interface Acta {
  id: string
  codigo: string
  fecha: string | null
  direccion: string | null
  total_horas: number | null
  total_valor: number | null
}

export interface Orden {
  id: string
  numero: string
  vigencia: string | null
  monto: number | null
}

export interface LiquidacionEntrega {
  numero: number
  valor?: number
  error?: string
}

export interface Liquidacion {
  codigo_req: string
  total: number
  entregas: LiquidacionEntrega[]
}

// --- Dominio de carga de trabajo ---

export interface Persona {
  id: string
  nombre: string
  email: string | null
  rol_operativo: string
  activo: boolean
  squads: string[]
  es_lider_tecnico?: boolean
  permite_sobrecarga?: boolean
  usuario_id?: string | null
}

export interface Categoria {
  id: string
  nombre: string
  color: string
  orden: number
}

export interface Proyecto {
  id: string
  nombre: string
  estado: string
  requerimiento_id: string | null
}

export interface Asignacion {
  id: string
  persona_id: string
  categoria_id: string
  total_porcentaje: number
  estado: string
  prioridad?: boolean
  proyectos: Proyecto[]
}

export interface Capacidad {
  id: string
  scope: string
  persona_id: string | null
  squad_id: string | null
  mes: string
  horas_disponibles: number
  personas: number
}

// --- Transversal ---

export interface EventoBitacora {
  id: string
  entidad_tipo: string
  entidad_id: string
  accion: string
  descripcion: string
  autor: string | null
  creado_en: string
}

export interface FilaEquipo {
  persona: string
  rol: string
  activo: boolean
  asignaciones: number
  proyectos: number
  carga: number
}

export interface ItemRoadmap {
  persona_id: string
  proyecto: string
  estado: string
  fecha_inicio: string | null
  fecha_fin: string | null
  sprints: number
  requerimiento_id: string | null
}

// --- Configuración / Estimaciones / Azure DevOps ---

export interface Configuracion {
  id: string
  clave: string
  valor: string
  grupo: string
  es_base: boolean
}

export interface FilaEstimacion {
  numero: number | null
  epica_feature: string | null
  historia_usuario: string | null
  tipo_tarea: string | null
  sprint: number | null
  id_epm: string | null
  id_hitss: string | null
  actividad: string | null
  complejidad: string | null
  horas_estimadas: number
  mejor_caso: number
  peor_caso: number
  promedio: number
  metodologia_10: number
  horas_totales: number
  created_task_hitss?: number | null
  created_task_epm?: number | null
  created_hu_hitss?: number | null
}

export interface Estimacion {
  id: string
  requerimiento_id: string | null
  titulo: string | null
  cliente: string | null
  iniciativa: string | null
  created_feature_hitss?: number | null
  fecha_estimacion: string | null
  archivo: string | null
  total_filas: number
  total_horas: number
  total_horas_estimadas: number
  total_mejor_caso: number
  total_peor_caso: number
  total_promedio: number
  total_horas_finales: number
  subido_en: string | null
  filas: FilaEstimacion[]
}

interface SummaryEntry {
  count: number
  estimated: number
  best: number
  worst: number
  average: number
  total: number
}

interface ComplexitySummary {
  count: number
  estimated: number
  average: number
  total: number
}

export interface EstimacionConResumen {
  exists: boolean
  estimacion: Estimacion | null
  summary: {
    byType: Record<string, SummaryEntry>
    bySprint: Record<string, SummaryEntry>
    byComplexity: Record<string, ComplexitySummary>
  } | null
}

export interface AzdoProyecto {
  id: string
  nombre: string
  estado: string | null
}

export interface AzdoIteracion {
  nombre: string
  path: string
}

export interface AzdoWorkItem {
  id: string
  azdo_id: number
  tipo: string
  titulo: string
  estado: string | null
  asignado_a: string | null
  original_estimate: number
  completed_work: number
  remaining_work: number
  iteration_path: string | null
}

export interface AzdoSyncLog {
  id: string
  estado: string
  work_items: number
  total_completado: number
  total_restante: number
  total_original: number
  error: string | null
  iniciado_en: string
  finalizado_en: string | null
}
