import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import client from '../api/client'
import { mensajeError, useLista } from '../api/hooks'
import Modal from '../components/Modal'
import { useAplicacion } from '../context/AplicacionContext'
import type { Aplicacion, Persona } from '../types'

const ROLES_DEFAULT = ['DEV', 'LT_HITSS', 'LT_EPM', 'SCRUM', 'EPM', 'COORD', 'LECTOR']

export default function Personas() {
  const { datos, error, recargar } = useLista<Persona>('/personas')
  const { datos: squads } = useLista<Aplicacion>('/aplicaciones')
  const { modoConsolidado, activa } = useAplicacion()
  const [roles, setRoles] = useState<string[]>(ROLES_DEFAULT)
  const [busqueda, setBusqueda] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando] = useState<Persona | null>(null)
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [rol, setRol] = useState('DEV')
  const [squadsSelec, setSquadsSelec] = useState<string[]>([])
  const [activo, setActivo] = useState(true)
  const [aviso, setAviso] = useState('')
  const [aplicacionId, setAplicacionId] = useState('')

  // Recargar la lista cuando cambia la aplicación activa
  useEffect(() => {
    recargar()
  }, [activa]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    client
      .get<string[]>('/personas/roles')
      .then((r) => {
        if (r.data.length > 0) {
          setRoles(r.data)
          setRol(r.data[0])
        }
      })
      .catch(() => {})
  }, [])

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return datos
    return datos.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        (p.email ?? '').toLowerCase().includes(q) ||
        (p.squads ?? []).join(' ').toLowerCase().includes(q) ||
        p.rol_operativo.toLowerCase().includes(q),
    )
  }, [datos, busqueda])

  function abrirNuevo(): void {
    setEditando(null)
    setNombre('')
    setEmail('')
    setSquadsSelec([])
    setRol(roles[0] ?? 'DEV')
    setActivo(true)
    setAviso('')
    setAplicacionId('')  // se deriva automáticamente del squad seleccionado
    setModalAbierto(true)
  }

  function abrirEditar(persona: Persona): void {
    setEditando(persona)
    setNombre(persona.nombre)
    setEmail(persona.email ?? '')
    setRol(persona.rol_operativo)
    setSquadsSelec(persona.squads ?? [])
    setActivo(persona.activo)
    setAviso('')
    setModalAbierto(true)
  }

  function cerrar(): void {
    setModalAbierto(false)
    setEditando(null)
    setAviso('')
  }

  async function eliminar(persona: Persona): Promise<void> {
    if (!window.confirm(`¿Eliminar a "${persona.nombre}"? Esta acción no se puede deshacer.`)) return
    try {
      await client.delete(`/personas/${persona.id}`)
      recargar()
    } catch (err) {
      alert(mensajeError(err))
    }
  }

  async function guardar(e: FormEvent): Promise<void> {
    e.preventDefault()
    setAviso('')

    // Validar unicidad correo+squad
    if (email) {
      const emailNorm = email.trim().toLowerCase()
      // Squads que se están asignando y que son nuevos respecto al registro original
      const squadsNuevos = editando
        ? squadsSelec.filter((s) => !(editando.squads ?? []).includes(s))
        : squadsSelec

      for (const squad of squadsNuevos) {
        const duplicado = datos.find(
          (p) =>
            p.id !== editando?.id &&
            (p.email ?? '').trim().toLowerCase() === emailNorm &&
            (p.squads ?? []).includes(squad),
        )
        if (duplicado) {
          setAviso(
            `El correo "${email}" ya está registrado en el squad "${squad}" (persona: ${duplicado.nombre}).`,
          )
          return
        }
      }
    }

    const payload: Record<string, unknown> = {
      nombre,
      email: email || null,
      rol_operativo: rol,
      squads: squadsSelec,
      activo,
    }
    if (!editando) {
      if (!aplicacionIdEfectivo) {
        setAviso('Selecciona al menos un squad o una aplicación.')
        return
      }
      payload.aplicacion_id = aplicacionIdEfectivo
    }
    try {
      if (editando) {
        await client.put(`/personas/${editando.id}`, {
          ...payload,
          es_lider_tecnico: editando.es_lider_tecnico ?? false,
          permite_sobrecarga: editando.permite_sobrecarga ?? false,
          usuario_id: editando.usuario_id ?? null,
        })
      } else {
        await client.post('/personas', payload)
      }
      cerrar()
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  // mapa nombre → codigo usando la misma lista del multi-select
  const squadsMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of squads) m.set(s.nombre, s.codigo)
    return m
  }, [squads])

  // aplicacionId activo: primer squad seleccionado → su codigo; si no, app activa actual
  const aplicacionIdEfectivo = useMemo(() => {
    if (aplicacionId) return aplicacionId
    for (const nombre of squadsSelec) {
      const cod = squadsMap.get(nombre)
      if (cod) return cod
    }
    return modoConsolidado ? '' : activa
  }, [aplicacionId, squadsSelec, squadsMap, modoConsolidado, activa])

  const [collapsedRoles, setCollapsedRoles] = useState<Set<string>>(new Set())

  const personasPorRol = useMemo(() => {
    const mapa = new Map<string, Persona[]>()
    for (const p of filtradas) {
      const rol = p.rol_operativo || 'Sin rol'
      if (!mapa.has(rol)) mapa.set(rol, [])
      mapa.get(rol)!.push(p)
    }
    return Array.from(mapa.entries()).sort(([a], [b]) => a.localeCompare(b, 'es'))
  }, [filtradas])

  function toggleRol(rol: string): void {
    setCollapsedRoles((prev) => {
      const next = new Set(prev)
      if (next.has(rol)) next.delete(rol)
      else next.add(rol)
      return next
    })
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-marca-osc">Personas</h1>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, correo, squad o rol…"
          className="w-72 rounded border px-3 py-2 text-sm"
        />
        <button
          onClick={abrirNuevo}
          className="rounded bg-marca px-4 py-2 text-sm text-white hover:bg-marca-osc"
        >
          + Nueva persona
        </button>
      </div>

      {error && <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>}

      {filtradas.length === 0 && (
        <div className="rounded-xl border bg-white p-4 text-center text-slate-400">
          {busqueda ? 'Sin resultados para la búsqueda.' : 'Sin personas.'}
        </div>
      )}

      <div className="space-y-4">
        {personasPorRol.map(([rol, personas]) => {
          const collapsed = collapsedRoles.has(rol)
          const activos = personas.filter((p) => p.activo).length
          return (
            <section key={rol} className="overflow-hidden rounded-xl border bg-white shadow-sm">
              <button
                onClick={() => toggleRol(rol)}
                className="flex w-full items-center justify-between bg-marca-osc px-4 py-2.5 text-left text-white hover:bg-marca-osc/90 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg"
                    className={`h-4 w-4 transition-transform ${collapsed ? '' : 'rotate-90'}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="font-semibold">{rol}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="rounded-full bg-white/20 px-2 py-0.5">{personas.length} persona{personas.length !== 1 ? 's' : ''}</span>
                  <span className="rounded-full bg-emerald-400/30 px-2 py-0.5">{activos} activo{activos !== 1 ? 's' : ''}</span>
                </div>
              </button>
              {!collapsed && (
                <table className="w-full table-fixed text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="w-[30%] p-2 text-left">Nombre</th>
                      <th className="w-[25%] p-2 text-left">Correo</th>
                      <th className="w-[15%] p-2 text-left">Squad</th>
                      <th className="w-[10%] p-2 text-center">Activo</th>
                      <th className="w-[20%] p-2 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {personas.map((p) => (
                      <tr key={p.id} className="border-t">
                        <td className="p-2 truncate">{p.nombre}</td>
                        <td className="p-2 truncate">{p.email ?? '—'}</td>
                        <td className="p-2 truncate">{(p.squads ?? []).join(', ') || '—'}</td>
                        <td className="p-2 text-center">
                          {p.activo
                            ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Sí</span>
                            : <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">No</span>}
                        </td>
                        <td className="p-2 text-center whitespace-nowrap">
                          <button onClick={() => abrirEditar(p)} className="mr-2 text-marca hover:underline text-xs">
                            Editar
                          </button>
                          <button
                            onClick={() => eliminar(p)}
                            className="mr-2 text-red-600 hover:underline text-xs"
                          >
                            Eliminar
                          </button>
                          <button
                            onClick={async () => {
                              await client.put(`/personas/${p.id}`, {
                                nombre: p.nombre,
                                email: p.email,
                                rol_operativo: p.rol_operativo,
                                squads: p.squads ?? [],
                                activo: !p.activo,
                                es_lider_tecnico: p.es_lider_tecnico ?? false,
                                permite_sobrecarga: p.permite_sobrecarga ?? false,
                                usuario_id: p.usuario_id ?? null,
                              })
                              recargar()
                            }}
                            className={`text-xs ${p.activo ? 'text-amber-600 hover:underline' : 'text-emerald-600 hover:underline'}`}
                          >
                            {p.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )
        })}
      </div>

      <Modal
        titulo={editando ? `Editar: ${editando.nombre}` : 'Nueva persona'}
        abierto={modalAbierto}
        onCerrar={cerrar}
      >
        <form onSubmit={guardar} className="space-y-3">
          {aviso && <div className="rounded bg-red-50 p-2 text-sm text-red-700">{aviso}</div>}
          <div className="block text-sm">
            <span className="mb-1 block text-slate-600">
              Squads
              {!editando && aplicacionIdEfectivo && (
                <span className="ml-2 text-xs font-semibold text-cyan-700">
                  → se guardará en: {squads.find((s) => s.codigo === aplicacionIdEfectivo)?.nombre ?? aplicacionIdEfectivo}
                </span>
              )}
            </span>
            <select
              multiple
              value={squadsSelec}
              onChange={(e) => {
                setSquadsSelec(Array.from(e.target.selectedOptions, (o) => o.value))
                setAplicacionId('') // recalcular desde squad
              }}
              className="w-full rounded border px-3 py-2 h-32"
            >
              {squads.filter((s) => s.activa).map((s) => (
                <option key={s.codigo} value={s.nombre}>{s.nombre}</option>
              ))}
            </select>
            <p className="mt-0.5 text-xs text-slate-400">Ctrl+clic para seleccionar varios</p>
          </div>
          {!editando && (
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Aplicación <span className="text-slate-400">(se auto-detecta del squad; cambia solo si es necesario)</span></span>
              <select value={aplicacionIdEfectivo} onChange={(e) => setAplicacionId(e.target.value)}
                className="w-full rounded border px-3 py-2">
                {squads.filter((s) => s.activa).map((s) => (
                  <option key={s.codigo} value={s.codigo}>{s.nombre}</option>
                ))}
              </select>
            </label>
          )}
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Nombre</span>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} required
              className="w-full rounded border px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Correo</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email"
              className="w-full rounded border px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Rol</span>
            <select value={rol} onChange={(e) => setRol(e.target.value)}
              className="w-full rounded border px-3 py-2">
              {roles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
            <span className="text-slate-600">Activo</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={cerrar}
              className="rounded border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
              Cancelar
            </button>
            <button className="rounded bg-marca px-4 py-2 text-sm text-white hover:bg-marca-osc">
              {editando ? 'Guardar cambios' : 'Crear'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
