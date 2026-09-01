export const ESTADOS_REQUERIMIENTO = [
  'ESTIMACION EN CURSO POR HITSS',
  'ESTIMACION EN ESPERA DE APROBACION POR EPM',
  'ESTIMACION APROBADA POR LT',
  'ESTIMACION APROBADA ENTREGA PENDIENTE',
  'ENTREGA CARGADA',
  'ENTREGA NO CARGADA',
  'CONTROL DE CAMBIOS',
  'REQUERIMIENTO DEVUELTO A EPM',
  'REQUERIMIENTO SUSPENDIDO POR EPM',
  'REQUERIMIENTO CANCELADO POR EPM',
  'REQUERIMIENTO CANCELADO',
  'REQUERIMIENTO REEMPLAZADO',
]

export const ESTADOS_ENTREGA = [
  'PENDIENTE',
  'EN ESPERA DE APROBACION',
  'ENTREGA CARGADA',
  'ENTREGA NO CARGADA',
  'APROBADA',
  'RECHAZADA',
  'EN GARANTIA',
]

export const TIPOS_COSTO = ['TYM', 'FIJO']

/** Claves de configuración (colección `configuracion`, grupo `entregas_actas`)
 *  usadas para activar/desactivar columnas, filtros y campos de exportación
 *  de la vista /entregas-actas sin necesidad de desarrollo. */
export const ENTREGAS_ACTAS_CONFIG_CLAVES = {
  columnas: 'entregas_actas_columnas',
  filtros: 'entregas_actas_filtros',
  exportCampos: 'entregas_actas_export_campos',
} as const

export interface EntregasActasCampo {
  key: string
  label: string
  /** Grupo visual para agrupar checkboxes en el tab de Configuración. */
  grupo: 'Entrega' | 'Requerimiento' | 'Solicitud' | 'Facturación'
  /** Si es false, el campo NO se activa automáticamente cuando no hay
   *  configuración guardada (evita cambiar la vista actual al agregar
   *  nuevos campos al catálogo). Los campos ya existentes quedan en true. */
  porDefecto?: boolean
}

/** Columnas disponibles en la tabla de Entregas de Actas.
 *  Incluye los campos ya visibles históricamente (porDefecto: true) y campos
 *  adicionales del modelo de Requerimiento/Entrega/Solicitud que se pueden
 *  activar desde Configuración sin necesidad de desarrollo (porDefecto: false). */
