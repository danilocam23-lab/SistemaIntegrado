/* Utilidades compartidas por la pantalla de Usuarios (lista de usuarios y
   maestro-detalle de roles y permisos). No llaman a la API: son helpers
   puros de presentación/agrupación sobre datos que ya trae Usuarios.tsx. */

export const PERMISOS_INFO: Record<string, { modulo: string; nombre: string; descripcion: string }> = {
  'dashboard.ver': { modulo: 'Dashboard', nombre: 'Ver Dashboard General', descripcion: 'Permite consultar indicadores generales.' },
  'dashboard.estados.ver': { modulo: 'Dashboard', nombre: 'Ver Estados', descripcion: 'Permite consultar el dashboard de estados.' },
  'dashboard.squad.ver': { modulo: 'Dashboard', nombre: 'Ver Backlog', descripcion: 'Permite consultar backlog, capacidad y WO.' },
  'requerimientos.ver': { modulo: 'Desarrollos de fábrica', nombre: 'Ver requerimientos', descripcion: 'Consulta requerimientos, entregas y detalle ANS.' },
  'requerimientos.detalle_ans.editar': { modulo: 'Desarrollos de fábrica', nombre: 'Editar detalle ANS Req.', descripcion: 'Permite modificar Se levantó ANS y Observaciones en requerimientos/entregas.' },
  'requerimientos.crear': { modulo: 'Desarrollos de fábrica', nombre: 'Crear requerimientos', descripcion: 'Permite registrar nuevos requerimientos.' },
  'requerimientos.editar': { modulo: 'Desarrollos de fábrica', nombre: 'Editar requerimientos', descripcion: 'Permite actualizar requerimientos, entregas y estimaciones.' },
  'requerimientos.tipificacion.editar': { modulo: 'Desarrollos de fábrica', nombre: 'Editar Seguimiento Hitss / Tipificación', descripcion: 'Permite editar Seguimiento Hitss y Tipificación del requerimiento, y Observaciones Hitss y Tipificación de la entrega, sin permiso completo de edición.' },
  'requerimientos.eliminar': { modulo: 'Desarrollos de fábrica', nombre: 'Eliminar requerimientos', descripcion: 'Permite borrar requerimientos.' },
  'entregas_actas.ver': { modulo: 'Desarrollos de fábrica', nombre: 'Ver entregas de actas', descripcion: 'Permite consultar entregas de actas.' },
  'entregas_actas.exportar': { modulo: 'Desarrollos de fábrica', nombre: 'Exportar entregas de actas', descripcion: 'Permite exportar a Excel el listado de entregas de actas con los filtros aplicados.' },
  'requerimientos.exportar': { modulo: 'Desarrollos de fábrica', nombre: 'Exportar requerimientos', descripcion: 'Permite exportar a Excel el listado de requerimientos con los filtros aplicados.' },
  'predictivos.ver': { modulo: 'Desarrollos de fábrica', nombre: 'Ver predictivos', descripcion: 'Permite consultar la vista de Predictivos.' },
  'backlog_futuro.ver': { modulo: 'Desarrollos de fábrica', nombre: 'Ver backlog futuro', descripcion: 'Permite consultar la vista de Backlog futuro (ítems planificados a futuro por squad).' },
  'backlog_futuro.editar': { modulo: 'Desarrollos de fábrica', nombre: 'Editar backlog futuro', descripcion: 'Permite crear, editar y eliminar registros del Backlog futuro.' },
  'personas.ver': { modulo: 'Carga de trabajo', nombre: 'Ver personas', descripcion: 'Consulta el equipo registrado.' },
  'personas.crear': { modulo: 'Carga de trabajo', nombre: 'Crear personas', descripcion: 'Permite registrar personas.' },
  'personas.editar': { modulo: 'Carga de trabajo', nombre: 'Editar personas', descripcion: 'Permite actualizar personas.' },
  'personas.eliminar': { modulo: 'Carga de trabajo', nombre: 'Eliminar personas', descripcion: 'Permite eliminar personas.' },
  'personas.ver_valores': { modulo: 'Carga de trabajo', nombre: 'Ver valores personas', descripcion: 'Ver y editar valor de persona y periféricos.' },
  'asignaciones.ver': { modulo: 'Carga de trabajo', nombre: 'Ver asignaciones', descripcion: 'Consulta asignaciones de trabajo.' },
  'asignaciones.editar': { modulo: 'Carga de trabajo', nombre: 'Editar asignaciones', descripcion: 'Permite crear o modificar asignaciones.' },
  'squads.editar': { modulo: 'Carga de trabajo', nombre: 'Editar squads de trabajo', descripcion: 'Permite crear, actualizar y eliminar los squads de personas usados en asignaciones, capacidades y control de horas.' },
  'capacidades.ver': { modulo: 'Carga de trabajo', nombre: 'Ver capacidades', descripcion: 'Consulta capacidad disponible.' },
  'capacidades.editar': { modulo: 'Carga de trabajo', nombre: 'Editar capacidades', descripcion: 'Permite actualizar capacidades.' },
  'planes_accion.ver': { modulo: 'Carga de trabajo', nombre: 'Ver planes de acción', descripcion: 'Permite consultar los planes de acción.' },
  'planes_accion.editar': { modulo: 'Carga de trabajo', nombre: 'Editar planes de acción', descripcion: 'Permite crear, editar y eliminar planes de acción.' },
  'control_horas_facturable.ver': { modulo: 'Carga de trabajo', nombre: 'Ver Control de Horas Facturable', descripcion: 'Permite abrir la vista de Control de Horas Facturable.' },
  'control_horas_facturable.editar': { modulo: 'Carga de trabajo', nombre: 'Editar Control de Horas Facturable', descripcion: 'Permite guardar registros de horas facturables por persona.' },
  'roadmap.ver': { modulo: 'Carga de trabajo', nombre: 'Ver roadmap y equipo', descripcion: 'Consulta roadmap y equipo.' },
  'azure_devops.ver': { modulo: 'Azure DevOps', nombre: 'Ver Azure DevOps', descripcion: 'Permite abrir la integración Azure DevOps.' },
  'azure_devops.editar': { modulo: 'Azure DevOps', nombre: 'Configurar Azure DevOps', descripcion: 'Permite editar conexión, probar y sincronizar.' },
  'estimaciones.ver': { modulo: 'Estimaciones', nombre: 'Ver estimaciones', descripcion: 'Permite consultar estimaciones.' },
  'facturacion.ver': { modulo: 'Facturación', nombre: 'Ver facturación', descripcion: 'Permite consultar General y Valores de proyecto.' },
  'facturacion.ans_descontados.ver': { modulo: 'Facturación', nombre: 'Ver ANS descontados', descripcion: 'Permite consultar la vista de ANS descontados en Facturación.' },
  'aplicaciones.ver': { modulo: 'Administración', nombre: 'Ver squads', descripcion: 'Consulta la administración de squads.' },
  'aplicaciones.crear': { modulo: 'Administración', nombre: 'Crear squads', descripcion: 'Permite crear squads.' },
  'aplicaciones.editar': { modulo: 'Administración', nombre: 'Editar squads', descripcion: 'Permite actualizar squads.' },
  'admin.usuarios.ver': { modulo: 'Administración', nombre: 'Ver usuarios', descripcion: 'Consulta usuarios y roles.' },
  'admin.usuarios.crear': { modulo: 'Administración', nombre: 'Crear usuarios', descripcion: 'Permite crear usuarios.' },
  'admin.usuarios.editar': { modulo: 'Administración', nombre: 'Editar usuarios', descripcion: 'Permite actualizar usuarios.' },
  'admin.roles.ver': { modulo: 'Administración', nombre: 'Ver roles y permisos', descripcion: 'Consulta roles y catálogo de permisos.' },
  'admin.roles.crear': { modulo: 'Administración', nombre: 'Crear roles', descripcion: 'Permite crear roles personalizados.' },
  'admin.roles.editar': { modulo: 'Administración', nombre: 'Editar roles', descripcion: 'Permite modificar permisos de roles.' },
  'admin.roles.eliminar': { modulo: 'Administración', nombre: 'Eliminar roles', descripcion: 'Permite eliminar roles personalizados.' },
  'admin.importacion.ver': { modulo: 'Administración', nombre: 'Ver importación/exportación', descripcion: 'Permite abrir importación y exportación.' },
  'admin.importacion.ejecutar': { modulo: 'Administración', nombre: 'Ejecutar importaciones', descripcion: 'Permite importar datos.' },
  'admin.endpoints.ver': { modulo: 'Administración', nombre: 'Ver endpoints', descripcion: 'Consulta el catálogo técnico de endpoints.' },
  'admin.configuracion.ver': { modulo: 'Administración', nombre: 'Ver configuración', descripcion: 'Consulta configuración general.' },
  'admin.configuracion.editar': { modulo: 'Administración', nombre: 'Editar configuración', descripcion: 'Permite modificar configuración general.' },
  'soporte.solicitudes_fabrica.ver': { modulo: 'Soporte', nombre: 'Ver soporte', descripcion: 'Consulta solicitudes fábrica y detalle ANS.' },
  'soporte.solicitudes_fabrica.actualizar': { modulo: 'Soporte', nombre: 'Sincronizar soporte', descripcion: 'Permite cargar y sincronizar solicitudes fábrica.' },
  'soporte.detalle_ans.editar': { modulo: 'Soporte', nombre: 'Editar detalle ANS', descripcion: 'Permite modificar Se levantó ANS y Observaciones.' },
  'admin.acceso': { modulo: 'Administración', nombre: 'Acceso administrativo', descripcion: 'Habilita funciones administrativas avanzadas.' },
  'consolidado.ver': { modulo: 'Consolidado', nombre: 'Ver todos los squads', descripcion: 'Permite usar el selector Todos los squads.' },
}

