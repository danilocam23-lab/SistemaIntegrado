import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import client from '../api/client'
import { mensajeError, useLista } from '../api/hooks'
import { ESTADOS_ENTREGA, ESTADOS_REQUERIMIENTO, ENTREGAS_ACTAS_CONFIG_CLAVES, ENTREGAS_ACTAS_COLUMNAS, ENTREGAS_ACTAS_FILTROS, REQUERIMIENTOS_CONFIG_CLAVES, REQUERIMIENTOS_COLUMNAS, REQUERIMIENTOS_FILTROS, leerCamposActivos } from '../constantes'
import type { EntregasActasCampo } from '../constantes'
import type { Configuracion as Config, Festivo, Tarifa, Categoria } from '../types'

type Tab = 'tarifas' | 'categorias' | 'roles' | 'tipos_contratacion' | 'festivos' | 'parametros' | 'estados' | 'entregas_actas' | 'requerimientos'

/** Agrupa una lista de campos configurables por su `grupo`, en un orden fijo legible. */
function agruparCampos(campos: EntregasActasCampo[]): { grupo: string; items: EntregasActasCampo[] }[] {
  const orden = ['Entrega', 'Requerimiento', 'Solicitud', 'Facturación']
  const mapa = new Map<string, EntregasActasCampo[]>()
  for (const c of campos) {
    if (!mapa.has(c.grupo)) mapa.set(c.grupo, [])
    mapa.get(c.grupo)?.push(c)
  }
  return orden.filter((g) => mapa.has(g)).map((g) => ({ grupo: g, items: mapa.get(g) ?? [] }))
}

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
  const rolesRef = useRef<string[]>([])
  const colaRolesRef = useRef<Promise<void>>(Promise.resolve())

  // ── Tipos de contratación ──
  const [tiposContratacion, setTiposContratacion] = useState<string[]>([])
  const [nuevoTipoContratacion, setNuevoTipoContratacion] = useState('')
  const tiposContratacionRef = useRef<string[]>([])
  const colaTiposContratacionRef = useRef<Promise<void>>(Promise.resolve())

  // ── Festivos ──
  const [festFecha, setFestFecha] = useState('')

  useEffect(() => {
    client.get<string[]>('/personas/roles').then((r) => {
      rolesRef.current = r.data
      setRoles(r.data)
    }).catch(() => {})
    client.get<string[]>('/personas/tipos-contratacion').then((r) => {
      tiposContratacionRef.current = r.data
      setTiposContratacion(r.data)
    }).catch(() => {})
  }, [])

  async function guardarRoles(lista: string[]): Promise<void> {
    setAviso('')
    setOk('')
    try {
      await client.put('/configuracion/roles_persona', {
        valor: lista.join(','),
        grupo: 'personas',
      })
      rolesRef.current = lista
      setRoles(lista)
      setOk('Roles guardados.')
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  // Encola las operaciones para evitar condiciones de carrera: cada cambio
  // parte siempre de la última lista confirmada por el servidor (rolesRef),
  // nunca de un estado local potencialmente desactualizado.
  function encolarRoles(calcular: (actual: string[]) => string[]): void {
    colaRolesRef.current = colaRolesRef.current.then(() => guardarRoles(calcular(rolesRef.current)))
  }

  function agregarRol(): void {
    const r = nuevoRol.trim().toUpperCase()
    if (!r) return
    setNuevoRol('')
    encolarRoles((actual) => (actual.includes(r) ? actual : [...actual, r]))
  }

  function quitarRol(rol: string): void {
    encolarRoles((actual) => actual.filter((r) => r !== rol))
  }

  async function guardarTiposContratacion(lista: string[]): Promise<void> {
    setAviso('')
    setOk('')
    try {
      await client.put('/configuracion/tipos_contratacion', {
        valor: lista.join(','),
        grupo: 'personas',
      })
      tiposContratacionRef.current = lista
      setTiposContratacion(lista)
      setOk('Tipos de contratación guardados.')
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  // Misma protección contra condiciones de carrera que en encolarRoles.
  function encolarTiposContratacion(calcular: (actual: string[]) => string[]): void {
    colaTiposContratacionRef.current = colaTiposContratacionRef.current.then(() =>
      guardarTiposContratacion(calcular(tiposContratacionRef.current)),
    )
  }

  function agregarTipoContratacion(): void {
    const t = nuevoTipoContratacion.trim().toUpperCase()
    if (!t) return
    setNuevoTipoContratacion('')
    encolarTiposContratacion((actual) => (actual.includes(t) ? actual : [...actual, t]))
  }

  function quitarTipoContratacion(tipo: string): void {
    encolarTiposContratacion((actual) => actual.filter((t) => t !== tipo))
  }


  async function crearFestivo(e: FormEvent): Promise<void> {
    e.preventDefault()
    setAviso('')
    setOk('')
    try {
      await client.post('/festivos', {
        fecha: festFecha,
      })
      setFestFecha('')
      recargarFestivos()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  async function eliminarFestivo(f: Festivo): Promise<void> {
    await client.delete(`/festivos/${f.id}`)
    recargarFestivos()
  }

  const festivosAgrupados = useMemo(() => {
    const grupos = new Map<string, Festivo[]>()
    for (const festivo of festivos) {
      const fecha = (festivo.fecha ?? '').slice(0, 10)
      const clave = fecha ? fecha.slice(0, 7) : 'sin-fecha'
      if (!grupos.has(clave)) grupos.set(clave, [])
      grupos.get(clave)?.push(festivo)
    }

    return Array.from(grupos.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([clave, items]) => {
        const [anio, mes] = clave.split('-')
        const fechaMes = anio && mes ? new Date(Number(anio), Number(mes) - 1, 1) : null
        const tituloBase = fechaMes
          ? fechaMes.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
          : 'Sin fecha'
        const titulo = tituloBase.charAt(0).toUpperCase() + tituloBase.slice(1)
        return {
          clave,
          titulo,
          items: items.slice().sort((a, b) => a.fecha.localeCompare(b.fecha)),
        }
      })
  }, [festivos])

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

  // ── Estado: Entregas de Actas (columnas, filtros y campos de exportación) ──
  const [eaColumnas, setEaColumnas] = useState<Set<string>>(new Set(ENTREGAS_ACTAS_COLUMNAS.map((c) => c.key)))
  const [eaFiltros, setEaFiltros] = useState<Set<string>>(new Set(ENTREGAS_ACTAS_FILTROS.map((f) => f.key)))
  const [eaExport, setEaExport] = useState<Set<string>>(new Set(ENTREGAS_ACTAS_COLUMNAS.map((c) => c.key)))
  const [eaAviso, setEaAviso] = useState('')
  const [eaOk, setEaOk] = useState('')

  useEffect(() => {
    setEaColumnas(leerCamposActivos(datos, ENTREGAS_ACTAS_CONFIG_CLAVES.columnas, ENTREGAS_ACTAS_COLUMNAS))
    setEaFiltros(leerCamposActivos(datos, ENTREGAS_ACTAS_CONFIG_CLAVES.filtros, ENTREGAS_ACTAS_FILTROS))
    setEaExport(leerCamposActivos(datos, ENTREGAS_ACTAS_CONFIG_CLAVES.exportCampos, ENTREGAS_ACTAS_COLUMNAS))
  }, [datos])

  async function guardarCamposEntregasActas(clave: string, keys: string[]): Promise<void> {
    setEaAviso('')
    setEaOk('')
    try {
      await client.put(`/configuracion/${encodeURIComponent(clave)}`, {
        valor: JSON.stringify(keys),
        grupo: 'entregas_actas',
      })
      setEaOk('Configuración guardada.')
      recargar()
    } catch (err) {
      setEaAviso(mensajeError(err))
    }
  }

  function alternarEaColumna(key: string): void {
    const nueva = new Set(eaColumnas)
    if (nueva.has(key)) nueva.delete(key)
    else nueva.add(key)
    setEaColumnas(nueva)
    void guardarCamposEntregasActas(ENTREGAS_ACTAS_CONFIG_CLAVES.columnas, Array.from(nueva))
  }

  function alternarEaFiltro(key: string): void {
    const nueva = new Set(eaFiltros)
    if (nueva.has(key)) nueva.delete(key)
    else nueva.add(key)
    setEaFiltros(nueva)
    void guardarCamposEntregasActas(ENTREGAS_ACTAS_CONFIG_CLAVES.filtros, Array.from(nueva))
  }

  function alternarEaExport(key: string): void {
    const nueva = new Set(eaExport)
    if (nueva.has(key)) nueva.delete(key)
    else nueva.add(key)
    setEaExport(nueva)
    void guardarCamposEntregasActas(ENTREGAS_ACTAS_CONFIG_CLAVES.exportCampos, Array.from(nueva))
  }

  // ── Estado: Requerimientos (columnas, filtros y campos de exportación) ──
  const [reqColumnas, setReqColumnas] = useState<Set<string>>(new Set(REQUERIMIENTOS_COLUMNAS.map((c) => c.key)))
  const [reqFiltros, setReqFiltros] = useState<Set<string>>(new Set(REQUERIMIENTOS_FILTROS.map((f) => f.key)))
  const [reqExport, setReqExport] = useState<Set<string>>(new Set(REQUERIMIENTOS_COLUMNAS.map((c) => c.key)))
  const [reqAviso, setReqAviso] = useState('')
  const [reqOk, setReqOk] = useState('')

  useEffect(() => {
    setReqColumnas(leerCamposActivos(datos, REQUERIMIENTOS_CONFIG_CLAVES.columnas, REQUERIMIENTOS_COLUMNAS))
    setReqFiltros(leerCamposActivos(datos, REQUERIMIENTOS_CONFIG_CLAVES.filtros, REQUERIMIENTOS_FILTROS))
    setReqExport(leerCamposActivos(datos, REQUERIMIENTOS_CONFIG_CLAVES.exportCampos, REQUERIMIENTOS_COLUMNAS))
  }, [datos])

  async function guardarCamposRequerimientos(clave: string, keys: string[]): Promise<void> {
    setReqAviso('')
    setReqOk('')
    try {
      await client.put(`/configuracion/${encodeURIComponent(clave)}`, {
        valor: JSON.stringify(keys),
        grupo: 'requerimientos',
      })
      setReqOk('Configuración guardada.')
      recargar()
    } catch (err) {
      setReqAviso(mensajeError(err))
    }
  }

  function alternarReqColumna(key: string): void {
    const nueva = new Set(reqColumnas)
    if (nueva.has(key)) nueva.delete(key)
    else nueva.add(key)
    setReqColumnas(nueva)
    void guardarCamposRequerimientos(REQUERIMIENTOS_CONFIG_CLAVES.columnas, Array.from(nueva))
  }

  function alternarReqFiltro(key: string): void {
    const nueva = new Set(reqFiltros)
    if (nueva.has(key)) nueva.delete(key)
    else nueva.add(key)
    setReqFiltros(nueva)
    void guardarCamposRequerimientos(REQUERIMIENTOS_CONFIG_CLAVES.filtros, Array.from(nueva))
  }

  function alternarReqExport(key: string): void {
    const nueva = new Set(reqExport)
    if (nueva.has(key)) nueva.delete(key)
    else nueva.add(key)
    setReqExport(nueva)
    void guardarCamposRequerimientos(REQUERIMIENTOS_CONFIG_CLAVES.exportCampos, Array.from(nueva))
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
          { id: 'tipos_contratacion', label: '📄 Tipo de contratación' },
          { id: 'festivos',   label: '📅 Festivos' },
          { id: 'parametros', label: '⚙️ Parámetros' },
          { id: 'estados',    label: '🔖 Estados' },
          { id: 'entregas_actas', label: '📋 Entregas de Actas' },
          { id: 'requerimientos', label: '🧾 Requerimientos' },
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

      {/* ═══ TAB: Tipo de contratación ═══ */}
      {tab === 'tipos_contratacion' && (
        <div className="rounded-xl border bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Tipos de contratación</h2>
          <div className="mb-3 flex flex-wrap gap-2">
            {tiposContratacion.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-marca/10 px-3 py-1 text-sm font-medium text-marca-osc">
                {t}
                <button onClick={() => quitarTipoContratacion(t)} className="ml-1 text-red-400 hover:text-red-600" title="Quitar">✕</button>
              </span>
            ))}
            {tiposContratacion.length === 0 && <span className="text-sm text-slate-400">Sin tipos de contratación configurados</span>}
          </div>
          <div className="flex items-center gap-2">
            <input value={nuevoTipoContratacion} onChange={(e) => setNuevoTipoContratacion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), agregarTipoContratacion())}
              placeholder="Nuevo tipo (ej: TERMINO FIJO)" className="rounded border px-3 py-2 text-sm" />
            <button onClick={agregarTipoContratacion} className="rounded bg-marca px-3 py-2 text-sm text-white hover:bg-marca-osc">Agregar</button>
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
            <button className="rounded bg-marca px-3 py-2 text-sm text-white hover:bg-marca-osc">+ Agregar</button>
          </form>
          <div className="space-y-3">
            {festivosAgrupados.map((grupo) => (
              <div key={grupo.clave}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{grupo.titulo}</h3>
                <ul className="flex flex-wrap gap-2">
                  {grupo.items.map((f) => (
                    <li key={f.id} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm">
                      <span className="font-medium">{f.fecha?.slice(0, 10)}</span>
                      <button onClick={() => eliminarFestivo(f)} className="text-red-400 hover:text-red-600" title="Quitar">✕</button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {festivos.length === 0 && <div className="text-sm text-slate-400">Sin festivos registrados</div>}
          </div>
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

      {/* ═══ TAB: Entregas de Actas ═══ */}
      {tab === 'entregas_actas' && (
        <div className="space-y-6">
          <p className="text-sm text-slate-500">
            Activa o desactiva, sin necesidad de desarrollo, las columnas visibles en la tabla, los
            filtros de búsqueda disponibles y los campos incluidos al exportar a Excel en la vista
            "Entregas de Actas".
          </p>

          {eaAviso && <div className="rounded bg-red-50 p-2 text-sm text-red-700">{eaAviso}</div>}
          {eaOk && <div className="rounded bg-emerald-50 p-2 text-sm text-emerald-700">{eaOk}</div>}

          {/* Columnas de la tabla */}
          <div className="rounded-xl border bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Columnas de la tabla
            </h2>
            <div className="space-y-4">
              {agruparCampos(ENTREGAS_ACTAS_COLUMNAS).map(({ grupo, items }) => (
                <div key={grupo}>
                  <h3 className="mb-2 text-xs font-semibold text-slate-400">{grupo}</h3>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {items.map((c) => (
                      <label key={c.key} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={eaColumnas.has(c.key)}
                          onChange={() => alternarEaColumna(c.key)}
                        />
                        {c.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Filtros de búsqueda */}
          <div className="rounded-xl border bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Filtros de búsqueda
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {ENTREGAS_ACTAS_FILTROS.map((f) => (
                <label key={f.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={eaFiltros.has(f.key)}
                    onChange={() => alternarEaFiltro(f.key)}
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </div>

          {/* Campos de exportación a Excel */}
          <div className="rounded-xl border bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Campos incluidos al exportar a Excel
            </h2>
            <div className="space-y-4">
              {agruparCampos(ENTREGAS_ACTAS_COLUMNAS).map(({ grupo, items }) => (
                <div key={grupo}>
                  <h3 className="mb-2 text-xs font-semibold text-slate-400">{grupo}</h3>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {items.map((c) => (
                      <label key={c.key} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={eaExport.has(c.key)}
                          onChange={() => alternarEaExport(c.key)}
                        />
                        {c.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB: Requerimientos ═══ */}
      {tab === 'requerimientos' && (
        <div className="space-y-6">
          <p className="text-sm text-slate-500">
            Activa o desactiva, sin necesidad de desarrollo, las columnas visibles en la tabla principal,
            los filtros de búsqueda disponibles y los campos incluidos al exportar a Excel en la vista
            "Requerimientos". Las columnas de acciones (expandir, estimación, editar/eliminar) no son
            configurables porque son funcionales.
          </p>

          {reqAviso && <div className="rounded bg-red-50 p-2 text-sm text-red-700">{reqAviso}</div>}
          {reqOk && <div className="rounded bg-emerald-50 p-2 text-sm text-emerald-700">{reqOk}</div>}

          {/* Columnas de la tabla */}
          <div className="rounded-xl border bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Columnas de la tabla
            </h2>
            <div className="space-y-4">
              {agruparCampos(REQUERIMIENTOS_COLUMNAS).map(({ grupo, items }) => (
                <div key={grupo}>
                  <h3 className="mb-2 text-xs font-semibold text-slate-400">{grupo}</h3>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {items.map((c) => (
                      <label key={c.key} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={reqColumnas.has(c.key)}
                          onChange={() => alternarReqColumna(c.key)}
                        />
                        {c.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Filtros de búsqueda */}
          <div className="rounded-xl border bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Filtros de búsqueda
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {REQUERIMIENTOS_FILTROS.map((f) => (
                <label key={f.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={reqFiltros.has(f.key)}
                    onChange={() => alternarReqFiltro(f.key)}
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </div>

          {/* Campos de exportación a Excel */}
          <div className="rounded-xl border bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Campos incluidos al exportar a Excel
            </h2>
            <div className="space-y-4">
              {agruparCampos(REQUERIMIENTOS_COLUMNAS).map(({ grupo, items }) => (
                <div key={grupo}>
                  <h3 className="mb-2 text-xs font-semibold text-slate-400">{grupo}</h3>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {items.map((c) => (
                      <label key={c.key} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={reqExport.has(c.key)}
                          onChange={() => alternarReqExport(c.key)}
                        />
                        {c.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
