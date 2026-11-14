// Solo identificadores funcionales estáticos; nunca nombres o IDs del negocio.
export const PANTALLAS = [
  ['/login', 'login', 'sesion'],
  ['/dashboard', 'dashboard', 'dashboard'],
  ['/dashboard-estados', 'dashboard_estados', 'dashboard'],
  ['/dashboard-backlog', 'dashboard_backlog', 'dashboard'],
  ['/requerimientos', 'requerimientos', 'requerimientos'],
  ['/requerimientos/detalle-ans', 'requerimientos_ans', 'requerimientos'],
  ['/requerimientos/nuevo', 'requerimiento_nuevo', 'requerimientos'],
  ['/requerimientos/:reqId', 'requerimiento_detalle', 'requerimientos'],
  ['/entregas-actas', 'entregas_actas', 'entregas'],
  ['/predictivos', 'predictivos', 'predictivos'],
  ['/backlog-futuro', 'backlog_futuro', 'backlog'],
  ['/personas', 'personas', 'personas'],
  ['/asignaciones', 'asignaciones', 'asignaciones'],
  ['/capacidades', 'capacidades', 'capacidades'],
  ['/planes-accion', 'planes_accion', 'planes'],
  ['/control-horas-facturable', 'control_horas_facturable', 'horas'],
  ['/roadmap', 'roadmap', 'roadmap'],
  ['/estimaciones', 'estimaciones', 'estimaciones'],
  ['/azure-devops', 'azure_devops', 'azure'],
  ['/configuracion', 'configuracion', 'configuracion'],
  ['/admin/aplicaciones', 'admin_aplicaciones', 'administracion'],
  ['/admin/usuarios', 'admin_usuarios', 'administracion'],
  ['/admin/endpoints', 'admin_endpoints', 'administracion'],
  ['/admin/esquema-azure', 'admin_esquema_azure', 'azure'],
  ['/admin/importacion', 'admin_importacion', 'importacion'],
  ['/facturacion/general', 'facturacion_general', 'facturacion'],
  ['/facturacion/ans-descontados', 'facturacion_ans', 'facturacion'],
  ['/facturacion/valores-proyecto', 'facturacion_valores', 'facturacion'],
  ['/soporte/solicitudes-fabrica', 'soporte_solicitudes', 'soporte'],
  ['/soporte/detalle-ans', 'soporte_ans', 'soporte'],
  ['/soporte/garantias-wo', 'soporte_garantias', 'soporte'],
] as const

export type Modulo = typeof PANTALLAS[number][2]
export type Pantalla = typeof PANTALLAS[number][1]
export type TipoControl = 'boton' | 'enlace' | 'tab' | 'filtro' | 'busqueda' | 'modal' | 'paginacion'
declare const __CONTROLES_ANALITICA__: Record<string, readonly [string, TipoControl]>
const controlesCompilados: Record<string, readonly [string, TipoControl]> =
  typeof __CONTROLES_ANALITICA__ === 'undefined' ? {} : __CONTROLES_ANALITICA__