export const ENTREGAS_ACTAS_COLUMNAS: EntregasActasCampo[] = [
  // ── Ya visibles por defecto (no se modifican) ──
  { key: 'codigoReq', label: 'Código REQ', grupo: 'Requerimiento', porDefecto: true },
  { key: 'sc', label: 'SC', grupo: 'Solicitud', porDefecto: true },
  { key: 'squad', label: 'Squad', grupo: 'Solicitud', porDefecto: true },
  { key: 'nombreActa', label: 'Nombre de acta', grupo: 'Requerimiento', porDefecto: true },
  { key: 'actaTrabajo', label: 'Acta de trabajo', grupo: 'Requerimiento', porDefecto: true },
  { key: 'ltEpm', label: 'LT_EPM', grupo: 'Solicitud', porDefecto: true },
  { key: 'entregaNum', label: 'N° Entrega', grupo: 'Entrega', porDefecto: true },
  { key: 'horas', label: 'Horas', grupo: 'Entrega', porDefecto: true },
  { key: 'porcentaje', label: '% Avance', grupo: 'Entrega', porDefecto: true },
  { key: 'fechaComprometida', label: 'F. Comprometida', grupo: 'Entrega', porDefecto: true },
  { key: 'fechaReal', label: 'F. Real', grupo: 'Entrega', porDefecto: true },
  { key: 'diasTranscurridos', label: 'Días transcurridos', grupo: 'Entrega', porDefecto: true },
  { key: 'estado', label: 'Estado', grupo: 'Entrega', porDefecto: true },
  { key: 'mesAprobacion', label: 'Mes de aprobación', grupo: 'Entrega', porDefecto: true },

  // ── Campos adicionales de Entrega (desactivados por defecto) ──
  { key: 'ansEntrega', label: 'ANS entrega', grupo: 'Entrega' },
  { key: 'seLevantoAnsEntrega', label: '¿Se levantó ANS? (entrega)', grupo: 'Entrega' },
  { key: 'observacionesAnsEntrega', label: 'Observaciones ANS (entrega)', grupo: 'Entrega' },
  { key: 'fechaCargue', label: 'F. cargue', grupo: 'Entrega' },
  { key: 'fechaAprobacion', label: 'F. aprobación', grupo: 'Entrega' },
  { key: 'fechaEjecucion', label: 'F. ejecución', grupo: 'Entrega' },
  { key: 'observaciones', label: 'Observaciones (EPM)', grupo: 'Entrega' },
  { key: 'observacionesHitss', label: 'Observaciones Hitss', grupo: 'Entrega' },
  { key: 'tipificacionEntrega', label: 'Tipificación (entrega)', grupo: 'Entrega' },
  { key: 'garantia', label: 'En garantía', grupo: 'Entrega' },
  { key: 'numeroGarantia', label: 'N° garantía', grupo: 'Entrega' },
  { key: 'facturacionEstado', label: 'Estado facturación', grupo: 'Facturación' },
  { key: 'facturacionMes', label: 'Mes de facturación', grupo: 'Facturación' },
  { key: 'facturacionFechaAprobacion', label: 'F. aprobación factura', grupo: 'Facturación' },
  { key: 'facturacionValor', label: 'Valor facturado', grupo: 'Facturación' },

  // ── Campos adicionales de Requerimiento (desactivados por defecto) ──
  { key: 'reqEstado', label: 'Estado del requerimiento', grupo: 'Requerimiento' },
  { key: 'totalHorasEstimadas', label: 'Total horas estimadas', grupo: 'Requerimiento' },
  { key: 'fechaRealEntregaEstimacion', label: 'F. real entrega estimación', grupo: 'Requerimiento' },
  { key: 'ansEstimacion', label: 'ANS estimación', grupo: 'Requerimiento' },
  { key: 'seLevantoAnsReq', label: '¿Se levantó ANS? (req.)', grupo: 'Requerimiento' },
  { key: 'observacionesAnsReq', label: 'Observaciones ANS (req.)', grupo: 'Requerimiento' },
  { key: 'fechaSolicitudActa', label: 'F. solicitud acta', grupo: 'Requerimiento' },
  { key: 'fechaLimite', label: 'F. límite', grupo: 'Requerimiento' },
  { key: 'ansActa', label: 'ANS acta', grupo: 'Requerimiento' },
  { key: 'motivoCierre', label: 'Motivo de cierre', grupo: 'Requerimiento' },
  { key: 'seguimiento', label: 'Seguimiento Hitss', grupo: 'Requerimiento' },
  { key: 'seguimientoEpm', label: 'Seguimiento EPM', grupo: 'Requerimiento' },
  { key: 'tipificacionReq', label: 'Tipificación (requerimiento)', grupo: 'Requerimiento' },
  { key: 'montoPactado', label: 'Monto pactado', grupo: 'Requerimiento' },
  { key: 'cantidadEntregas', label: 'Cantidad de entregas', grupo: 'Requerimiento' },
  { key: 'categoria', label: 'Categoría', grupo: 'Requerimiento' },
  { key: 'developers', label: 'Developers asignados', grupo: 'Requerimiento' },
  { key: 'fechaInicio', label: 'F. inicio', grupo: 'Requerimiento' },
  { key: 'fechaFin', label: 'F. fin', grupo: 'Requerimiento' },

  // ── Campos adicionales de Solicitud (desactivados por defecto) ──
  { key: 'tipoCosto', label: 'Tipo de costo', grupo: 'Solicitud' },
  { key: 'tecnologia', label: 'Tecnología', grupo: 'Solicitud' },
  { key: 'solicitudEstado', label: 'Estado de la solicitud', grupo: 'Solicitud' },
  { key: 'fechaSolicitud', label: 'Fecha de solicitud', grupo: 'Solicitud' },
  { key: 'ltHitss', label: 'LT_HITSS', grupo: 'Solicitud' },
  { key: 'scrum', label: 'Scrum Master', grupo: 'Solicitud' },
  { key: 'anioTarifa', label: 'Año tarifa', grupo: 'Solicitud' },
]

