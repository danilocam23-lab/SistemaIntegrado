import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import client from '../api/client'
import { mensajeError, useLista } from '../api/hooks'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import type { Aplicacion, Rol, Usuario } from '../types'

type Tab = 'usuarios' | 'roles'

const PERMISOS_INFO: Record<string, { modulo: string; nombre: string; descripcion: string }> = {
  'dashboard.ver': { modulo: 'Dashboard', nombre: 'Ver Dashboard General', descripcion: 'Permite consultar indicadores generales.' },
  'dashboard.estados.ver': { modulo: 'Dashboard', nombre: 'Ver Estados', descripcion: 'Permite consultar el dashboard de estados.' },
  'dashboard.squad.ver': { modulo: 'Dashboard', nombre: 'Ver Backlog', descripcion: 'Permite consultar backlog, capacidad y WO.' },
  'requerimientos.ver': { modulo: 'Requerimientos y entregas', nombre: 'Ver requerimientos', descripcion: 'Consulta requerimientos, entregas y detalle ANS.' },
  'requerimientos.detalle_ans.editar': { modulo: 'Requerimientos y entregas', nombre: 'Editar detalle ANS Req.', descripcion: 'Permite modificar Se levantó ANS y Observaciones en requerimientos/entregas.' },
  'requerimientos.crear': { modulo: 'Requerimientos y entregas', nombre: 'Crear requerimientos', descripcion: 'Permite registrar nuevos requerimientos.' },
  'requerimientos.editar': { modulo: 'Requerimientos y entregas', nombre: 'Editar requerimientos', descripcion: 'Permite actualizar requerimientos, entregas y estimaciones.' },
  'requerimientos.tipificacion.editar': { modulo: 'Requerimientos y entregas', nombre: 'Editar Seguimiento Hitss / Tipificación', descripcion: 'Permite editar Seguimiento Hitss y Tipificación del requerimiento, y Observaciones Hitss y Tipificación de la entrega, sin permiso completo de edición.' },
  'requerimientos.eliminar': { modulo: 'Requerimientos y entregas', nombre: 'Eliminar requerimientos', descripcion: 'Permite borrar requerimientos.' },
  'entregas_actas.ver': { modulo: 'Requerimientos y entregas', nombre: 'Ver entregas de actas', descripcion: 'Permite consultar entregas de actas.' },
  'personas.ver': { modulo: 'Carga de trabajo', nombre: 'Ver personas', descripcion: 'Consulta el equipo registrado.' },
  'personas.crear': { modulo: 'Carga de trabajo', nombre: 'Crear personas', descripcion: 'Permite registrar personas.' },
  'personas.editar': { modulo: 'Carga de trabajo', nombre: 'Editar personas', descripcion: 'Permite actualizar personas.' },
  'personas.eliminar': { modulo: 'Carga de trabajo', nombre: 'Eliminar personas', descripcion: 'Permite eliminar personas.' },
  'personas.ver_valores': { modulo: 'Carga de trabajo', nombre: 'Ver valores personas', descripcion: 'Ver y editar valor de persona y periféricos.' },
  'asignaciones.ver': { modulo: 'Carga de trabajo', nombre: 'Ver asignaciones', descripcion: 'Consulta asignaciones de trabajo.' },
  'asignaciones.editar': { modulo: 'Carga de trabajo', nombre: 'Editar asignaciones', descripcion: 'Permite crear o modificar asignaciones.' },
  'capacidades.ver': { modulo: 'Carga de trabajo', nombre: 'Ver capacidades', descripcion: 'Consulta capacidad disponible.' },
  'capacidades.editar': { modulo: 'Carga de trabajo', nombre: 'Editar capacidades', descripcion: 'Permite actualizar capacidades.' },
  'control_horas_facturable.ver': { modulo: 'Carga de trabajo', nombre: 'Ver Control de Horas Facturable', descripcion: 'Permite abrir la vista de Control de Horas Facturable.' },
  'roadmap.ver': { modulo: 'Carga de trabajo', nombre: 'Ver roadmap y equipo', descripcion: 'Consulta roadmap y equipo.' },
  'azure_devops.ver': { modulo: 'Azure DevOps', nombre: 'Ver Azure DevOps', descripcion: 'Permite abrir la integración Azure DevOps.' },
  'azure_devops.editar': { modulo: 'Azure DevOps', nombre: 'Configurar Azure DevOps', descripcion: 'Permite editar conexión, probar y sincronizar.' },
  'estimaciones.ver': { modulo: 'Estimaciones', nombre: 'Ver estimaciones', descripcion: 'Permite consultar estimaciones.' },
  'facturacion.ver': { modulo: 'Facturación', nombre: 'Ver facturación', descripcion: 'Permite consultar General y Valores de proyecto.' },
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

function permisoInfo(permiso: string) {
  return PERMISOS_INFO[permiso] ?? { modulo: 'Otros', nombre: permiso, descripcion: 'Permiso técnico sin descripción configurada.' }
}

export default function Usuarios() {
  const { usuario: yo, tienePermiso } = useAuth()
  const esSuperadmin = yo?.rol === 'superadmin'
  const [tab, setTab] = useState<Tab>('usuarios')
  const { datos, error, recargar } = useLista<Usuario>('/usuarios')
  const { datos: apps } = useLista<Aplicacion>('/aplicaciones')
  const { datos: roles, error: errorRoles, recargar: recargarRoles } = useLista<Rol>('/roles')
  const { datos: catalogoPermisos } = useLista<string>('/roles/catalogo')
  const adminSinSquads = yo?.rol === 'admin_app' && (yo.aplicaciones_codigos?.length ?? 0) === 0

  const puedeCrearUsuarios = tienePermiso('admin.usuarios.crear')
  const puedeEditarUsuarios = tienePermiso('admin.usuarios.editar')
  const puedeVerRoles = tienePermiso('admin.roles.ver')
  const puedeCrearRoles = tienePermiso('admin.roles.crear')
  const puedeEditarRoles = tienePermiso('admin.roles.editar')
  const puedeEliminarRoles = tienePermiso('admin.roles.eliminar')

  const appsDisponibles = useMemo(() => {
    if (esSuperadmin || adminSinSquads) return apps
    return apps.filter((a) => yo?.aplicaciones_codigos.includes(a.codigo))
  }, [apps, yo, esSuperadmin, adminSinSquads])

  const appsActivasDisponibles = useMemo(
    () => appsDisponibles.filter((a) => a.activa),
    [appsDisponibles],
  )

  const usuariosFiltrados = useMemo(() => {
    if (esSuperadmin || adminSinSquads) return datos
    const misCodigos = new Set(yo?.aplicaciones_codigos ?? [])
    return datos.filter((u) => u.aplicaciones_codigos.some((c) => misCodigos.has(c)))
  }, [datos, yo, esSuperadmin, adminSinSquads])

  const rolesDisponibles = useMemo(() => {
    const activos = roles.filter((r) => r.activo)
    if (esSuperadmin) return activos
    return activos.filter((r) => r.clave !== 'superadmin' && r.clave !== 'admin_app')
  }, [roles, esSuperadmin])

  const catalogoPermisosOrdenado = useMemo(() => {
    return [...catalogoPermisos].sort((a, b) => {
      const infoA = permisoInfo(a)
      const infoB = permisoInfo(b)
      return infoA.modulo.localeCompare(infoB.modulo, 'es') || infoA.nombre.localeCompare(infoB.nombre, 'es')
    })
  }, [catalogoPermisos])

  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rolId, setRolId] = useState('')
  const [aplicacionesNuevo, setAplicacionesNuevo] = useState<string[]>([])
  const [aviso, setAviso] = useState('')

  const [editando, setEditando] = useState<Usuario | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editRolId, setEditRolId] = useState('')
  const [editApps, setEditApps] = useState<string[]>([])
  const [editAviso, setEditAviso] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)

  const [nuevoRolClave, setNuevoRolClave] = useState('')
  const [nuevoRolNombre, setNuevoRolNombre] = useState('')
  const [nuevoRolDescripcion, setNuevoRolDescripcion] = useState('')
  const [nuevoRolPermisos, setNuevoRolPermisos] = useState<string[]>([])
  const [rolEditando, setRolEditando] = useState<Rol | null>(null)
  const [avisoRoles, setAvisoRoles] = useState('')

  function abrirEditar(u: Usuario): void {
    setEditando(u)
    setEditNombre(u.nombre)
    setEditEmail(u.email)
    setEditRolId(u.rol_id ?? '')
    setEditApps([...u.aplicaciones_codigos])
    setEditAviso('')
    setModalAbierto(true)
  }

  function cerrarModal(): void {
    setModalAbierto(false)
    setEditando(null)
    setEditAviso('')
  }

  async function guardarEdicion(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (!editando) return
    setEditAviso('')
    try {
      await client.put(`/usuarios/${editando.id}`, {
        nombre: editNombre,
        email: editEmail,
        rol_id: editRolId || null,
        aplicaciones_codigos: editApps,
      })
      cerrarModal()
      recargar()
    } catch (err) {
      setEditAviso(mensajeError(err))
    }
  }

  async function crear(e: FormEvent): Promise<void> {
    e.preventDefault()
    setAviso('')
    try {
      await client.post('/usuarios', {
        nombre,
        email,
        password,
        rol_id: rolId || null,
        aplicaciones_codigos: aplicacionesNuevo,
      })
      setNombre('')
      setEmail('')
      setPassword('')
      setRolId('')
      setAplicacionesNuevo([])
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  async function cambiarRol(u: Usuario, nuevoRolId: string): Promise<void> {
    if (!puedeEditarUsuarios) return
    setAviso('')
    try {
      await client.put(`/usuarios/${u.id}`, { rol_id: nuevoRolId })
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  async function alternarActivo(u: Usuario): Promise<void> {
    if (!puedeEditarUsuarios) return
    await client.put(`/usuarios/${u.id}`, { activo: !u.activo })
    recargar()
  }

  async function eliminarAcceso(u: Usuario): Promise<void> {
    if (!puedeEditarUsuarios || u.id === yo?.id) return
    if (!window.confirm(`¿Eliminar definitivamente el acceso de ${u.email}? Esta acción borrará el registro del usuario.`)) return
    setAviso('')
    try {
      await client.delete(`/usuarios/${u.id}`)
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  async function resetPassword(u: Usuario): Promise<void> {
    if (!puedeEditarUsuarios) return
    const nueva = window.prompt(`Nueva contraseña para ${u.email}:`)
    if (!nueva) return
    await client.patch(`/usuarios/${u.id}/password`, { password: nueva })
    window.alert('Contraseña actualizada.')
  }

  function toggleNuevoPermiso(permiso: string): void {
    setNuevoRolPermisos((prev) => (
      prev.includes(permiso) ? prev.filter((p) => p !== permiso) : [...prev, permiso]
    ))
  }

  function alternarSquadNuevo(codigo: string): void {
    setAplicacionesNuevo((prev) => (
      prev.includes(codigo) ? prev.filter((c) => c !== codigo) : [...prev, codigo]
    ))
  }

  function alternarSquadEdicion(codigo: string): void {
    setEditApps((prev) => (
      prev.includes(codigo) ? prev.filter((c) => c !== codigo) : [...prev, codigo]
    ))
  }

  function nombresSquadsUsuario(u: Usuario): string {
    if (u.rol === 'superadmin') return '★ Todos'
    const codigosActivos = appsActivasDisponibles.map((a) => a.codigo)
    const tieneTodos = codigosActivos.length > 0 && codigosActivos.every((codigo) => u.aplicaciones_codigos.includes(codigo))
    if (tieneTodos) return '★ Todos'
    return u.aplicaciones_codigos.map((c) => apps.find((a) => a.codigo === c)?.nombre ?? c).join(', ') || '—'
  }

  async function crearRol(e: FormEvent): Promise<void> {
    e.preventDefault()
    setAvisoRoles('')
    try {
      await client.post('/roles', {
        clave: nuevoRolClave,
        nombre: nuevoRolNombre,
        descripcion: nuevoRolDescripcion,
        permisos: nuevoRolPermisos,
      })
      setNuevoRolClave('')
      setNuevoRolNombre('')
      setNuevoRolDescripcion('')
      setNuevoRolPermisos([])
      recargarRoles()
      recargar()
    } catch (err) {
      setAvisoRoles(mensajeError(err))
    }
  }

  async function guardarRol(): Promise<void> {
    if (!rolEditando) return
    setAvisoRoles('')
    try {
      await client.put(`/roles/${rolEditando.id}`, {
        nombre: rolEditando.nombre,
        descripcion: rolEditando.descripcion,
        activo: rolEditando.activo,
        permisos: rolEditando.permisos,
      })
      setRolEditando(null)
      recargarRoles()
      recargar()
    } catch (err) {
      setAvisoRoles(mensajeError(err))
    }
  }

  async function eliminarRol(rol: Rol): Promise<void> {
    if (!puedeEliminarRoles || rol.es_sistema) return
    if (!window.confirm(`¿Eliminar rol "${rol.nombre}"?`)) return
    setAvisoRoles('')
    try {
      await client.delete(`/roles/${rol.id}`)
      recargarRoles()
      recargar()
    } catch (err) {
      setAvisoRoles(mensajeError(err))
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-marca-osc">Usuarios</h1>

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setTab('usuarios')}
          className={`rounded px-3 py-1.5 text-sm ${tab === 'usuarios' ? 'bg-marca text-white' : 'border bg-white text-slate-700'}`}
        >
          Usuarios
        </button>
        {puedeVerRoles && (
          <button
            onClick={() => setTab('roles')}
            className={`rounded px-3 py-1.5 text-sm ${tab === 'roles' ? 'bg-marca text-white' : 'border bg-white text-slate-700'}`}
          >
            Roles y permisos
          </button>
        )}
      </div>

      {tab === 'usuarios' && (
        <>
          {puedeCrearUsuarios && (
            <form onSubmit={crear} className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">Nombre</span>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} required
                  className="rounded border px-3 py-2" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">Correo</span>
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required
                  className="rounded border px-3 py-2" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">Contraseña</span>
                <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required
                  className="rounded border px-3 py-2" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">Rol</span>
                <select value={rolId} onChange={(e) => setRolId(e.target.value)} className="rounded border px-3 py-2">
                  <option value="">Seleccione</option>
                  {rolesDisponibles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
              </label>
              <div className="min-w-64 text-sm">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="block text-slate-600">Squads</span>
                  <div className="flex gap-2 text-[11px] font-semibold">
                    <button type="button" className="text-marca hover:underline" onClick={() => setAplicacionesNuevo(appsActivasDisponibles.map((a) => a.codigo))}>
                      Todos
                    </button>
                    <button type="button" className="text-slate-400 hover:underline" onClick={() => setAplicacionesNuevo([])}>
                      Limpiar
                    </button>
                  </div>
                </div>
                <div className="max-h-28 overflow-y-auto rounded border px-3 py-2">
                  <label className="mb-1 flex cursor-pointer items-center gap-2 rounded px-1 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={appsActivasDisponibles.length > 0 && appsActivasDisponibles.every((a) => aplicacionesNuevo.includes(a.codigo))}
                      onChange={(e) => setAplicacionesNuevo(e.target.checked ? appsActivasDisponibles.map((a) => a.codigo) : [])}
                    />
                    ★ Todos los squads
                  </label>
                  {appsActivasDisponibles.map((a) => (
                    <label key={a.codigo} className="flex cursor-pointer items-center gap-2 rounded px-1 text-sm hover:bg-slate-50">
                      <input type="checkbox" checked={aplicacionesNuevo.includes(a.codigo)} onChange={() => alternarSquadNuevo(a.codigo)} />
                      <span>{a.nombre}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button className="rounded bg-marca px-4 py-2 text-white hover:bg-marca-osc">Crear</button>
            </form>
          )}

          {(aviso || error) && (
            <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{aviso || error}</div>
          )}

          <table className="w-full overflow-hidden rounded-xl border bg-white text-sm">
            <thead className="bg-marca-osc text-white">
              <tr>
                <th className="p-2 text-left">Nombre</th>
                <th className="p-2 text-left">Correo</th>
                <th className="p-2 text-left">Rol</th>
                <th className="p-2 text-left">Squads</th>
                <th className="p-2 text-center">Activo</th>
                <th className="p-2 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuariosFiltrados.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="p-2">{u.nombre}</td>
                  <td className="p-2">{u.email}</td>
                  <td className="p-2">
                    <select
                      value={u.rol_id ?? ''}
                      onChange={(e) => cambiarRol(u, e.target.value)}
                      disabled={!puedeEditarUsuarios}
                      className="rounded border px-2 py-1 text-xs"
                    >
                      {rolesDisponibles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                    </select>
                  </td>
                  <td className="p-2">{nombresSquadsUsuario(u)}</td>
                  <td className="p-2 text-center">{u.activo ? 'Sí' : 'No'}</td>
                  <td className="p-2 text-center whitespace-nowrap">
                    <button onClick={() => abrirEditar(u)} disabled={!puedeEditarUsuarios} className="mr-2 text-marca hover:underline text-xs disabled:text-slate-300">
                      Editar
                    </button>
                    <button onClick={() => alternarActivo(u)} disabled={!puedeEditarUsuarios} className={`mr-2 text-xs ${u.activo ? 'text-amber-600 hover:underline' : 'text-emerald-600 hover:underline'} disabled:text-slate-300`}>
                      {u.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    <button onClick={() => resetPassword(u)} disabled={!puedeEditarUsuarios} className="mr-2 text-xs text-marca hover:underline disabled:text-slate-300">
                      Resetear clave
                    </button>
                    <button
                      onClick={() => eliminarAcceso(u)}
                      disabled={!puedeEditarUsuarios || u.id === yo?.id}
                      className="text-xs text-red-600 hover:underline disabled:text-slate-300"
                      title={u.id === yo?.id ? 'No puedes eliminar tu propio acceso' : 'Elimina definitivamente el registro del usuario'}
                    >
                      Eliminar acceso
                    </button>
                  </td>
                </tr>
              ))}
              {datos.length === 0 && (
                <tr><td colSpan={6} className="p-4 text-center text-slate-400">Sin usuarios.</td></tr>
              )}
            </tbody>
          </table>
        </>
      )}

      {tab === 'roles' && puedeVerRoles && (
        <div className="space-y-4">
          {(avisoRoles || errorRoles) && (
            <div className="rounded bg-red-50 p-2 text-sm text-red-700">{avisoRoles || errorRoles}</div>
          )}

          {puedeCrearRoles && (
            <form onSubmit={crearRol} className="rounded-xl border bg-white p-4 space-y-3">
              <h2 className="text-sm font-semibold text-slate-700">Crear rol</h2>
              <div className="flex flex-wrap gap-3">
                <input className="rounded border px-3 py-2 text-sm" placeholder="Clave (ej: auditor)" value={nuevoRolClave} onChange={(e) => setNuevoRolClave(e.target.value)} required />
                <input className="rounded border px-3 py-2 text-sm" placeholder="Nombre" value={nuevoRolNombre} onChange={(e) => setNuevoRolNombre(e.target.value)} required />
                <input className="rounded border px-3 py-2 text-sm min-w-72" placeholder="Descripción" value={nuevoRolDescripcion} onChange={(e) => setNuevoRolDescripcion(e.target.value)} />
              </div>
              <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto rounded border p-2 md:grid-cols-2">
                {catalogoPermisosOrdenado.map((permiso) => {
                  const info = permisoInfo(permiso)
                  return (
                    <label key={permiso} className="flex cursor-pointer items-start gap-2 rounded border border-slate-100 p-2 text-xs hover:bg-slate-50">
                      <input type="checkbox" checked={nuevoRolPermisos.includes(permiso)} onChange={() => toggleNuevoPermiso(permiso)} className="mt-1" />
                      <span>
                        <span className="block font-semibold text-slate-800">{info.nombre}</span>
                        <span className="block text-[11px] text-slate-500">{info.modulo} · {info.descripcion}</span>
                        <span className="block font-mono text-[10px] text-slate-400">{permiso}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
              <button className="rounded bg-marca px-4 py-2 text-sm text-white hover:bg-marca-osc">Crear rol</button>
            </form>
          )}

          <table className="w-full overflow-hidden rounded-xl border bg-white text-sm">
            <thead className="bg-marca-osc text-white">
              <tr>
                <th className="p-2 text-left">Rol</th>
                <th className="p-2 text-left">Clave</th>
                <th className="p-2 text-left">Permisos</th>
                <th className="p-2 text-center">Activo</th>
                <th className="p-2 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((rol) => (
                <tr key={rol.id} className="border-t">
                  <td className="p-2">{rol.nombre}</td>
                  <td className="p-2 font-mono">{rol.clave}</td>
                  <td className="p-2">{rol.permisos.length}</td>
                  <td className="p-2 text-center">{rol.activo ? 'Sí' : 'No'}</td>
                  <td className="p-2 text-center whitespace-nowrap">
                    <button
                      onClick={() => setRolEditando({ ...rol })}
                      disabled={!puedeEditarRoles}
                      className="mr-2 text-xs text-marca hover:underline disabled:text-slate-300"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => eliminarRol(rol)}
                      disabled={!puedeEliminarRoles || rol.es_sistema}
                      className="text-xs text-red-600 hover:underline disabled:text-slate-300"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {roles.length === 0 && (
                <tr><td colSpan={5} className="p-4 text-center text-slate-400">Sin roles.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        titulo={editando ? `Editar: ${editando.nombre}` : 'Editar usuario'}
        abierto={modalAbierto}
        onCerrar={cerrarModal}
      >
        <form onSubmit={guardarEdicion} className="space-y-3">
          {editAviso && <div className="rounded bg-red-50 p-2 text-sm text-red-700">{editAviso}</div>}
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Nombre</span>
            <input value={editNombre} onChange={(e) => setEditNombre(e.target.value)} required
              className="w-full rounded border px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Correo</span>
            <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} type="email" required
              className="w-full rounded border px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Rol</span>
            <select value={editRolId} onChange={(e) => setEditRolId(e.target.value)}
              className="w-full rounded border px-3 py-2">
              {rolesDisponibles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </label>
          <div className="block text-sm">
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="block text-slate-600">Squads</span>
              <div className="flex gap-2 text-[11px] font-semibold">
                <button type="button" className="text-marca hover:underline" onClick={() => setEditApps(appsActivasDisponibles.map((a) => a.codigo))}>
                  Todos
                </button>
                <button type="button" className="text-slate-400 hover:underline" onClick={() => setEditApps([])}>
                  Limpiar
                </button>
              </div>
            </div>
            <div className="max-h-40 overflow-y-auto rounded border px-3 py-2 space-y-1">
              <label className="flex cursor-pointer items-center gap-2 rounded px-1 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={appsActivasDisponibles.length > 0 && appsActivasDisponibles.every((a) => editApps.includes(a.codigo))}
                  onChange={(e) => setEditApps(e.target.checked ? appsActivasDisponibles.map((a) => a.codigo) : [])}
                  className="rounded"
                />
                <span>★ Todos los squads</span>
              </label>
              {appsActivasDisponibles.map((a) => (
                <label key={a.codigo} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 rounded px-1">
                  <input
                    type="checkbox"
                    checked={editApps.includes(a.codigo)}
                    onChange={() => alternarSquadEdicion(a.codigo)}
                    className="rounded"
                  />
                  <span>{a.nombre}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={cerrarModal}
              className="rounded border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
              Cancelar
            </button>
            <button className="rounded bg-marca px-4 py-2 text-sm text-white hover:bg-marca-osc">
              Guardar cambios
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        titulo={rolEditando ? `Editar rol: ${rolEditando.nombre}` : 'Editar rol'}
        abierto={!!rolEditando}
        onCerrar={() => setRolEditando(null)}
      >
        {rolEditando && (
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Nombre</span>
              <input
                value={rolEditando.nombre}
                onChange={(e) => setRolEditando({ ...rolEditando, nombre: e.target.value })}
                className="w-full rounded border px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Descripción</span>
              <input
                value={rolEditando.descripcion}
                onChange={(e) => setRolEditando({ ...rolEditando, descripcion: e.target.value })}
                className="w-full rounded border px-3 py-2"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={rolEditando.activo}
                onChange={(e) => setRolEditando({ ...rolEditando, activo: e.target.checked })}
              />
              <span>Activo</span>
            </label>
            <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto rounded border p-2">
              {catalogoPermisosOrdenado.map((permiso) => {
                const info = permisoInfo(permiso)
                return (
                  <label key={permiso} className="flex cursor-pointer items-start gap-2 rounded border border-slate-100 p-2 text-xs hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={rolEditando.permisos.includes(permiso)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setRolEditando({ ...rolEditando, permisos: [...rolEditando.permisos, permiso] })
                        } else {
                          setRolEditando({ ...rolEditando, permisos: rolEditando.permisos.filter((p) => p !== permiso) })
                        }
                      }}
                      className="mt-1"
                    />
                    <span>
                      <span className="block font-semibold text-slate-800">{info.nombre}</span>
                      <span className="block text-[11px] text-slate-500">{info.modulo} · {info.descripcion}</span>
                      <span className="block font-mono text-[10px] text-slate-400">{permiso}</span>
                    </span>
                  </label>
                )
              })}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded border px-4 py-2 text-sm"
                onClick={() => setRolEditando(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded bg-marca px-4 py-2 text-sm text-white"
                onClick={guardarRol}
              >
                Guardar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
