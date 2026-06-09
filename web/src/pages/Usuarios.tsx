import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import client from '../api/client'
import { mensajeError, useLista } from '../api/hooks'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import { ROLES_USUARIO } from '../constantes'
import type { Aplicacion, Usuario } from '../types'

export default function Usuarios() {
  const { usuario: yo } = useAuth()
  const esSuperadmin = yo?.rol === 'superadmin'
  const { datos, error, recargar } = useLista<Usuario>('/usuarios')
  const { datos: apps } = useLista<Aplicacion>('/aplicaciones')

  // admin_app solo ve sus squads
  const appsDisponibles = useMemo(() => {
    if (esSuperadmin) return apps
    return apps.filter((a) => yo?.aplicaciones_codigos.includes(a.codigo))
  }, [apps, yo, esSuperadmin])

  // admin_app solo ve usuarios de sus squads
  const usuariosFiltrados = useMemo(() => {
    if (esSuperadmin) return datos
    const misCodigos = new Set(yo?.aplicaciones_codigos ?? [])
    return datos.filter((u) =>
      u.aplicaciones_codigos.some((c) => misCodigos.has(c)),
    )
  }, [datos, yo, esSuperadmin])

  // admin_app no puede asignar superadmin
  const rolesDisponibles = useMemo(() => {
    if (esSuperadmin) return ROLES_USUARIO
    return ROLES_USUARIO.filter((r) => r === 'editor' || r === 'viewer')
  }, [esSuperadmin])
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rol, setRol] = useState('viewer')
  const [aplicacion, setAplicacion] = useState('')
  const [aviso, setAviso] = useState('')

  // Estado para edición
  const [editando, setEditando] = useState<Usuario | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editRol, setEditRol] = useState('')
  const [editApps, setEditApps] = useState<string[]>([])
  const [editAviso, setEditAviso] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)

  function abrirEditar(u: Usuario): void {
    setEditando(u)
    setEditNombre(u.nombre)
    setEditEmail(u.email)
    setEditRol(u.rol)
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
    setEditAviso('')
    try {
      await client.put(`/usuarios/${editando!.id}`, {
        nombre: editNombre,
        email: editEmail,
        rol: editRol,
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
        rol,
        aplicaciones_codigos: aplicacion ? [aplicacion] : [],
      })
      setNombre('')
      setEmail('')
      setPassword('')
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  async function cambiarRol(u: Usuario, nuevoRol: string): Promise<void> {
    setAviso('')
    try {
      await client.put(`/usuarios/${u.id}`, { rol: nuevoRol })
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  async function alternarActivo(u: Usuario): Promise<void> {
    await client.put(`/usuarios/${u.id}`, { activo: !u.activo })
    recargar()
  }

  async function resetPassword(u: Usuario): Promise<void> {
    const nueva = window.prompt(`Nueva contraseña para ${u.email}:`)
    if (!nueva) return
    await client.patch(`/usuarios/${u.id}/password`, { password: nueva })
    window.alert('Contraseña actualizada.')
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-marca-osc">Usuarios</h1>

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
          <select value={rol} onChange={(e) => setRol(e.target.value)} className="rounded border px-3 py-2">
            {rolesDisponibles.map((r) => <option key={r} value={r}>{r}</option>)}
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
                  value={u.rol}
                  onChange={(e) => cambiarRol(u, e.target.value)}
                  className="rounded border px-2 py-1 text-xs"
                >
                  {rolesDisponibles.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </td>
              <td className="p-2">{u.rol === 'superadmin' ? '★ Todos' : (u.aplicaciones_codigos.map((c) => apps.find((a) => a.codigo === c)?.nombre ?? c).join(', ') || '—')}</td>
              <td className="p-2 text-center">{u.activo ? 'Sí' : 'No'}</td>
              <td className="p-2 text-center whitespace-nowrap">
                <button onClick={() => abrirEditar(u)} className="mr-2 text-marca hover:underline text-xs">
                  Editar
                </button>
                <button onClick={() => alternarActivo(u)} className={`mr-2 text-xs ${u.activo ? 'text-amber-600 hover:underline' : 'text-emerald-600 hover:underline'}`}>
                  {u.activo ? 'Desactivar' : 'Activar'}
                </button>
                <button onClick={() => resetPassword(u)} className="text-xs text-marca hover:underline">
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
            <select value={editRol} onChange={(e) => setEditRol(e.target.value)}
              className="w-full rounded border px-3 py-2">
              {rolesDisponibles.map((r) => <option key={r} value={r}>{r}</option>)}
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
    </div>
  )
}