/** Filtros de búsqueda disponibles en la vista de Entregas de Actas. */
export const ENTREGAS_ACTAS_FILTROS: EntregasActasCampo[] = [
  { key: 'texto', label: 'Buscar (texto libre)', grupo: 'Entrega', porDefecto: true },
  { key: 'mes', label: 'Mes de aprobación', grupo: 'Entrega', porDefecto: true },
  { key: 'estado', label: 'Estado', grupo: 'Entrega', porDefecto: true },
  { key: 'ans', label: 'ANS', grupo: 'Entrega', porDefecto: true },
  { key: 'fechas', label: 'F. Comprometida (rango)', grupo: 'Entrega', porDefecto: true },
  { key: 'reqEstado', label: 'Estado del requerimiento', grupo: 'Requerimiento' },
  { key: 'squad', label: 'Squad', grupo: 'Solicitud' },
  { key: 'tipificacion', label: 'Tipificación', grupo: 'Entrega' },
  { key: 'garantia', label: 'En garantía', grupo: 'Entrega' },
]

/** Claves de configuración (colección `configuracion`, grupo `requerimientos`)
 *  usadas para activar/desactivar columnas, filtros y campos de exportación
 *  de la vista /requerimientos sin necesidad de desarrollo. */
export const REQUERIMIENTOS_CONFIG_CLAVES = {
  columnas: 'requerimientos_columnas',
  filtros: 'requerimientos_filtros',
  exportCampos: 'requerimientos_export_campos',
} as const

/** Columnas configurables de la tabla principal de /requerimientos.
 *  Las columnas de acciones (expandir, cargar/ver estimación, editar/eliminar)
 *  NO son configurables porque son funcionales, no informativas.
 *  Incluye las columnas visibles históricamente (porDefecto: true) y campos
 *  adicionales del modelo de Requerimiento/Solicitud que se pueden activar
 *  desde Configuración sin necesidad de desarrollo (porDefecto: false). */
export const REQUERIMIENTOS_COLUMNAS: EntregasActasCampo[] = [
  // ── Ya visibles por defecto (no se modifican) ──
  { key: 'codigoReq', label: 'Código REQ', grupo: 'Requerimiento', porDefecto: true },
  { key: 'sc', label: 'SC', grupo: 'Solicitud', porDefecto: true },
  { key: 'squad', label: 'Squad', grupo: 'Solicitud', porDefecto: true },
  { key: 'nombreActa', label: 'Nombre de acta', grupo: 'Requerimiento', porDefecto: true },
  { key: 'aplicacionEpm', label: 'Aplicación EPM', grupo: 'Requerimiento', porDefecto: true },
  { key: 'estado', label: 'Estado', grupo: 'Requerimiento', porDefecto: true },
  { key: 'ansEstimacion', label: 'ANS Estimación', grupo: 'Requerimiento', porDefecto: true },
  { key: 'ltHitss', label: 'Líder técnico', grupo: 'Solicitud', porDefecto: true },
  { key: 'scrum', label: 'Scrum', grupo: 'Solicitud', porDefecto: true },
  { key: 'horas', label: 'Horas', grupo: 'Requerimiento', porDefecto: true },
  { key: 'fechaSolicitud', label: 'F. Solicitud', grupo: 'Requerimiento', porDefecto: true },
  { key: 'fechaLimite', label: 'F. Límite', grupo: 'Requerimiento', porDefecto: true },
  { key: 'fechaReal', label: 'F. Real', grupo: 'Requerimiento', porDefecto: true },
  { key: 'diasTranscurridos', label: 'Días transcurridos', grupo: 'Requerimiento', porDefecto: true },
  { key: 'entregasCount', label: 'Entregas', grupo: 'Entrega', porDefecto: true },

  // ── Campos adicionales de Requerimiento (desactivados por defecto) ──
  { key: 'ansEstimacionReal', label: 'ANS estimación (real)', grupo: 'Requerimiento' },
  { key: 'seLevantoAnsReq', label: '¿Se levantó ANS?', grupo: 'Requerimiento' },
  { key: 'observacionesAnsReq', label: 'Observaciones ANS', grupo: 'Requerimiento' },
  { key: 'motivoCierre', label: 'Motivo de cierre', grupo: 'Requerimiento' },
  { key: 'seguimiento', label: 'Seguimiento Hitss', grupo: 'Requerimiento' },
  { key: 'seguimientoEpm', label: 'Seguimiento EPM', grupo: 'Requerimiento' },
  { key: 'tipificacion', label: 'Tipificación', grupo: 'Requerimiento' },
  { key: 'montoPactado', label: 'Monto pactado', grupo: 'Requerimiento' },
  { key: 'actaTrabajo', label: 'Acta de trabajo', grupo: 'Requerimiento' },
  { key: 'cantidadEntregas', label: 'Cantidad de entregas', grupo: 'Requerimiento' },
  { key: 'categoria', label: 'Categoría', grupo: 'Requerimiento' },
  { key: 'developers', label: 'Developers asignados', grupo: 'Requerimiento' },
  { key: 'fechaInicio', label: 'F. inicio', grupo: 'Requerimiento' },
  { key: 'fechaFin', label: 'F. fin', grupo: 'Requerimiento' },

  // ── Campos adicionales de Solicitud (desactivados por defecto) ──
  { key: 'ltEpm', label: 'LT_EPM', grupo: 'Solicitud' },
  { key: 'tipoCosto', label: 'Tipo de costo', grupo: 'Solicitud' },
  { key: 'tecnologia', label: 'Tecnología', grupo: 'Solicitud' },
  { key: 'solicitudEstado', label: 'Estado de la solicitud', grupo: 'Solicitud' },
  { key: 'fechaSolicitudSc', label: 'Fecha de solicitud (SC)', grupo: 'Solicitud' },
  { key: 'anioTarifa', label: 'Año tarifa', grupo: 'Solicitud' },
]

