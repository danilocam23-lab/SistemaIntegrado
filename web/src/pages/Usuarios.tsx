// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useMemo, useState } from 'react'
import type { ComponentProps, FormEvent } from 'react'
import client from '../api/client'
import { mensajeError, useLista } from '../api/hooks'
import { useAuth } from '../context/AuthContext'
import type { Aplicacion, Rol, Usuario } from '../types'
import FormularioRol from './usuarios/FormularioRol'
import ListaUsuarios from './usuarios/ListaUsuarios'
import ModalUsuario from './usuarios/ModalUsuario'
import PanelRoles from './usuarios/PanelRoles'
import { agruparPermisosPorModulo, permisoInfo, permisosConModulo } from './usuarios/utilidades'

type Tab = 'usuarios' | 'roles'
type ModoPanelRol = 'nuevo' | 'editar' | 'vacio'

const TAMANIO_PAGINA_USUARIOS = 18

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

  const gruposPermisos = useMemo(
    () => agruparPermisosPorModulo(catalogoPermisosOrdenado),
    [catalogoPermisosOrdenado],
  )

  // ── Filtros y paginación de la lista de usuarios (client-side) ──────────
  const [busqueda, setBusqueda] = useState('')
  const [filtroRol, setFiltroRol] = useState('')
  const [filtroSquad, setFiltroSquad] = useState('')
  const [paginaUsuarios, setPaginaUsuarios] = useState(1)

  function onCambiarBusqueda(v: string): void {
    setBusqueda(v)
    setPaginaUsuarios(1)
  }
  function onCambiarFiltroRol(v: string): void {
    setFiltroRol(v)
    setPaginaUsuarios(1)
  }
  function onCambiarFiltroSquad(v: string): void {
    setFiltroSquad(v)
    setPaginaUsuarios(1)
  }

  const usuariosBuscados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()
    return usuariosFiltrados.filter((u) => {
      if (termino && !`${u.nombre} ${u.email}`.toLowerCase().includes(termino)) return false
      if (filtroRol && u.rol_id !== filtroRol) return false
      if (filtroSquad && !u.aplicaciones_codigos.includes(filtroSquad)) return false
      return true
    })
  }, [usuariosFiltrados, busqueda, filtroRol, filtroSquad])

  const opcionesRolFiltro = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const u of usuariosFiltrados) {
      if (u.rol_id) mapa.set(u.rol_id, u.rol_nombre || u.rol_id)
    }
    return Array.from(mapa, ([clave, etiqueta]) => ({ clave, etiqueta }))
      .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'))
  }, [usuariosFiltrados])

  const opcionesSquadFiltro = useMemo(() => {
    const codigos = new Set<string>()
    for (const u of usuariosFiltrados) for (const c of u.aplicaciones_codigos) codigos.add(c)
    return Array.from(codigos)
      .map((codigo) => ({ clave: codigo, etiqueta: apps.find((a) => a.codigo === codigo)?.nombre ?? codigo }))
      .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'))
  }, [usuariosFiltrados, apps])

  const totalPaginasUsuarios = Math.max(1, Math.ceil(usuariosBuscados.length / TAMANIO_PAGINA_USUARIOS))
  const paginaUsuariosSegura = Math.min(paginaUsuarios, totalPaginasUsuarios)
  const usuariosPagina = useMemo(
    () => usuariosBuscados.slice(
      (paginaUsuariosSegura - 1) * TAMANIO_PAGINA_USUARIOS,
      paginaUsuariosSegura * TAMANIO_PAGINA_USUARIOS,
    ),
    [usuariosBuscados, paginaUsuariosSegura],
  )

  // ── Alta de usuario (modal "Nuevo usuario") ──────────────────────────────
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rolId, setRolId] = useState('')
  const [aplicacionesNuevo, setAplicacionesNuevo] = useState<string[]>([])
  const [aviso, setAviso] = useState('')
  const [modalNuevoAbierto, setModalNuevoAbierto] = useState(false)

  // ── Edición de usuario (modal "Editar") ──────────────────────────────────
  const [editando, setEditando] = useState<Usuario | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editRolId, setEditRolId] = useState('')
  const [editApps, setEditApps] = useState<string[]>([])
  const [editAviso, setEditAviso] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)

  // ── Maestro-detalle de roles ──────────────────────────────────────────────
  const [nuevoRolClave, setNuevoRolClave] = useState('')
  const [nuevoRolNombre, setNuevoRolNombre] = useState('')
  const [nuevoRolDescripcion, setNuevoRolDescripcion] = useState('')
  const [nuevoRolPermisos, setNuevoRolPermisos] = useState<string[]>([])
  const [rolEditando, setRolEditando] = useState<Rol | null>(null)
  const [mostrandoNuevoRol, setMostrandoNuevoRol] = useState(false)
  const [avisoRoles, setAvisoRoles] = useState('')

  function abrirCrear(): void {
    setNombre('')
    setEmail('')
    setPassword('')
    setRolId('')
    setAplicacionesNuevo([])
    setAviso('')
    setModalNuevoAbierto(true)
  }

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
      setModalNuevoAbierto(false)
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

  function togglePermisoEdicion(permiso: string): void {
    setRolEditando((prev) => {
      if (!prev) return prev
      const permisos = prev.permisos.includes(permiso)
        ? prev.permisos.filter((p) => p !== permiso)
        : [...prev.permisos, permiso]
      return { ...prev, permisos }
    })
  }

  function alternarModuloNuevo(permisosModulo: string[], marcar: boolean): void {
    setNuevoRolPermisos((prev) => permisosConModulo(prev, permisosModulo, marcar))
  }

  function alternarModuloEdicion(permisosModulo: string[], marcar: boolean): void {
    setRolEditando((prev) => (prev ? { ...prev, permisos: permisosConModulo(prev.permisos, permisosModulo, marcar) } : prev))
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

  function abrirNuevoRol(): void {
    setNuevoRolClave('')
    setNuevoRolNombre('')
    setNuevoRolDescripcion('')
    setNuevoRolPermisos([])
    setAvisoRoles('')
    setRolEditando(null)
    setMostrandoNuevoRol(true)
  }

  function seleccionarRol(rol: Rol): void {
    setRolEditando({ ...rol })
    setMostrandoNuevoRol(false)
    setAvisoRoles('')
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
      setMostrandoNuevoRol(false)
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
      setRolEditando(null)
      recargarRoles()
      recargar()
    } catch (err) {
      setAvisoRoles(mensajeError(err))
    }
  }

  const modoPanelRol: ModoPanelRol = mostrandoNuevoRol ? 'nuevo' : rolEditando ? 'editar' : 'vacio'

  const propsFormularioRol: ComponentProps<typeof FormularioRol> | null =
    modoPanelRol === 'nuevo'
      ? {
          modo: 'nuevo',
          clave: nuevoRolClave,
          onCambiarClave: setNuevoRolClave,
          nombre: nuevoRolNombre,
          onCambiarNombre: setNuevoRolNombre,
          descripcion: nuevoRolDescripcion,
          onCambiarDescripcion: setNuevoRolDescripcion,
          permisosSeleccionados: nuevoRolPermisos,
          grupos: gruposPermisos,
          onTogglePermiso: toggleNuevoPermiso,
          onToggleModulo: alternarModuloNuevo,
          puedeGuardar: puedeCrearRoles,
          aviso: avisoRoles,
          onSubmit: crearRol,
        }
      : modoPanelRol === 'editar' && rolEditando
        ? {
            modo: 'editar',
            clave: rolEditando.clave,
            nombre: rolEditando.nombre,
            onCambiarNombre: (v: string) => setRolEditando({ ...rolEditando, nombre: v }),
            descripcion: rolEditando.descripcion,
            onCambiarDescripcion: (v: string) => setRolEditando({ ...rolEditando, descripcion: v }),
            activo: rolEditando.activo,
            onCambiarActivo: (v: boolean) => setRolEditando({ ...rolEditando, activo: v }),
            esSistema: rolEditando.es_sistema,
            permisosSeleccionados: rolEditando.permisos,
            grupos: gruposPermisos,
            onTogglePermiso: togglePermisoEdicion,
            onToggleModulo: alternarModuloEdicion,
            puedeGuardar: puedeEditarRoles,
            puedeEliminar: puedeEliminarRoles,
            aviso: avisoRoles,
            onSubmit: guardarRol,
            onEliminar: () => { void eliminarRol(rolEditando) },
          }
        : null

  return (
    <div>
      <h1 className="titulo-pagina mb-4">Usuarios</h1>

      <div className="pestanas mb-4">
        <button
          onClick={() => setTab('usuarios')}
          className={`pestana ${tab === 'usuarios' ? 'pestana-activa' : ''}`}
        >
          Usuarios
        </button>
        {puedeVerRoles && (
          <button
            onClick={() => setTab('roles')}
            className={`pestana ${tab === 'roles' ? 'pestana-activa' : ''}`}
          >
            Roles y permisos
          </button>
        )}
      </div>

      {tab === 'usuarios' && (
        <ListaUsuarios
          usuariosPagina={usuariosPagina}
          totalFiltrados={usuariosBuscados.length}
          totalSinFiltrar={datos.length}
          pagina={paginaUsuariosSegura}
          totalPaginas={totalPaginasUsuarios}
          onCambiarPagina={setPaginaUsuarios}
          busqueda={busqueda}
          onCambiarBusqueda={onCambiarBusqueda}
          filtroRol={filtroRol}
          onCambiarFiltroRol={onCambiarFiltroRol}
          opcionesRol={opcionesRolFiltro}
          filtroSquad={filtroSquad}
          onCambiarFiltroSquad={onCambiarFiltroSquad}
          opcionesSquad={opcionesSquadFiltro}
          puedeCrearUsuarios={puedeCrearUsuarios}
          onNuevoUsuario={abrirCrear}
          aviso={aviso || error}
          rolesDisponibles={rolesDisponibles}
          puedeEditarUsuarios={puedeEditarUsuarios}
          yoId={yo?.id}
          nombresSquadsUsuario={nombresSquadsUsuario}
          onCambiarRol={cambiarRol}
          onAlternarActivo={alternarActivo}
          onEditar={abrirEditar}
          onResetPassword={resetPassword}
          onEliminar={eliminarAcceso}
        />
      )}

      {tab === 'roles' && puedeVerRoles && (
        <PanelRoles
          roles={roles}
          rolSeleccionadoId={rolEditando?.id ?? null}
          puedeCrearRoles={puedeCrearRoles}
          puedeEditarRoles={puedeEditarRoles}
          onNuevoRol={abrirNuevoRol}
          onSeleccionarRol={seleccionarRol}
          errorRoles={errorRoles}
          propsFormulario={propsFormularioRol}
        />
      )}

      <ModalUsuario
        abierto={modalNuevoAbierto}
        onCerrar={() => setModalNuevoAbierto(false)}
        titulo="Nuevo usuario"
        onSubmit={crear}
        aviso={aviso}
        nombre={nombre}
        setNombre={setNombre}
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        rolId={rolId}
        setRolId={setRolId}
        rolesDisponibles={rolesDisponibles}
        squads={aplicacionesNuevo}
        setSquads={setAplicacionesNuevo}
        onToggleSquad={alternarSquadNuevo}
        appsActivasDisponibles={appsActivasDisponibles}
        textoSubmit="Crear"
      />

      <ModalUsuario
        abierto={modalAbierto}
        onCerrar={cerrarModal}
        titulo={editando ? `Editar: ${editando.nombre}` : 'Editar usuario'}
        onSubmit={guardarEdicion}
        aviso={editAviso}
        nombre={editNombre}
        setNombre={setEditNombre}
        email={editEmail}
        setEmail={setEditEmail}
        rolId={editRolId}
        setRolId={setEditRolId}
        rolesDisponibles={rolesDisponibles}
        squads={editApps}
        setSquads={setEditApps}
        onToggleSquad={alternarSquadEdicion}
        appsActivasDisponibles={appsActivasDisponibles}
        textoSubmit="Guardar cambios"
      />
    </div>
  )
}