export function permisoInfo(permiso: string) {
  return PERMISOS_INFO[permiso] ?? { modulo: 'Otros', nombre: permiso, descripcion: 'Permiso técnico sin descripción configurada.' }
}

export interface GrupoPermisos {
  modulo: string
  permisos: string[]
}

/** Agrupa un catálogo de permisos ya ordenado por módulo en secciones
 *  consecutivas (una por módulo), para el maestro-detalle de roles. */
export function agruparPermisosPorModulo(catalogoOrdenado: string[]): GrupoPermisos[] {
  const grupos: GrupoPermisos[] = []
  for (const permiso of catalogoOrdenado) {
    const { modulo } = permisoInfo(permiso)
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.modulo === modulo) {
      ultimo.permisos.push(permiso)
    } else {
      grupos.push({ modulo, permisos: [permiso] })
    }
  }
  return grupos
}

/** Agrega o quita en bloque los permisos de un módulo sobre una lista de
 *  permisos seleccionados, para el checkbox "seleccionar todos" de cada
 *  sección del catálogo. */
export function permisosConModulo(actuales: string[], permisosModulo: string[], marcar: boolean): string[] {
  if (marcar) return Array.from(new Set([...actuales, ...permisosModulo]))
  const excluir = new Set(permisosModulo)
  return actuales.filter((p) => !excluir.has(p))
}

const PALETA_AVATAR = [
  'bg-marca-100 text-marca-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
  'bg-fuchsia-100 text-fuchsia-700',
]

export function inicialesDe(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

/** Color determinístico (mismo usuario siempre el mismo color) tomado de
 *  una paleta fija de clases literales — nunca se compone la clase por
 *  interpolación, por eso no hace falta tocar el safelist de Tailwind. */
export function colorAvatar(clave: string): string {
  let hash = 0
  for (let i = 0; i < clave.length; i++) hash = (hash * 31 + clave.charCodeAt(i)) >>> 0
  return PALETA_AVATAR[hash % PALETA_AVATAR.length]
}

/** Convierte el texto ya calculado por `nombresSquadsUsuario()` (en
 *  Usuarios.tsx) en la lista de etiquetas a mostrar como chips. */
export function squadsChipsUsuario(texto: string): string[] {
  if (texto === '—') return []
  if (texto === '★ Todos') return [texto]
  return texto.split(', ')
}
