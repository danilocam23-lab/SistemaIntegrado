import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import client from '../api/client'
import { mensajeError, useLista } from '../api/hooks'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import type { Aplicacion, Rol, Usuario } from '../types'

type Tab = 'usuarios' | 'roles'

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

  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rolId, setRolId] = useState('')
  const [aplicacion, setAplicacion] = useState('')
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
        aplicaciones_codigos: aplicacion ? [aplicacion] : [],
      })
      setNombre('')
      setEmail('')
      setPassword('')
      setRolId('')
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
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">Squad</span>
                <select value={aplicacion} onChange={(e) => setAplicacion(e.target.value)}
                  className="rounded border px-3 py-2">
                  <option value="">— Ninguna —</option>
                  {appsDisponibles.map((a) => <option key={a.codigo} value={a.codigo}>{a.nombre}</option>)}
                </select>
              </label>
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
                  <td className="p-2">{u.rol === 'superadmin' ? '★ Todos' : (u.aplicaciones_codigos.map((c) => apps.find((a) => a.codigo === c)?.nombre ?? c).join(', ') || '—')}</td>
                  <td className="p-2 text-center">{u.activo ? 'Sí' : 'No'}</td>
                  <td className="p-2 text-center whitespace-nowrap">
                    <button onClick={() => abrirEditar(u)} disabled={!puedeEditarUsuarios} className="mr-2 text-marca hover:underline text-xs disabled:text-slate-300">
                      Editar
                    </button>
                    <button onClick={() => alternarActivo(u)} disabled={!puedeEditarUsuarios} className={`mr-2 text-xs ${u.activo ? 'text-amber-600 hover:underline' : 'text-emerald-600 hover:underline'} disabled:text-slate-300`}>
                      {u.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    <button onClick={() => resetPassword(u)} disabled={!puedeEditarUsuarios} className="text-xs text-marca hover:underline disabled:text-slate-300">
                      Resetear clave
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
              <div className="max-h-44 overflow-y-auto rounded border p-2 grid grid-cols-2 gap-1">
                {catalogoPermisos.map((permiso) => (
                  <label key={permiso} className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={nuevoRolPermisos.includes(permiso)} onChange={() => toggleNuevoPermiso(permiso)} />
                    <span>{permiso}</span>
                  </label>
                ))}
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
            <span className="mb-1 block text-slate-600">Squads</span>
            <div className="max-h-40 overflow-y-auto rounded border px-3 py-2 space-y-1">
              {appsDisponibles.filter((a) => a.activa).map((a) => (
                <label key={a.codigo} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 rounded px-1">
                  <input
                    type="checkbox"
                    checked={editApps.includes(a.codigo)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setEditApps((prev) => [...prev, a.codigo])
                      } else {
                        setEditApps((prev) => prev.filter((c) => c !== a.codigo))
                      }
                    }}
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
            <div className="max-h-52 overflow-y-auto rounded border p-2 grid grid-cols-1 gap-1">
              {catalogoPermisos.map((permiso) => (
                <label key={permiso} className="flex items-center gap-2 text-xs">
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
                  />
                  <span>{permiso}</span>
                </label>
              ))}
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