export const CONTROLES = {
  'requerimiento.volver': ['volver', 'enlace'],
  'requerimiento.crear': ['crear', 'boton'],
  'requerimiento.squad_destino': ['seleccionar_squad_destino', 'filtro'],
  'requerimiento.tipo_costo': ['seleccionar_tipo_costo', 'filtro'],
  'requerimiento.squad': ['seleccionar_squad', 'filtro'],
  'requerimiento.lt_hitss': ['seleccionar_lt_hitss', 'filtro'],
  'requerimiento.lt_epm': ['seleccionar_lt_epm', 'filtro'],
  'requerimiento.scrum': ['seleccionar_scrum', 'filtro'],
  'requerimiento.analista': ['seleccionar_analista', 'filtro'],
  'requerimiento.tipificacion': ['seleccionar_tipificacion', 'filtro'],
  'requerimiento.guardar_azure': ['guardar_azure', 'boton'],
  'requerimiento.guardar_analista': ['guardar_analista', 'boton'],
  'entrega.guardar': ['guardar', 'boton'],
  'entrega.cancelar': ['cancelar', 'boton'],
  'entrega.historial': ['abrir_historial', 'boton'],
  'entrega.estado': ['seleccionar_estado', 'filtro'],
  'entrega.mes': ['seleccionar_mes', 'filtro'],
  'entrega.tipificacion': ['seleccionar_tipificacion', 'filtro'],
  'entrega.garantia': ['alternar_garantia', 'filtro'],
  'menu.navegar': ['navegar', 'enlace'],
  'menu.grupo': ['alternar_grupo', 'boton'],
  'menu.colapsar': ['alternar_menu', 'boton'],
  'menu.cerrar': ['cerrar_menu', 'boton'],
  'menu.salir': ['logout', 'boton'],
  'modal.cerrar': ['cerrar', 'modal'],
  'modal.fondo': ['cerrar_fondo', 'modal'],
  'filtro.abrir': ['abrir', 'filtro'],
  'filtro.todos': ['seleccionar_todos', 'filtro'],
  'filtro.limpiar': ['limpiar', 'filtro'],
  'filtro.opcion': ['filtrar', 'filtro'],
  'usuarios.tab_usuarios': ['usuarios', 'tab'],
  'usuarios.tab_roles': ['roles', 'tab'],
  'usuarios.buscar': ['buscar', 'busqueda'],
  'usuarios.filtro_rol': ['filtrar_rol', 'filtro'],
  'usuarios.filtro_squad': ['filtrar_squad', 'filtro'],
  'usuarios.nuevo': ['crear', 'boton'],
  'usuarios.editar': ['editar', 'boton'],
  'usuarios.rol': ['cambiar_rol', 'filtro'],
  'usuarios.activar': ['alternar_activo', 'boton'],
  'usuarios.password': ['restablecer_password', 'boton'],
  'usuarios.eliminar': ['eliminar', 'boton'],
  'usuarios.anterior': ['anterior', 'paginacion'],
  'usuarios.siguiente': ['siguiente', 'paginacion'],
  'usuarios.primera': ['primera', 'paginacion'],
  'usuarios.ultima': ['ultima', 'paginacion'],
  'usuarios.guardar': ['guardar', 'boton'],
  'usuarios.cancelar': ['cancelar', 'boton'],
  'usuarios.squad': ['seleccionar_squad', 'filtro'],
  'usuarios.squads_todos': ['seleccionar_todos', 'boton'],
  'usuarios.squads_limpiar': ['limpiar', 'boton'],
  'roles.nuevo': ['crear', 'boton'],
  'roles.seleccionar': ['seleccionar', 'boton'],
  'roles.desplegar_modulo': ['alternar_modulo_visible', 'boton'],
  'roles.permiso': ['alternar_permiso', 'filtro'],
  'roles.modulo': ['alternar_modulo', 'filtro'],
  'roles.guardar': ['guardar', 'boton'],
  'roles.eliminar': ['eliminar', 'boton'],
  'roles.activo': ['alternar_activo', 'filtro'],
  'entregas.exportar': ['exportar', 'boton'],
  'entregas.detalle': ['abrir_detalle', 'enlace'],
  'entregas.buscar': ['buscar', 'busqueda'],
  'entregas.estado': ['filtrar_estado', 'filtro'],
  'entregas.ans': ['filtrar_ans', 'filtro'],
  'entregas.mes': ['filtrar_mes', 'filtro'],
  'entregas.req_estado': ['filtrar_requerimiento_estado', 'filtro'],
  'entregas.squad': ['filtrar_squad', 'filtro'],
  'entregas.tipificacion': ['filtrar_tipificacion', 'filtro'],
  'entregas.garantia': ['filtrar_garantia', 'filtro'],
  'entregas.compromiso_desde': ['filtrar_compromiso_desde', 'filtro'],
  'entregas.compromiso_hasta': ['filtrar_compromiso_hasta', 'filtro'],
  'entregas.real_desde': ['filtrar_real_desde', 'filtro'],
  'entregas.real_hasta': ['filtrar_real_hasta', 'filtro'],
} as const satisfies Record<string, readonly [string, TipoControl]>

export type IdControl = keyof typeof CONTROLES
export const FORMULARIOS = ['usuario', 'rol', 'requerimiento_nuevo', 'entrega', 'entrega_editar', 'requerimiento_general'] as const
export type IdFormulario = typeof FORMULARIOS[number]
export const EXPORTACIONES = ['entregas_excel', 'requerimientos_excel', 'backlog_excel', 'personas_excel'] as const
export type IdExportacion = typeof EXPORTACIONES[number]