/** Filtros de búsqueda disponibles en la vista de Requerimientos. */
export const REQUERIMIENTOS_FILTROS: EntregasActasCampo[] = [
  { key: 'codigoReq', label: 'Código REQ', grupo: 'Requerimiento', porDefecto: true },
  { key: 'sc', label: 'SC', grupo: 'Solicitud', porDefecto: true },
  { key: 'squad', label: 'Squad', grupo: 'Solicitud', porDefecto: true },
  { key: 'estado', label: 'Estado', grupo: 'Requerimiento', porDefecto: true },
  { key: 'liderTecnico', label: 'Líder técnico', grupo: 'Solicitud', porDefecto: true },
  { key: 'estadoEntrega', label: 'Estado (entregas)', grupo: 'Entrega', porDefecto: true },
  { key: 'ansEstimacion', label: 'ANS Estimación', grupo: 'Requerimiento', porDefecto: true },
  { key: 'fechaSolicitud', label: 'Fecha y hora de solicitud (rango)', grupo: 'Requerimiento', porDefecto: true },
  { key: 'fechaComprometida', label: 'Fecha comprometida (rango)', grupo: 'Requerimiento', porDefecto: true },
  { key: 'fechaLimite', label: 'Fecha real entrega estimación (rango)', grupo: 'Requerimiento', porDefecto: true },
  { key: 'categoria', label: 'Categoría', grupo: 'Requerimiento' },
  { key: 'tipificacion', label: 'Tipificación', grupo: 'Requerimiento' },
  { key: 'tipoCosto', label: 'Tipo de costo', grupo: 'Solicitud' },
]

/**
 * Lee de la colección `configuracion` (clave/valor) el conjunto de campos activos
 * para una clave dada. El valor se guarda como JSON.stringify(string[]).
 * Si no existe configuración guardada (o está vacía/corrupta), retorna los campos
 * marcados `porDefecto: true` (o todos si ninguno lo indica), para no romper el
 * comportamiento existente al agregar nuevos campos al catálogo.
 */
export function leerCamposActivos(
  datos: { clave: string; valor?: string }[],
  clave: string,
  todos: EntregasActasCampo[],
): Set<string> {
  const porDefecto = todos.some((t) => t.porDefecto)
    ? todos.filter((t) => t.porDefecto).map((t) => t.key)
    : todos.map((t) => t.key)
  const config = datos.find((d) => d.clave === clave)
  if (!config?.valor) return new Set(porDefecto)
  try {
    const arr = JSON.parse(config.valor)
    if (!Array.isArray(arr) || arr.length === 0) return new Set(porDefecto)
    return new Set(arr as string[])
  } catch {
    return new Set(porDefecto)
  }
}



