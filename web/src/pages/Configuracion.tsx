import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import client from '../api/client'
import { mensajeError, useLista } from '../api/hooks'
import { ENTREGAS_ACTAS_CONFIG_CLAVES, ENTREGAS_ACTAS_COLUMNAS, ENTREGAS_ACTAS_FILTROS, REQUERIMIENTOS_CONFIG_CLAVES, REQUERIMIENTOS_COLUMNAS, REQUERIMIENTOS_FILTROS } from '../constantes'
import type { Configuracion as Config, Festivo } from '../types'
import { TablaScroll } from '../components/ui/primitivos'
import { SeccionCargaExcel } from './configuracion/SeccionCargaExcel'
import { SeccionCamposConfigurables } from './configuracion/SeccionCamposConfigurables'
import { SeccionCategorias } from './configuracion/SeccionCategorias'
import { SeccionEstados } from './configuracion/SeccionEstados'
import { SeccionTarifas } from './configuracion/SeccionTarifas'
import { PESTANAS } from './configuracion/tipos'
import type { Tab } from './configuracion/tipos'
import { useCargaExcel } from './configuracion/useCargaExcel'
import { useCamposConfigurables } from './configuracion/useCamposConfigurables'
import { useCategorias } from './configuracion/useCategorias'
import { useDatosConfiguracion } from './configuracion/useDatosConfiguracion'
import { useEstadosConfigurables } from './configuracion/useEstadosConfigurables'
import { useTarifas } from './configuracion/useTarifas'