export function buscarPantalla(ruta: string) {
  const limpia = ruta.split(/[?#]/, 1)[0].replace(/\/$/, '') || '/'
  const exacta = PANTALLAS.find(([plantilla]) => plantilla === limpia)
  if (exacta) return exacta
  return /^\/requerimientos\/[^/]+$/.test(limpia)
    ? PANTALLAS.find(([plantilla]) => plantilla === '/requerimientos/:reqId')
    : undefined
}

export function quitarBaseAnalitica(ruta: string, base: string): string {
  const prefijo = base.replace(/\/$/, '')
  if (!prefijo) return ruta
  if (ruta === prefijo) return '/'
  return ruta.startsWith(`${prefijo}/`) ? ruta.slice(prefijo.length) : '/'
}

export function buscarControl(id: string | null): readonly [string, TipoControl] | undefined {
  if (!id) return undefined
  if (Object.prototype.hasOwnProperty.call(CONTROLES, id)) return CONTROLES[id as IdControl]
  return Object.prototype.hasOwnProperty.call(controlesCompilados, id) ? controlesCompilados[id] : undefined
}

export function esFormulario(id: string | null): id is IdFormulario {
  return FORMULARIOS.some(formulario => formulario === id)
}

// Catálogo por método y plantilla constatado en llamadas del frontend.
// No se emiten URLs. Un 2xx indica respuesta HTTP, NO finalización de trabajos asíncronos.
const OPERACIONES: ReadonlyArray<readonly [string, RegExp, Modulo, string, string]> = [
  ['POST', /^\/auth\/login$/, 'sesion', 'login', 'sesion'],
  ['GET', /^\/azdo\/test$/, 'azure', 'comprobar_conexion', 'azure'],
  ['GET', /^\/requerimientos\/[^/]+\/diagnostico$/, 'administracion', 'diagnosticar', 'requerimiento'],
  ['POST', /^\/requerimientos\/[^/]+\/reasignar-aplicacion$/, 'administracion', 'reasignar', 'requerimiento'],
  ['PUT', /^\/capacidades\/bulk$/, 'capacidades', 'guardar_lote', 'capacidad'],
  ['POST', /^\/personas\/deduplicar$/, 'personas', 'deduplicar', 'persona'],
  ['PUT', /^\/azdo\/esquema\/tipos-config$/, 'azure', 'guardar_tipos', 'azure'],
  ['POST', /^\/azdo\/esquema\/sync$/, 'azure', 'solicitar_sincronizacion', 'azure'],
  ['POST', /^\/estimaciones\/[^/]+\/crear-tareas-(hitss|epm)$/, 'estimaciones', 'solicitar_creacion_tareas', 'estimacion'],
  ['POST', /^\/usuarios$/, 'administracion', 'crear', 'usuario'],
  ['PUT', /^\/usuarios\/[^/]+$/, 'administracion', 'editar', 'usuario'],
  ['DELETE', /^\/usuarios\/[^/]+$/, 'administracion', 'eliminar', 'usuario'],
  ['PATCH', /^\/usuarios\/[^/]+\/password$/, 'administracion', 'restablecer_password', 'usuario'],
  ['POST', /^\/roles$/, 'administracion', 'crear', 'rol'],
  ['PUT', /^\/roles\/[^/]+$/, 'administracion', 'editar', 'rol'],
  ['DELETE', /^\/roles\/[^/]+$/, 'administracion', 'eliminar', 'rol'],
  ['POST', /^\/aplicaciones$/, 'administracion', 'crear', 'aplicacion'],
  ['PUT', /^\/aplicaciones\/[^/]+$/, 'administracion', 'editar', 'aplicacion'],
  ['PATCH', /^\/aplicaciones\/[^/]+\/estado$/, 'administracion', 'alternar_estado', 'aplicacion'],
  ['POST', /^\/requerimientos$/, 'requerimientos', 'crear', 'requerimiento'],
  ['PUT', /^\/requerimientos\/[^/]+$/, 'requerimientos', 'editar', 'requerimiento'],
  ['DELETE', /^\/requerimientos\/[^/]+$/, 'requerimientos', 'eliminar', 'requerimiento'],
  ['PATCH', /^\/requerimientos\/detalle-ans$/, 'requerimientos', 'editar_ans', 'requerimiento'],
  ['PATCH', /^\/requerimientos\/[^/]+\/(id-azure-hitss|analista)$/, 'requerimientos', 'editar_referencia', 'requerimiento'],
  ['POST', /^\/requerimientos\/[^/]+\/transicion$/, 'requerimientos', 'transicion', 'requerimiento'],
  ['POST', /^\/requerimientos\/[^/]+\/entregas$/, 'entregas', 'guardar', 'entrega'],
  ['DELETE', /^\/requerimientos\/[^/]+\/entregas\/[^/]+$/, 'entregas', 'eliminar', 'entrega'],
  ['DELETE', /^\/bitacora\/[^/]+$/, 'administracion', 'eliminar', 'bitacora'],
  ['PUT', /^\/control-horas\/(registro|todos)$/, 'horas', 'guardar', 'horas'],
  ['PUT', /^\/configuracion\/[^/]+$/, 'configuracion', 'guardar', 'configuracion'],
  ['DELETE', /^\/configuracion\/[^/]+$/, 'configuracion', 'eliminar', 'configuracion'],
  ['POST', /^\/festivos$/, 'configuracion', 'crear', 'festivo'],
  ['DELETE', /^\/festivos\/[^/]+$/, 'configuracion', 'eliminar', 'festivo'],
  ['POST', /^\/estimaciones\/upload\/[^/]+$/, 'estimaciones', 'cargar', 'estimacion'],
  ['PUT', /^\/azdo\/config$/, 'azure', 'guardar_configuracion', 'azure'],
  ['POST', /^\/soporte\/solicitudes-fabrica\/previsualizar$/, 'soporte', 'previsualizar', 'carga'],
  ['POST', /^\/soporte\/solicitudes-fabrica\/sincronizar$/, 'soporte', 'sincronizar', 'carga'],
  ['POST', /^\/soporte\/solicitudes-fabrica\/ejecutar-carga-automatica$/, 'soporte', 'solicitar_carga', 'carga'],
  ['PATCH', /^\/soporte\/solicitudes-fabrica\/[^/]+\/detalle-ans$/, 'soporte', 'editar_ans', 'solicitud'],
  ['POST', /^\/importacion\/excel\/previsualizar$/, 'importacion', 'previsualizar', 'excel'],
  ['POST', /^\/importacion\/excel$/, 'importacion', 'importar', 'excel'],
  ['POST', /^\/admin\/endpoints$/, 'administracion', 'crear', 'endpoint'],
  ['DELETE', /^\/admin\/endpoints\/[^/]+$/, 'administracion', 'eliminar', 'endpoint'],
  ['POST', /^\/membresias\/persona\/[^/]+$/, 'personas', 'abrir_membresia', 'membresia'],
  ['PATCH', /^\/membresias\/[^/]+\/cerrar$/, 'personas', 'cerrar_membresia', 'membresia'],
  ['PATCH', /^\/membresias\/[^/]+$/, 'personas', 'editar_membresia', 'membresia'],
  ['DELETE', /^\/membresias\/[^/]+$/, 'personas', 'eliminar_membresia', 'membresia'],
  ['PATCH', /^\/asignaciones\/[^/]+\/prioridad$/, 'asignaciones', 'alternar_prioridad', 'asignacion'],
]

const RECURSOS = [
  ['personas', 'personas', 'persona'],
  ['asignaciones', 'asignaciones', 'asignacion'],
  ['capacidades', 'capacidades', 'capacidad'],
  ['planes-accion', 'planes', 'plan'],
  ['backlog-futuro', 'backlog', 'iniciativa'],
  ['estimaciones', 'estimaciones', 'estimacion'],
  ['categorias', 'configuracion', 'categoria'],
  ['tarifas', 'configuracion', 'tarifa'],
  ['garantias-wo', 'soporte', 'garantia'],
] as const

export interface OperacionCatalogada {
  module: Modulo
  action_name: string
  resource_type: string
}

export function esOperacionCatalogada(operacion: OperacionCatalogada): boolean {
  if (Object.keys(operacion).some(clave => !['module', 'action_name', 'resource_type'].includes(clave))) return false
  return OPERACIONES.some(([, , modulo, accion, recurso]) =>
    operacion.module === modulo && operacion.action_name === accion && operacion.resource_type === recurso) ||
    RECURSOS.some(([, modulo, recurso]) => operacion.module === modulo && operacion.resource_type === recurso &&
      ['crear', 'editar', 'eliminar'].includes(operacion.action_name))
}

export function buscarOperacion(metodo: string, url: string): OperacionCatalogada | undefined {
  // Solo URLs relativas de nuestro cliente; nunca endpoints arbitrarios del probador admin.
  if (!url.startsWith('/') || url.startsWith('//')) return undefined
  const ruta = url.split(/[?#]/, 1)[0]
  const coincidencia = OPERACIONES.find(([verbo, patron]) => verbo === metodo.toUpperCase() && patron.test(ruta))
  if (coincidencia) {
    return { module: coincidencia[2], action_name: coincidencia[3], resource_type: coincidencia[4] }
  }
  for (const [base, modulo, recurso] of RECURSOS) {
    if (metodo.toUpperCase() === 'POST' && ruta === `/${base}`) {
      return { module: modulo, action_name: 'crear', resource_type: recurso }
    }
    if (new RegExp(`^/${base}/[^/]+$`).test(ruta) && ['PUT', 'DELETE'].includes(metodo.toUpperCase())) {
      return { module: modulo, action_name: metodo.toUpperCase() === 'PUT' ? 'editar' : 'eliminar', resource_type: recurso }
    }
  }
  return undefined
}
