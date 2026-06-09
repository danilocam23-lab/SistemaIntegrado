import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import client from '../api/client'
import { mensajeError, useLista } from '../api/hooks'
import { ESTADOS_ENTREGA, ESTADOS_REQUERIMIENTO } from '../constantes'
import type { Configuracion as Config, Festivo, Tarifa, Categoria } from '../types'

type Tab = 'tarifas' | 'categorias' | 'roles' | 'festivos' | 'parametros' | 'estados'

export default function Configuracion() {
  const [tab, setTab] = useState<Tab>('tarifas')

  const { datos, error, recargar } = useLista<Config>('/configuracion')
  const { datos: festivos, recargar: recargarFestivos } = useLista<Festivo>('/festivos')
  const { datos: tarifas, recargar: recargarTarifas } = useLista<Tarifa>('/tarifas')
  const { datos: categorias, recargar: recargarCategorias } = useLista<Categoria>('/categorias')
  const [valores, setValores] = useState<Record<string, string>>({})
  const [nuevaClave, setNuevaClave] = useState('')
  const [nuevoValor, setNuevoValor] = useState('')
  const [grupo, setGrupo] = useState('general')
  const [aviso, setAviso] = useState('')
  const [ok, setOk] = useState('')

  // ── Estado Tarifas ──
  const RAMIFICACIONES = ['Fábrica', 'Soporte']
  const [tAnio, setTAnio] = useState(String(new Date().getFullYear()))
  const [tValorHora, setTValorHora] = useState('')
  const [tRamificacion, setTRamificacion] = useState(RAMIFICACIONES[0])
  const [tAviso, setTAviso] = useState('')
  const [tEditItem, setTEditItem] = useState<Tarifa | null>(null)
  const [tEditAnio, setTEditAnio] = useState('')
  const [tEditValorHora, setTEditValorHora] = useState('')
  const [tEditRamificacion, setTEditRamificacion] = useState('')

  function abrirEdicionTarifa(t: Tarifa) {
    setTEditItem(t)
    setTEditAnio(String(t.anio))
    setTEditValorHora(String(t.valor_hora))
    setTEditRamificacion(t.ramificacion ?? RAMIFICACIONES[0])
  }

  async function guardarPopupTarifa(): Promise<void> {
    if (!tEditItem) return
    setTAviso('')
    try {
      await client.put(`/tarifas/${tEditItem.id}`, {
        anio: Number(tEditAnio),
        valor_hora: Number(tEditValorHora),
        ramificacion: tEditRamificacion,
      })
      setTEditItem(null)
      recargarTarifas()
    } catch (err) {
      setTAviso(mensajeError(err))
    }
  }

  async function crearTarifa(e: FormEvent): Promise<void> {
    e.preventDefault()
    setTAviso('')
    try {
      await client.post('/tarifas', {
        anio: Number(tAnio),
        valor_hora: Number(tValorHora),
        ramificacion: tRamificacion,
      })
      setTValorHora('')
      recargarTarifas()
    } catch (err) {
      setTAviso(mensajeError(err))
    }
  }

  async function eliminarTarifa(t: Tarifa): Promise<void> {
    await client.delete(`/tarifas/${t.id}`)
    recargarTarifas()
  }

  // ── Popup edición ──
  const [editItem, setEditItem] = useState<Config | null>(null)
  const [editClave, setEditClave] = useState('')
  const [editGrupo, setEditGrupo] = useState('')
  const [editValor, setEditValor] = useState('')

  function abrirEdicion(c: Config) {
    setEditItem(c)
    setEditClave(c.clave)
    setEditGrupo(c.grupo)
    setEditValor(valorDe(c))
  }

  async function guardarEdicion(): Promise<void> {
    if (!editItem) return
    setAviso('')
    setOk('')
    try {
      await client.put(`/configuracion/${encodeURIComponent(editClave)}`, {
        valor: editValor,
        grupo: editGrupo,
      })
      setOk(`"${editClave}" guardado.`)
      setEditItem(null)
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  // ── Roles de personas ──
  const [roles, setRoles] = useState<string[]>([])
  const [nuevoRol, setNuevoRol] = useState('')

  // ── Festivos ──
  const [festFecha, setFestFecha] = useState('')
  const [festDescripcion, setFestDescripcion] = useState('')

  useEffect(() => {
    client.get<string[]>('/personas/roles').then((r) => setRoles(r.data)).catch(() => {})
  }, [])

  async function guardarRoles(lista: string[]): Promise<void> {
    setAviso('')
    setOk('')
    try {
      await client.put('/configuracion/roles_persona', {
        valor: lista.join(','),
        grupo: 'personas',
      })
      setRoles(lista)
      setOk('Roles guardados.')
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  function agregarRol(): void {
    const r = nuevoRol.trim().toUpperCase()
    if (!r || roles.includes(r)) return
    const nueva = [...roles, r]
    setNuevoRol('')
    void guardarRoles(nueva)
  }

  function quitarRol(rol: string): void {
    void guardarRoles(roles.filter((r) => r !== rol))
  }

  async function crearFestivo(e: FormEvent): Promise<void> {
    e.preventDefault()
    setAviso('')
    setOk('')
    try {
      await client.post('/festivos', {
        fecha: festFecha,
        descripcion: festDescripcion || null,
      })
      setFestFecha('')
      setFestDescripcion('')
      recargarFestivos()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  async function eliminarFestivo(f: Festivo): Promise<void> {
    await client.delete(`/festivos/${f.id}`)
    recargarFestivos()
  }

  const valorDe = (c: Config): string =>
    valores[c.clave] !== undefined ? valores[c.clave] : c.valor

  async function guardar(c: Config): Promise<void> {
    setAviso('')
    setOk('')
    try {
      await client.put(`/configuracion/${encodeURIComponent(c.clave)}`, {
        valor: valorDe(c),
        grupo: c.grupo,
      })
      setOk(`"${c.clave}" guardado.`)
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  async function crear(e: FormEvent): Promise<void> {
    e.preventDefault()
    setAviso('')
    setOk('')
    try {
      await client.put(`/configuracion/${encodeURIComponent(nuevaClave)}`, {
        valor: nuevoValor,
        grupo,
      })
      setNuevaClave('')
      setNuevoValor('')
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  // ── Estado Categorías ──
  const [cNombre, setCNombre] = useState('')
  const [cColor, setCColor] = useState('#6366f1')
  const [cAviso, setCAviso] = useState('')
  const [cEditCell, setCEditCell] = useState<{ id: string; campo: string } | null>(null)
  const [cEditValue, setCEditValue] = useState('')
  const cCancelarBlur = useRef(false)

  function cIniciarEdicion(id: string, campo: string, valor: string) {
    setCEditCell({ id, campo }); setCEditValue(valor); cCancelarBlur.current = false
  }
  function cCancelarEdicion() {
    cCancelarBlur.current = true; setCEditCell(null); setCEditValue('')
  }
  async function cGuardarEdicion(cat: Categoria): Promise<void> {
    if (!cEditCell) return
    try {
      await client.put(`/categorias/${cat.id}`, {
        nombre: cat.nombre, color: cat.color, orden: cat.orden,
        [cEditCell.campo]: cEditCell.campo === 'orden' ? Number(cEditValue) : cEditValue,
      })
      setCEditCell(null); setCEditValue(''); recargarCategorias()
    } catch (err) { setCAviso(mensajeError(err)) }
  }
  async function cCrear(e: FormEvent): Promise<void> {
    e.preventDefault(); setCAviso('')
    try {
      await client.post('/categorias', { nombre: cNombre, color: cColor, orden: categorias.length + 1 })
      setCNombre(''); recargarCategorias()
    } catch (err) { setCAviso(mensajeError(err)) }
  }
  async function cEliminar(cat: Categoria): Promise<void> {
    setCAviso('')
    try {
      await client.delete(`/categorias/${cat.id}`)
      recargarCategorias()
    } catch (err) { setCAviso(mensajeError(err)) }
  }

  async function eliminarParametro(c: Config): Promise<void> {
    setAviso('')
    setOk('')
    try {
      await client.delete(`/configuracion/${encodeURIComponent(c.clave)}`)
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  // ── Estado: Estados de Requerimiento / Entrega ──
  const [estReq, setEstReq] = useState<string[]>(ESTADOS_REQUERIMIENTO)
  const [estEnt, setEstEnt] = useState<string[]>(ESTADOS_ENTREGA)
  const [nuevoEstReq, setNuevoEstReq] = useState('')
  const [nuevoEstEnt, setNuevoEstEnt] = useState('')
  const [estAviso, setEstAviso] = useState('')
  const [estOk, setEstOk] = useState('')

  useEffect(() => {
    datos.forEach((c) => {
      if (c.clave === 'estados_requerimiento' && c.valor)
        setEstReq(c.valor.split(',').map((s) => s.trim()).filter(Boolean))
      if (c.clave === 'estados_entrega' && c.valor)
        setEstEnt(c.valor.split(',').map((s) => s.trim()).filter(Boolean))
    })
  }, [datos])

  async function guardarEstados(clave: string, lista: string[]): Promise<void> {
    setEstAviso('')
    setEstOk('')
    try {
      await client.put(`/configuracion/${encodeURIComponent(clave)}`, {
        valor: lista.join(','),
        grupo: 'estados',
      })
      setEstOk('Estados guardados.')
      recargar()
    } catch (err) {
      setEstAviso(mensajeError(err))
    }
  }

  function agregarEstadoReq(): void {
    const e = nuevoEstReq.trim().toUpperCase()
    if (!e || estReq.includes(e)) return
    const nueva = [...estReq, e]
    setNuevoEstReq('')
    setEstReq(nueva)
    void guardarEstados('estados_requerimiento', nueva)
  }

  function quitarEstadoReq(estado: string): void {
    const nueva = estReq.filter((e) => e !== estado)
    setEstReq(nueva)
    void guardarEstados('estados_requerimiento', nueva)
  }

  function agregarEstadoEnt(): void {
    const e = nuevoEstEnt.trim().toUpperCase()
    if (!e || estEnt.includes(e)) return
    const nueva = [...estEnt, e]
    setNuevoEstEnt('')
    setEstEnt(nueva)
    void guardarEstados('estados_entrega', nueva)
  }

  function quitarEstadoEnt(estado: string): void {
    const nueva = estEnt.filter((e) => e !== estado)
    setEstEnt(nueva)
    void guardarEstados('estados_entrega', nueva)
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-marca-osc">Configuración</h1>

      {/* ═══ Tabs ═══ */}
      <div className="mb-6 flex gap-1 border-b">
        {([
          { id: 'tarifas',    label: '💰 Tarifas' },
          { id: 'categorias', label: '🏷️ Categorías' },
          { id: 'roles',      label: '👤 Roles' },
          { id: 'festivos',   label: '📅 Festivos' },
          { id: 'parametros', label: '⚙️ Parámetros' },
          { id: 'estados',    label: '🔖 Estados' },
        ] as { id: Tab; label: string }[]).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`rounded-t px-4 py-2 text-sm font-medium transition-colors ${
              tab === id
                ? 'border-b-2 border-marca text-marca-osc bg-white -mb-px'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ═══ TAB: Tarifas ═══ */}
      {tab === 'tarifas' && (
        <div>
          <p className="mb-4 text-sm text-slate-500">
            Valores hora globales del proyecto. No dependen de un squad específico.
          </p>
          <form onSubmit={crearTarifa} className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Año</span>
              <input value={tAnio} onChange={(e) => setTAnio(e.target.value)} type="number" required
                className="w-24 rounded border px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Valor hora</span>
              <input value={tValorHora} onChange={(e) => setTValorHora(e.target.value)} type="number" required
                className="w-32 rounded border px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Ramificación</span>
              <select value={tRamificacion} onChange={(e) => setTRamificacion(e.target.value)}
                className="rounded border px-3 py-2">
                {RAMIFICACIONES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <button className="rounded bg-marca px-4 py-2 text-white hover:bg-marca-osc">Crear</button>
          </form>

          {tAviso && <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{tAviso}</div>}

          <table className="w-full overflow-hidden rounded-xl border bg-white text-sm">
            <thead className="bg-marca-osc text-white">
              <tr>
                <th className="p-2 text-left">Año</th>
                <th className="p-2 text-right">Valor hora</th>
                <th className="p-2 text-left">Ramificación</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {tarifas.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="p-2">{t.anio}</td>
                  <td className="p-2 text-right">{t.valor_hora}</td>
                  <td className="p-2">{t.ramificacion ?? '—'}</td>
                  <td className="p-2 text-center">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => abrirEdicionTarifa(t)} className="text-amber-600 hover:underline">Editar</button>
                      <button onClick={() => eliminarTarifa(t)} className="text-red-600 hover:underline">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
              {tarifas.length === 0 && (
                <tr><td colSpan={4} className="p-4 text-center text-slate-400">Sin tarifas.</td></tr>
              )}
            </tbody>
          </table>

          {/* Modal edición tarifa */}
          {tEditItem && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
              onClick={() => setTEditItem(null)}>
              <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
                onClick={(e) => e.stopPropagation()}>
                <h2 className="mb-4 text-lg font-bold text-marca-osc">Editar tarifa</h2>
                <div className="mb-3">
                  <label className="mb-1 block text-sm text-slate-600">Año</label>
                  <input value={tEditAnio} onChange={(e) => setTEditAnio(e.target.value)}
                    type="number" className="w-full rounded border px-3 py-2" />
                </div>
                <div className="mb-3">
                  <label className="mb-1 block text-sm text-slate-600">Valor hora</label>
                  <input value={tEditValorHora} onChange={(e) => setTEditValorHora(e.target.value)}
                    type="number" className="w-full rounded border px-3 py-2" />
                </div>
                <div className="mb-4">
                  <label className="mb-1 block text-sm text-slate-600">Ramificación</label>
                  <select value={tEditRamificacion} onChange={(e) => setTEditRamificacion(e.target.value)}
                    className="w-full rounded border px-3 py-2">
                    {RAMIFICACIONES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setTEditItem(null)}
                    className="rounded border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
                  <button onClick={guardarPopupTarifa}
                    className="rounded bg-marca px-4 py-2 text-sm text-white hover:bg-marca-osc">Guardar</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: Categorías ═══ */}
      {tab === 'categorias' && (
        <div>
          <p className="mb-4 text-sm text-slate-500">
            Categorías globales para clasificar los requerimientos del proyecto.
          </p>
          <form onSubmit={cCrear} className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Nombre</span>
              <input value={cNombre} onChange={(e) => setCNombre(e.target.value)} required
                className="rounded border px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Color</span>
              <input value={cColor} onChange={(e) => setCColor(e.target.value)} type="color"
                className="h-10 w-16 rounded border" />
            </label>
            <button className="rounded bg-marca px-4 py-2 text-white hover:bg-marca-osc">Crear</button>
          </form>

          {cAviso && <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{cAviso}</div>}

          <table className="w-full overflow-hidden rounded-xl border bg-white text-sm">
            <thead className="bg-marca-osc text-white">
              <tr>
                <th className="p-2 text-left">Orden</th>
                <th className="p-2 text-left">Categoría</th>
                <th className="p-2 text-left">Color</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {categorias.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="cursor-pointer p-2" title="Doble clic para editar"
                    onDoubleClick={() => cIniciarEdicion(c.id, 'orden', String(c.orden))}>
                    {cEditCell?.id === c.id && cEditCell.campo === 'orden' ? (
                      <input autoFocus type="number" value={cEditValue}
                        onChange={(e) => setCEditValue(e.target.value)}
                        onBlur={() => { if (cCancelarBlur.current) { cCancelarBlur.current = false; return } void cGuardarEdicion(c) }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } if (e.key === 'Escape') { e.preventDefault(); cCancelarEdicion() } }}
                        className="w-20 rounded border px-2 py-1" />
                    ) : c.orden}
                  </td>
                  <td className="cursor-pointer p-2" title="Doble clic para editar"
                    onDoubleClick={() => cIniciarEdicion(c.id, 'nombre', c.nombre)}>
                    {cEditCell?.id === c.id && cEditCell.campo === 'nombre' ? (
                      <input autoFocus value={cEditValue}
                        onChange={(e) => setCEditValue(e.target.value)}
                        onBlur={() => { if (cCancelarBlur.current) { cCancelarBlur.current = false; return } void cGuardarEdicion(c) }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } if (e.key === 'Escape') { e.preventDefault(); cCancelarEdicion() } }}
                        className="w-full rounded border px-2 py-1" />
                    ) : c.nombre}
                  </td>
                  <td className="cursor-pointer p-2" title="Doble clic para editar"
                    onDoubleClick={() => cIniciarEdicion(c.id, 'color', c.color)}>
                    {cEditCell?.id === c.id && cEditCell.campo === 'color' ? (
                      <input autoFocus type="color" value={cEditValue}
                        onChange={(e) => setCEditValue(e.target.value)}
                        onBlur={() => { if (cCancelarBlur.current) { cCancelarBlur.current = false; return } void cGuardarEdicion(c) }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } if (e.key === 'Escape') { e.preventDefault(); cCancelarEdicion() } }}
                        className="h-10 w-16 rounded border" />
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-block h-4 w-4 rounded" style={{ background: c.color }} />
                        {c.color}
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-center">
                    <button onClick={() => void cEliminar(c)} className="text-red-600 hover:underline">Eliminar</button>
                  </td>
                </tr>
              ))}
              {categorias.length === 0 && (
                <tr><td colSpan={4} className="p-4 text-center text-slate-400">Sin categorías.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ TAB: Roles ═══ */}
      {tab === 'roles' && (
        <div className="rounded-xl border bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Roles de personas</h2>
          <div className="mb-3 flex flex-wrap gap-2">
            {roles.map((r) => (
              <span key={r} className="inline-flex items-center gap-1 rounded-full bg-marca/10 px-3 py-1 text-sm font-medium text-marca-osc">
                {r}
                <button onClick={() => quitarRol(r)} className="ml-1 text-red-400 hover:text-red-600" title="Quitar">✕</button>
              </span>
            ))}
            {roles.length === 0 && <span className="text-sm text-slate-400">Sin roles configurados</span>}
          </div>
          <div className="flex items-center gap-2">
            <input value={nuevoRol} onChange={(e) => setNuevoRol(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), agregarRol())}
              placeholder="Nuevo rol (ej: QA)" className="rounded border px-3 py-2 text-sm" />
            <button onClick={agregarRol} className="rounded bg-marca px-3 py-2 text-sm text-white hover:bg-marca-osc">Agregar</button>
          </div>
          {ok && <div className="mt-3 rounded bg-emerald-50 p-2 text-sm text-emerald-700">{ok}</div>}
        </div>
      )}

      {/* ═══ TAB: Festivos ═══ */}
      {tab === 'festivos' && (
        <div className="rounded-xl border bg-white p-4">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">Festivos</h2>
          <p className="mb-3 text-xs text-slate-500">Se usan para el cálculo de ANS por días hábiles.</p>
          <form onSubmit={crearFestivo} className="mb-3 flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Fecha</span>
              <input value={festFecha} onChange={(e) => setFestFecha(e.target.value)} type="date" required
                className="rounded border px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Descripción</span>
              <input value={festDescripcion} onChange={(e) => setFestDescripcion(e.target.value)}
                placeholder="Día festivo" className="rounded border px-3 py-2" />
            </label>
            <button className="rounded bg-marca px-3 py-2 text-sm text-white hover:bg-marca-osc">+ Agregar</button>
          </form>
          <ul className="flex flex-wrap gap-2">
            {festivos.slice().sort((a, b) => (a.fecha < b.fecha ? -1 : 1)).map((f) => (
              <li key={f.id} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm">
                <span className="font-medium">{f.fecha?.slice(0, 10)}</span>
                {f.descripcion && <span className="text-slate-500">{f.descripcion}</span>}
                <button onClick={() => eliminarFestivo(f)} className="text-red-400 hover:text-red-600" title="Quitar">✕</button>
              </li>
            ))}
            {festivos.length === 0 && <li className="text-sm text-slate-400">Sin festivos registrados</li>}
          </ul>
          {(aviso || error) && <div className="mt-3 rounded bg-red-50 p-2 text-sm text-red-700">{aviso || error}</div>}
        </div>
      )}

      {/* ═══ TAB: Parámetros ═══ */}
      {tab === 'parametros' && (
        <div>
          <p className="mb-4 text-sm text-slate-500">
            Parámetros del squad activo:
            <code className="mx-1 rounded bg-slate-100 px-1">azdo_org_url</code>,
            <code className="mx-1 rounded bg-slate-100 px-1">azdo_pat</code>,
            <code className="mx-1 rounded bg-slate-100 px-1">azdo_sync_interval</code>.
          </p>
          <form onSubmit={crear} className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Clave</span>
              <input value={nuevaClave} onChange={(e) => setNuevaClave(e.target.value)} required
                className="rounded border px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Valor</span>
              <input value={nuevoValor} onChange={(e) => setNuevoValor(e.target.value)}
                className="rounded border px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Grupo</span>
              <input value={grupo} onChange={(e) => setGrupo(e.target.value)}
                className="rounded border px-3 py-2" />
            </label>
            <button className="rounded bg-marca px-4 py-2 text-white hover:bg-marca-osc">Agregar / actualizar</button>
          </form>

          {(aviso || error) && <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{aviso || error}</div>}
          {ok && <div className="mb-3 rounded bg-emerald-50 p-2 text-sm text-emerald-700">{ok}</div>}

          <table className="w-full overflow-hidden rounded-xl border bg-white text-sm">
            <thead className="bg-marca-osc text-white">
              <tr>
                <th className="p-2 text-left">Clave</th>
                <th className="p-2 text-left">Grupo</th>
                <th className="p-2 text-left">Valor</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {datos.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="p-2 font-mono">{c.clave}</td>
                  <td className="p-2 text-slate-500">{c.grupo}</td>
                  <td className="p-2">
                    <input
                      value={valorDe(c)}
                      onChange={(e) => setValores({ ...valores, [c.clave]: e.target.value })}
                      className="w-full rounded border px-2 py-1"
                    />
                  </td>
                  <td className="p-2 text-center">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => guardar(c)} className="text-marca hover:underline">Guardar</button>
                      <button onClick={() => abrirEdicion(c)} className="text-amber-600 hover:underline">Editar</button>
                      <button onClick={() => void eliminarParametro(c)} className="text-red-600 hover:underline">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
              {datos.length === 0 && (
                <tr><td colSpan={4} className="p-4 text-center text-slate-400">Sin parámetros.</td></tr>
              )}
            </tbody>
          </table>

          {/* Modal edición parámetro */}
          {editItem && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
              onClick={() => setEditItem(null)}>
              <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
                onClick={(e) => e.stopPropagation()}>
                <h2 className="mb-4 text-lg font-bold text-marca-osc">Editar parámetro</h2>
                <div className="mb-3">
                  <label className="mb-1 block text-sm text-slate-600">Clave</label>
                  <input value={editClave} onChange={(e) => setEditClave(e.target.value)}
                    className="w-full rounded border px-3 py-2" />
                </div>
                <div className="mb-3">
                  <label className="mb-1 block text-sm text-slate-600">Grupo</label>
                  <input value={editGrupo} onChange={(e) => setEditGrupo(e.target.value)}
                    className="w-full rounded border px-3 py-2" />
                </div>
                <div className="mb-4">
                  <label className="mb-1 block text-sm text-slate-600">Valor</label>
                  <textarea value={editValor} onChange={(e) => setEditValor(e.target.value)}
                    rows={3} className="w-full rounded border px-3 py-2" />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditItem(null)}
                    className="rounded border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
                  <button onClick={guardarEdicion}
                    className="rounded bg-marca px-4 py-2 text-sm text-white hover:bg-marca-osc">Guardar</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: Estados ═══ */}
      {tab === 'estados' && (
        <div className="space-y-6">
          <p className="text-sm text-slate-500">
            Configura los estados disponibles para requerimientos y entregas. Los cambios se reflejan
            automáticamente al crear o editar requerimientos.
          </p>

          {estAviso && <div className="rounded bg-red-50 p-2 text-sm text-red-700">{estAviso}</div>}
          {estOk && <div className="rounded bg-emerald-50 p-2 text-sm text-emerald-700">{estOk}</div>}

          {/* Estados de Requerimiento */}
          <div className="rounded-xl border bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Estados de Requerimiento
            </h2>
            <div className="mb-3 flex flex-wrap gap-2">
              {estReq.map((e) => (
                <span key={e} className="inline-flex items-center gap-1 rounded-full bg-marca/10 px-3 py-1 text-sm font-medium text-marca-osc">
                  {e}
                  <button onClick={() => quitarEstadoReq(e)} className="ml-1 text-red-400 hover:text-red-600" title="Quitar">✕</button>
                </span>
              ))}
              {estReq.length === 0 && <span className="text-sm text-slate-400">Sin estados configurados</span>}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={nuevoEstReq}
                onChange={(e) => setNuevoEstReq(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), agregarEstadoReq())}
                placeholder="Nuevo estado (ej: EN REVISION)"
                className="rounded border px-3 py-2 text-sm w-72"
              />
              <button onClick={agregarEstadoReq} className="rounded bg-marca px-3 py-2 text-sm text-white hover:bg-marca-osc">
                Agregar
              </button>
            </div>
          </div>

          {/* Estados de Entrega */}
          <div className="rounded-xl border bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Estados de Entrega
            </h2>
            <div className="mb-3 flex flex-wrap gap-2">
              {estEnt.map((e) => (
                <span key={e} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-800">
                  {e}
                  <button onClick={() => quitarEstadoEnt(e)} className="ml-1 text-red-400 hover:text-red-600" title="Quitar">✕</button>
                </span>
              ))}
              {estEnt.length === 0 && <span className="text-sm text-slate-400">Sin estados configurados</span>}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={nuevoEstEnt}
                onChange={(e) => setNuevoEstEnt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), agregarEstadoEnt())}
                placeholder="Nuevo estado (ej: EN GARANTIA)"
                className="rounded border px-3 py-2 text-sm w-72"
              />
              <button onClick={agregarEstadoEnt} className="rounded bg-marca px-3 py-2 text-sm text-white hover:bg-marca-osc">
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