export default function Configuracion() {
  const [tab, setTab] = useState<Tab>('tarifas')

  const { datos, error, recargar } = useDatosConfiguracion()
  const { datos: festivos, recargar: recargarFestivos } = useLista<Festivo>('/festivos')
  // INVARIANTE 1: todos los hooks de seccion se invocan sin condicion; solo el JSX depende de tab.
  const tarifasState = useTarifas()
  const categoriasState = useCategorias()
  const estadosState = useEstadosConfigurables({ datos, recargar })
  const entregasActasState = useCamposConfigurables({
    datos,
    recargar,
    configClaves: ENTREGAS_ACTAS_CONFIG_CLAVES,
    columnasCatalogo: ENTREGAS_ACTAS_COLUMNAS,
    filtrosCatalogo: ENTREGAS_ACTAS_FILTROS,
    grupo: 'entregas_actas',
  })
  const requerimientosState = useCamposConfigurables({
    datos,
    recargar,
    configClaves: REQUERIMIENTOS_CONFIG_CLAVES,
    columnasCatalogo: REQUERIMIENTOS_COLUMNAS,
    filtrosCatalogo: REQUERIMIENTOS_FILTROS,
    grupo: 'requerimientos',
  })
  const cargaExcelState = useCargaExcel({ datos, recargar })
  const [valores, setValores] = useState<Record<string, string>>({})
  const [nuevaClave, setNuevaClave] = useState('')
  const [nuevoValor, setNuevoValor] = useState('')
  const [grupo, setGrupo] = useState('general')
  const [aviso, setAviso] = useState('')
  const [ok, setOk] = useState('')

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

  return (
    <div>
      <h1 className="titulo-pagina mb-4">Configuración</h1>

      {/* ═══ Tabs ═══ */}
      <div className="pestanas mb-6">
        {PESTANAS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`pestana ${tab === id ? 'pestana-activa' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ═══ TAB: Tarifas ═══ */}
      {tab === 'tarifas' && <SeccionTarifas {...tarifasState} />}

      {/* ═══ TAB: Categorías ═══ */}
      {tab === 'categorias' && <SeccionCategorias {...categoriasState} />}

      {/* ═══ TAB: Roles ═══ */}
      {tab === 'roles' && (
        <div className="tarjeta tarjeta-pad">
          <h2 className="etiqueta-sup mb-3">Roles de personas</h2>
          <div className="mb-3 flex flex-wrap gap-2">
            {roles.map((r) => (
              <span key={r} className="chip chip-marca">
                {r}
                <button onClick={() => quitarRol(r)} className="enlace-accion enlace-accion-peligro ml-1" title="Quitar">✕</button>
              </span>
            ))}
            {roles.length === 0 && <span className="text-sm text-slate-400">Sin roles configurados</span>}
          </div>
          <div className="flex items-center gap-2">
            <input value={nuevoRol} onChange={(e) => setNuevoRol(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), agregarRol())}
              placeholder="Nuevo rol (ej: QA)" className="campo" />
            <button onClick={agregarRol} className="btn btn-primario btn-sm">Agregar</button>
          </div>
          {ok && <div className="aviso aviso-exito mt-3">{ok}</div>}
        </div>
      )}

      {/* ═══ TAB: Tipo de contratación ═══ */}
      {tab === 'tipos_contratacion' && (
        <div className="tarjeta tarjeta-pad">
          <h2 className="etiqueta-sup mb-3">Tipos de contratación</h2>
          <div className="mb-3 flex flex-wrap gap-2">
            {tiposContratacion.map((t) => (
              <span key={t} className="chip chip-marca">
                {t}
                <button onClick={() => quitarTipoContratacion(t)} className="enlace-accion enlace-accion-peligro ml-1" title="Quitar">✕</button>
              </span>
            ))}
            {tiposContratacion.length === 0 && <span className="text-sm text-slate-400">Sin tipos de contratación configurados</span>}
          </div>
          <div className="flex items-center gap-2">
            <input value={nuevoTipoContratacion} onChange={(e) => setNuevoTipoContratacion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), agregarTipoContratacion())}
              placeholder="Nuevo tipo (ej: TERMINO FIJO)" className="campo" />
            <button onClick={agregarTipoContratacion} className="btn btn-primario btn-sm">Agregar</button>
          </div>
          {ok && <div className="aviso aviso-exito mt-3">{ok}</div>}
        </div>
      )}

      {/* ═══ TAB: Festivos ═══ */}
      {tab === 'festivos' && (
        <div className="tarjeta tarjeta-pad">
          <h2 className="etiqueta-sup mb-1">Festivos</h2>
          <p className="mb-3 text-xs text-slate-500">Se usan para el cálculo de ANS por días hábiles.</p>
          <form onSubmit={crearFestivo} className="mb-3 flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Fecha</span>
              <input value={festFecha} onChange={(e) => setFestFecha(e.target.value)} type="date" required
                className="campo" />
            </label>
            <button className="btn btn-primario btn-sm">+ Agregar</button>
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
          {(aviso || error) && <div className="aviso aviso-error mt-3">{aviso || error}</div>}
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
          <form onSubmit={crear} className="barra-filtros mb-4">
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Clave</span>
              <input value={nuevaClave} onChange={(e) => setNuevaClave(e.target.value)} required
                className="campo" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Valor</span>
              <input value={nuevoValor} onChange={(e) => setNuevoValor(e.target.value)}
                className="campo" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Grupo</span>
              <input value={grupo} onChange={(e) => setGrupo(e.target.value)}
                className="campo" />
            </label>
            <button className="btn btn-primario">Agregar / actualizar</button>
          </form>

          {(aviso || error) && <div className="aviso aviso-error mb-3">{aviso || error}</div>}
          {ok && <div className="aviso aviso-exito mb-3">{ok}</div>}

          <TablaScroll>
          <table className="text-sm">
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
                      className="campo campo-sm w-full"
                    />
                  </td>
                  <td className="p-2 text-center">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => guardar(c)} className="enlace-accion">Guardar</button>
                      <button onClick={() => abrirEdicion(c)} className="enlace-accion enlace-accion-alerta">Editar</button>
                      <button onClick={() => void eliminarParametro(c)} className="enlace-accion enlace-accion-peligro">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
              {datos.length === 0 && (
                <tr><td colSpan={4} className="p-4 text-center text-slate-400">Sin parámetros.</td></tr>
              )}
            </tbody>
          </table>
          </TablaScroll>

          {/* Modal edición parámetro */}
          {editItem && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
              onClick={() => setEditItem(null)}>
              <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
                onClick={(e) => e.stopPropagation()}>
                <h2 className="titulo-seccion mb-4">Editar parámetro</h2>
                <div className="mb-3">
                  <label className="mb-1 block text-sm text-slate-600">Clave</label>
                  <input value={editClave} onChange={(e) => setEditClave(e.target.value)}
                    className="campo w-full" />
                </div>
                <div className="mb-3">
                  <label className="mb-1 block text-sm text-slate-600">Grupo</label>
                  <input value={editGrupo} onChange={(e) => setEditGrupo(e.target.value)}
                    className="campo w-full" />
                </div>
                <div className="mb-4">
                  <label className="mb-1 block text-sm text-slate-600">Valor</label>
                  <textarea value={editValor} onChange={(e) => setEditValor(e.target.value)}
                    rows={3} className="campo w-full" />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditItem(null)}
                    className="btn btn-secundario">Cancelar</button>
                  <button onClick={guardarEdicion}
                    className="btn btn-primario">Guardar</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: Estados ═══ */}
      {tab === 'estados' && <SeccionEstados {...estadosState} />}


      {/* ═══ TAB: Entregas de Actas ═══ */}
      {tab === 'entregas_actas' && (
        <SeccionCamposConfigurables
          {...entregasActasState}
          descripcion={(
            <p className="text-sm text-slate-500">
              Activa o desactiva, sin necesidad de desarrollo, las columnas visibles en la tabla, los
              filtros de búsqueda disponibles y los campos incluidos al exportar a Excel en la vista
              "Entregas de Actas".
            </p>
          )}
          columnasCatalogo={ENTREGAS_ACTAS_COLUMNAS}
          filtrosCatalogo={ENTREGAS_ACTAS_FILTROS}
        />
      )}


      {/* ═══ TAB: Requerimientos ═══ */}
      {tab === 'requerimientos' && (
        <SeccionCamposConfigurables
          {...requerimientosState}
          descripcion={(
            <p className="text-sm text-slate-500">
              Activa o desactiva, sin necesidad de desarrollo, las columnas visibles en la tabla principal,
              los filtros de búsqueda disponibles y los campos incluidos al exportar a Excel en la vista
              "Requerimientos". Las columnas de acciones (expandir, estimación, editar/eliminar) no son
              configurables porque son funcionales.
            </p>
          )}
          columnasCatalogo={REQUERIMIENTOS_COLUMNAS}
          filtrosCatalogo={REQUERIMIENTOS_FILTROS}
        />
      )}


      {/* ═══ TAB: Carga de Excel ═══ */}
      {tab === 'carga_excel' && <SeccionCargaExcel {...cargaExcelState} />}

    </div>
  )
}
