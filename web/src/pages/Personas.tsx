import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import client from '../api/client'
import { mensajeError, useLista } from '../api/hooks'
import Modal from '../components/Modal'
import { useAplicacion } from '../context/AplicacionContext'
import { useAuth } from '../context/AuthContext'
import type { Aplicacion, Persona } from '../types'

const ROLES_DEFAULT = ['DEV', 'LT_HITSS', 'LT_EPM', 'SCRUM', 'EPM', 'COORD', 'LECTOR']

interface PersonaResumen {
  id: string
  nombre: string
  email: string | null
  squads: string[]
  activo: boolean
  aplicacion_id: string
  score: number
}

interface GrupoDuplicados {
  nombre: string
  rol: string
  total: number
  ganador: PersonaResumen
  duplicados: PersonaResumen[]
}

export default function Personas() {
  const { datos, error, recargar } = useLista<Persona>('/personas')
  const { datos: squads } = useLista<Aplicacion>('/aplicaciones')
  const { modoConsolidado, activa } = useAplicacion()
  const { tienePermiso } = useAuth()
  const puedeCrearPersonas = tienePermiso('personas.crear')
  const puedeEditarPersonas = tienePermiso('personas.editar')
  const puedeEliminarPersonas = tienePermiso('personas.eliminar')
  const esGerente = tienePermiso('personas.ver_valores')
  const [roles, setRoles] = useState<string[]>(ROLES_DEFAULT)
  const [tiposContratacion, setTiposContratacion] = useState<string[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando] = useState<Persona | null>(null)
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [rol, setRol] = useState('DEV')
  const [tipoContratacion, setTipoContratacion] = useState('')
  const [squadsSelec, setSquadsSelec] = useState<string[]>([])
  const [activo, setActivo] = useState(true)
  const [valorPersona, setValorPersona] = useState(0)
  const [valorPerifericos, setValorPerifericos] = useState(0)
  const [aviso, setAviso] = useState('')
  const [aplicacionId, setAplicacionId] = useState('')

  // Estados para deduplicación
  const [duplicados, setDuplicados] = useState<GrupoDuplicados[]>([])
  const [modalDupAbierto, setModalDupAbierto] = useState(false)
  const [deduplicando, setDeduplicando] = useState(false)
  const [resultadoDedup, setResultadoDedup] = useState<{ fusionados: number; referencias_actualizadas: number } | null>(null)

  async function cargarDuplicados(): Promise<void> {
    try {
      const { data } = await client.get<GrupoDuplicados[]>('/personas/duplicados')
      setDuplicados(data)
    } catch {
      // silencioso
    }
  }

  // Recargar la lista cuando cambia la aplicación activa
  useEffect(() => {
    recargar()
    cargarDuplicados()
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
    client
      .get<string[]>('/personas/tipos-contratacion')
      .then((r) => {
        if (r.data.length > 0) setTiposContratacion(r.data)
      })
      .catch(() => {})
    cargarDuplicados()
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
    setTipoContratacion('')
    setActivo(true)
    setValorPersona(0)
    setValorPerifericos(0)
    setAviso('')
    setAplicacionId('')  // se deriva automáticamente del squad seleccionado
    setModalAbierto(true)
  }

  function abrirEditar(persona: Persona): void {
    setEditando(persona)
    setNombre(persona.nombre)
    setEmail(persona.email ?? '')
    setRol(persona.rol_operativo)
    setTipoContratacion(persona.tipo_contratacion ?? '')
    setSquadsSelec(persona.squads ?? [])
    setActivo(persona.activo)
    setValorPersona(persona.valor_persona ?? 0)
    setValorPerifericos(persona.valor_perifericos ?? 0)
    setAviso('')
    setModalAbierto(true)
  }

  function cerrar(): void {
    setModalAbierto(false)
    setEditando(null)
    setAviso('')
  }

  async function eliminar(persona: Persona): Promise<void> {
    if (!puedeEliminarPersonas) return
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
    if (editando && !puedeEditarPersonas) return
    if (!editando && !puedeCrearPersonas) return

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
      tipo_contratacion: tipoContratacion || null,
      squads: squadsSelec,
      activo,
      valor_persona: valorPersona,
      valor_perifericos: valorPerifericos,
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

  async function deduplicar(): Promise<void> {
    if (!window.confirm(`¿Fusionar ${duplicados.length} grupo(s) de duplicados? Se conservará la persona con más información completa y se redirigirán todas las referencias.`)) return
    setDeduplicando(true)
    setResultadoDedup(null)
    try {
      const { data } = await client.post<{ fusionados: number; referencias_actualizadas: number }>('/personas/deduplicar')
      setResultadoDedup(data)
      setDuplicados([])
      recargar()
    } catch (err) {
      alert(mensajeError(err))
    } finally {
      setDeduplicando(false)
    }
  }

  function cerrarModalDup(): void {
    setModalDupAbierto(false)
    setResultadoDedup(null)
  }

  return (
    <div>
      <h1 className="titulo-pagina mb-4">Personas</h1>

      {/* Banner de duplicados */}
      {duplicados.length > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <span>
            ⚠️ Se encontraron <strong>{duplicados.length}</strong> grupo(s) con personas duplicadas.
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setModalDupAbierto(true)}
              className="btn btn-secundario btn-sm"
            >
              Ver detalle
            </button>
            {puedeEditarPersonas && (
              <button
                onClick={deduplicar}
                disabled={deduplicando}
                className="btn btn-alerta btn-sm"
              >
                {deduplicando ? 'Fusionando…' : 'Fusionar duplicados'}
              </button>
            )}
          </div>
        </div>
      )}

      {resultadoDedup && (
        <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          ✅ Deduplicación completada: <strong>{resultadoDedup.fusionados}</strong> persona(s) fusionadas,{' '}
          <strong>{resultadoDedup.referencias_actualizadas}</strong> referencia(s) actualizadas.
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, correo, squad o rol…"
          className="campo w-72"
        />
        {puedeCrearPersonas && (
          <button
            onClick={abrirNuevo}
            className="btn btn-primario"
          >
            + Nueva persona
          </button>
        )}
      </div>

      {error && <div className="aviso aviso-error mb-3">{error}</div>}

      {filtradas.length === 0 && (
        <div className="tarjeta tarjeta-pad text-center text-slate-400">
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
                  <thead className="bg-slate-50 text-slate-600 text-xs">
                    <tr>
                     <th className="p-2 text-left">Nombre</th>
                     <th className="p-2 text-left">Correo</th>
                     <th className="p-2 text-left">Squad</th>
                    {rol !== 'LT_EPM' && <th className="p-2 text-left">Tipo de contratación</th>}
                    {esGerente && rol !== 'LT_EPM' && <th className="p-2 text-right whitespace-nowrap">Valor persona</th>}
                    {esGerente && rol !== 'LT_EPM' && <th className="p-2 text-right whitespace-nowrap">Valor periféricos</th>}
                    <th className="p-2 text-center">Activo</th>
                    <th className="p-2 text-center whitespace-nowrap">F. desactivación</th>
                    <th className="p-2 text-center">Acciones</th>
                   </tr>
                  </thead>
                  <tbody>
                    {personas.map((p) => (
                     <tr key={p.id} className="border-t">
                       <td className="p-2 truncate">{p.nombre}</td>
                       <td className="p-2 truncate">{p.email ?? '—'}</td>
                       <td className="p-2 truncate">{(p.squads ?? []).join(', ') || '—'}</td>
                       {rol !== 'LT_EPM' && <td className="p-2 truncate">{p.tipo_contratacion ?? '—'}</td>}
                       {esGerente && rol !== 'LT_EPM' && <td className="p-2 text-right font-mono text-xs">${(p.valor_persona ?? 0).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>}
                       {esGerente && rol !== 'LT_EPM' && <td className="p-2 text-right font-mono text-xs">${(p.valor_perifericos ?? 0).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>}
                        <td className="p-2 text-center">
                          {p.activo
                            ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Sí</span>
                            : <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">No</span>}
                        </td>
                        <td className="p-2 text-center whitespace-nowrap text-xs text-slate-600">
                          {p.fecha_desactivacion ? p.fecha_desactivacion.slice(0, 10) : '—'}
                        </td>
                        <td className="p-2 text-center whitespace-nowrap">
                          {puedeEditarPersonas && (
                            <button onClick={() => abrirEditar(p)} className="enlace-accion text-xs mr-2">
                              Editar
                            </button>
                          )}
                          {puedeEliminarPersonas && (
                            <button
                              onClick={() => eliminar(p)}
                              className="enlace-accion enlace-accion-peligro text-xs mr-2"
                            >
                              Eliminar
                            </button>
                          )}
                          {puedeEditarPersonas && (
                            <button
                              onClick={async () => {
                                await client.put(`/personas/${p.id}`, {
                                  nombre: p.nombre,
                                  email: p.email,
                                  rol_operativo: p.rol_operativo,
                                  tipo_contratacion: p.tipo_contratacion ?? null,
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
                          )}
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
          {aviso && <div className="aviso aviso-error">{aviso}</div>}
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
              className="campo w-full h-32"
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
                className="campo w-full">
                {squads.filter((s) => s.activa).map((s) => (
                  <option key={s.codigo} value={s.codigo}>{s.nombre}</option>
                ))}
              </select>
            </label>
          )}
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Nombre</span>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} required
              className="campo w-full" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Correo</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email"
              className="campo w-full" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Rol</span>
            <select value={rol} onChange={(e) => setRol(e.target.value)}
              className="campo w-full">
              {roles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Tipo de contratación</span>
            <select value={tipoContratacion} onChange={(e) => setTipoContratacion(e.target.value)}
              className="campo w-full">
              <option value="">— Sin especificar —</option>
              {tiposContratacion.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          {esGerente && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600">Valor de la persona ($)</span>
                <input type="number" min={0} step={0.01} value={valorPersona}
                  onChange={(e) => setValorPersona(Number(e.target.value))}
                  className="campo w-full" placeholder="0.00" />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600">Valor de periféricos ($)</span>
                <input type="number" min={0} step={0.01} value={valorPerifericos}
                  onChange={(e) => setValorPerifericos(Number(e.target.value))}
                  className="campo w-full" placeholder="0.00" />
              </label>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
            <span className="text-slate-600">Activo</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={cerrar}
              className="btn btn-secundario">
              Cancelar
            </button>
            {((editando && puedeEditarPersonas) || (!editando && puedeCrearPersonas)) && (
              <button className="btn btn-primario">
                {editando ? 'Guardar cambios' : 'Crear'}
              </button>
            )}
          </div>
        </form>
      </Modal>

      {/* Modal detalle de duplicados */}
      <Modal
        titulo={`Personas duplicadas (${duplicados.length} grupo${duplicados.length !== 1 ? 's' : ''})`}
        abierto={modalDupAbierto}
        onCerrar={cerrarModalDup}
      >
        <div className="space-y-4 text-sm">
          <p className="text-slate-500">
            Se conservará la persona con mayor información (email, squads, usuario vinculado).
            Las demás se eliminarán y sus referencias serán redirigidas automáticamente.
          </p>
          <div className="max-h-96 overflow-auto space-y-3">
            {duplicados.map((g) => (
              <div key={`${g.nombre}-${g.rol}`} className="rounded border bg-slate-50 p-3">
                <div className="mb-2 font-semibold text-slate-700">
                  {g.nombre} <span className="ml-2 text-xs font-normal text-slate-500">[{g.rol}]</span>
                  <span className="ml-2 text-xs text-amber-600">{g.total} registros</span>
                </div>
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-200">
                      <th className="border px-1 py-0.5 text-left">Nombre</th>
                      <th className="border px-1 py-0.5 text-left">Email</th>
                      <th className="border px-1 py-0.5 text-left">Squads</th>
                      <th className="border px-1 py-0.5 text-left">App</th>
                      <th className="border px-1 py-0.5 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-emerald-50">
                      <td className="border px-1 py-0.5 font-medium text-emerald-700">✅ {g.ganador.nombre}</td>
                      <td className="border px-1 py-0.5">{g.ganador.email ?? '—'}</td>
                      <td className="border px-1 py-0.5">{g.ganador.squads.join(', ') || '—'}</td>
                      <td className="border px-1 py-0.5">{g.ganador.aplicacion_id}</td>
                      <td className="border px-1 py-0.5 text-center text-emerald-700">Conservar</td>
                    </tr>
                    {g.duplicados.map((d) => (
                      <tr key={d.id} className="bg-red-50">
                        <td className="border px-1 py-0.5 text-red-700">🗑 {d.nombre}</td>
                        <td className="border px-1 py-0.5">{d.email ?? '—'}</td>
                        <td className="border px-1 py-0.5">{d.squads.join(', ') || '—'}</td>
                        <td className="border px-1 py-0.5">{d.aplicacion_id}</td>
                        <td className="border px-1 py-0.5 text-center text-red-600">Eliminar</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={cerrarModalDup}
              className="btn btn-secundario">
              Cancelar
            </button>
            {puedeEditarPersonas && (
              <button
                onClick={() => { cerrarModalDup(); deduplicar() }}
                disabled={deduplicando}
                className="rounded bg-amber-600 px-4 py-2 text-sm text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {deduplicando ? 'Fusionando…' : 'Confirmar fusión'}
              </button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
