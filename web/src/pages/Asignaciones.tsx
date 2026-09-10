import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent, MouseEvent as ReactMouseEvent } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client'
import { mensajeError } from '../api/hooks'
import { useAplicacion } from '../context/AplicacionContext'
import { useAuth } from '../context/AuthContext'
import { TablaScroll } from '../components/ui/primitivos'
import { cabecerasAplicacion } from '../utilidades/aplicacion'
import { claseBadgeEstado } from './asignaciones/estados'
import type { AsignacionItem, OpcionReq } from './asignaciones/tipos'
import { useDatosAsignaciones } from './asignaciones/useDatosAsignaciones'
import { useDerivadosAsignaciones } from './asignaciones/useDerivadosAsignaciones'
import { useWorkOrdersPorPersona } from './asignaciones/useWorkOrdersPorPersona'

export default function Asignaciones() {
  const { asignaciones, personas, categorias, requerimientos, configuraciones, capacidades, error, recargar } =
    useDatosAsignaciones()
  const { modoConsolidado, activa } = useAplicacion()
  const { tienePermiso } = useAuth()
  const { wosPorPersonaMap } = useWorkOrdersPorPersona(personas)

  const puedeEditarAsignaciones = tienePermiso('asignaciones.editar')

  const [editandoAsig, setEditandoAsig] = useState<AsignacionItem | null>(null)
  const [personaId, setPersonaId] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [porcentaje, setPorcentaje] = useState('')
  const [requerimientoId, setRequerimientoId] = useState('')
  const [aviso, setAviso] = useState('')
  const [busquedaReq, setBusquedaReq] = useState('')
  const [dropdownReqAbierto, setDropdownReqAbierto] = useState(false)
  const [gruposExpandidos, setGruposExpandidos] = useState<Set<string | null>>(new Set())
  const [edicionInlineId, setEdicionInlineId] = useState<string | null>(null)
  const [edicionInlineValor, setEdicionInlineValor] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<string>('__todos__')
  const [filtroPersona, setFiltroPersona] = useState<string>('__todos__')
  const [busquedaPersona, setBusquedaPersona] = useState('')
  const [vistaActiva, setVistaActiva] = useState<'actas' | 'personas'>('actas')
  const reqBoxRef = useRef<HTMLDivElement | null>(null)
  const autoFixedRef = useRef(false)
  const modoEdicion = editandoAsig !== null

  useEffect(() => {
    function cerrarDropdown(event: MouseEvent) {
      if (reqBoxRef.current && !reqBoxRef.current.contains(event.target as Node)) {
        setDropdownReqAbierto(false)
      }
    }

    document.addEventListener('mousedown', cerrarDropdown)
    return () => document.removeEventListener('mousedown', cerrarDropdown)
  }, [])

  const {
    personasDisponibles,
    personaPorId,
    categoriaPorId,
    reqIdsActivos,
    opcionesReq,
    etiquetaReq,
    capacidadUsada,
    calcularPctSugerido,
    gruposReq,
    estadosUnicos,
    gruposFiltrados,
    gruposPorPersona,
  } = useDerivadosAsignaciones({
    asignaciones,
    personas,
    categorias,
    requerimientos,
    configuraciones,
    capacidades,
    wosPorPersonaMap,
    filtroEstado,
    filtroPersona,
    busquedaPersona,
  })

  const opcionReqSeleccionada = useMemo(
    () => opcionesReq.find((opcion) => opcion.id === requerimientoId) ?? null,
    [opcionesReq, requerimientoId],
  )

  const opcionesReqFiltradas = useMemo(() => {
    const filtro = busquedaReq.trim().toLocaleLowerCase('es')
    const lista = filtro
      ? opcionesReq.filter((opcion) => opcion.label.toLocaleLowerCase('es').includes(filtro))
      : opcionesReq
    return lista.slice(0, 15)
  }, [busquedaReq, opcionesReq])

  const porcentajeSugerido = useMemo(
    () => (!modoEdicion && personaId ? calcularPctSugerido(personaId) : ''),
    [calcularPctSugerido, modoEdicion, personaId],
  )

  const [personasExpandidas, setPersonasExpandidas] = useState<Set<string>>(new Set())

  useEffect(() => {
    setGruposExpandidos(new Set(gruposReq.map((grupo) => grupo.reqId)))
  }, [gruposReq])

  const limpiarFormulario = useCallback(() => {
    setEditandoAsig(null)
    setPersonaId('')
    setCategoriaId('')
    setPorcentaje('')
    setRequerimientoId('')
    setBusquedaReq('')
    setDropdownReqAbierto(false)
    setAviso('')
  }, [])

  const resolverAppCreacion = useCallback(() => {
    if (opcionReqSeleccionada?.aplicacionId) return opcionReqSeleccionada.aplicacionId
    if (modoConsolidado) return ''
    return activa
  }, [activa, modoConsolidado, opcionReqSeleccionada])

  const resolverAppAsignacion = useCallback((asig: AsignacionItem) => {
    if (asig.aplicacion_id) return asig.aplicacion_id
    const reqId = asig.proyectos.find((p) => p.requerimiento_id)?.requerimiento_id
    const req = reqId ? requerimientos.find((item) => item.id === reqId) : null
    return req?.aplicacion_id ?? activa
  }, [activa, requerimientos])

  const abrirEdicion = useCallback((asig: AsignacionItem) => {
    if (!puedeEditarAsignaciones) return
    const primerReq = asig.proyectos.find((p) => p.requerimiento_id)?.requerimiento_id ?? ''
    setEditandoAsig(asig)
    setPersonaId(asig.persona_id)
    setCategoriaId(asig.categoria_id)
    setPorcentaje(String(asig.total_porcentaje))
    setRequerimientoId(primerReq)
    setBusquedaReq(primerReq ? etiquetaReq(primerReq) : '')
    setDropdownReqAbierto(false)
    setAviso('')
    setEdicionInlineId(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [etiquetaReq, puedeEditarAsignaciones])

  const seleccionarReq = useCallback((opcion: OpcionReq) => {
    setRequerimientoId(opcion.id)
    setBusquedaReq(opcion.label)
    setDropdownReqAbierto(false)
    // Si el requerimiento tiene un analista de requerimientos configurado y aún no se
    // eligió una persona, se preselecciona ese analista con 0% de carga, para dejarlo
    // asignado de una vez mientras luego se le define la capacidad/porcentaje real.
    if (!modoEdicion && !personaId) {
      const req = requerimientos.find((r) => r.id === opcion.id)
      const analistaId = req?.solicitud?.analista_requerimientos_id
      if (analistaId) {
        setPersonaId(analistaId)
        setPorcentaje('0')
      }
    }
  }, [modoEdicion, personaId, requerimientos])

  const cambiarBusquedaReq = useCallback((value: string) => {
    setBusquedaReq(value)
    setDropdownReqAbierto(true)
    if (!value.trim()) setRequerimientoId('')
    else if (opcionReqSeleccionada?.label !== value) setRequerimientoId('')
  }, [opcionReqSeleccionada])

  const validarCapacidad = useCallback((pid: string, nuevoPct: number, excluyendoId?: string) => {
    const usado = capacidadUsada(pid, excluyendoId)
    if (usado + nuevoPct > 100) {
      setAviso(`La persona ya tiene ${usado}% asignado en requerimientos activos. Agregar ${nuevoPct}% superaría el 100%.`)
      return false
    }
    return true
  }, [capacidadUsada])

  /** Actualiza el % de todas las asignaciones activas de una persona a distribución equitativa */
  const redistribuirPct = useCallback(async (pid: string, excluyendoId?: string) => {
    const activas = asignaciones.filter((a) =>
      a.persona_id === pid &&
      a.id !== excluyendoId &&
      a.proyectos.some((p) => p.requerimiento_id && reqIdsActivos.has(p.requerimiento_id)),
    )
    if (activas.length === 0) return
    const pct = Math.round(100 / activas.length)
    await Promise.allSettled(
      activas.map((a) =>
        client.put(
          `/asignaciones/${a.id}`,
          { persona_id: a.persona_id, categoria_id: a.categoria_id, total_porcentaje: pct,
            estado: a.estado ?? 'active', activo: a.activo ?? true, proyectos: a.proyectos },
          cabecerasAplicacion(resolverAppAsignacion(a)),
        )
      ),
    )
  }, [asignaciones, reqIdsActivos, resolverAppAsignacion])

  // Al cargar, auto-corrige si alguna persona supera el 100%
  useEffect(() => {
    if (autoFixedRef.current || asignaciones.length === 0 || reqIdsActivos.size === 0) return
    const totalesPorPersona = new Map<string, number>()
    for (const a of asignaciones) {
      if (a.proyectos.some((p) => p.requerimiento_id && reqIdsActivos.has(p.requerimiento_id))) {
        totalesPorPersona.set(a.persona_id, (totalesPorPersona.get(a.persona_id) ?? 0) + a.total_porcentaje)
      }
    }
    const conExceso = [...totalesPorPersona.entries()]
      .filter(([, total]) => Math.round(total) > 100)
      .map(([pid]) => pid)
    autoFixedRef.current = true
    if (conExceso.length > 0) {
      Promise.allSettled(conExceso.map((pid) => redistribuirPct(pid)))
        .then(() => recargar())
        .catch(() => {})
    }
  }, [asignaciones, reqIdsActivos, redistribuirPct, recargar])

  const crear = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (!puedeEditarAsignaciones) return
    setAviso('')

    const nuevoPct = porcentaje ? Number(porcentaje) : 0
    if (!validarCapacidad(personaId, nuevoPct)) return

    const duplicado = requerimientoId && asignaciones.some((a) =>
      a.persona_id === personaId &&
      a.proyectos.some((p) => p.requerimiento_id === requerimientoId),
    )
    if (duplicado) {
      setAviso('Esta persona ya tiene una asignación para ese requerimiento')
      return
    }

    const aplicacionId = resolverAppCreacion()
    if (!aplicacionId) {
      setAviso('En modo consolidado debes seleccionar primero un requerimiento para crear la asignación.')
      return
    }

    try {
      // Usar el porcentaje ingresado por el usuario
      await client.post(
        '/asignaciones',
        {
          persona_id: personaId,
          categoria_id: categoriaId,
          total_porcentaje: nuevoPct,
          estado: 'active',
          activo: true,
          proyectos: requerimientoId
            ? [{ nombre: opcionReqSeleccionada?.label ?? '', estado: 'active', requerimiento_id: requerimientoId }]
            : [],
        },
        cabecerasAplicacion(aplicacionId),
      )
      limpiarFormulario()
      await recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }, [asignaciones, categoriaId, limpiarFormulario, opcionReqSeleccionada, personaId, porcentaje, puedeEditarAsignaciones, recargar, requerimientoId, reqIdsActivos, redistribuirPct, resolverAppCreacion, validarCapacidad])

  const actualizar = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (!puedeEditarAsignaciones) return
    if (!editandoAsig) return
    setAviso('')

    const nuevoPct = porcentaje ? Number(porcentaje) : 0
    if (!validarCapacidad(personaId, nuevoPct, editandoAsig.id)) return

    const aplicacionId = resolverAppAsignacion(editandoAsig)
    if (!aplicacionId) {
      setAviso('No fue posible determinar la aplicación de la asignación.')
      return
    }

    try {
      await client.put(
        `/asignaciones/${editandoAsig.id}`,
        {
          persona_id: personaId,
          categoria_id: categoriaId,
          total_porcentaje: nuevoPct,
          estado: editandoAsig.estado ?? 'active',
          activo: editandoAsig.activo ?? true,
          proyectos: requerimientoId
            ? [{ nombre: opcionReqSeleccionada?.label ?? etiquetaReq(requerimientoId), estado: 'active', requerimiento_id: requerimientoId }]
            : [],
        },
        cabecerasAplicacion(aplicacionId),
      )
      limpiarFormulario()
      await recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }, [categoriaId, editandoAsig, etiquetaReq, limpiarFormulario, opcionReqSeleccionada, personaId, porcentaje, puedeEditarAsignaciones, recargar, requerimientoId, resolverAppAsignacion, validarCapacidad])

  const eliminar = useCallback(async (asig: AsignacionItem) => {
    if (!puedeEditarAsignaciones) return
    if (!window.confirm('¿Eliminar esta asignación?')) return
    setAviso('')

    const aplicacionId = resolverAppAsignacion(asig)
    if (!aplicacionId) {
      setAviso('No fue posible determinar la aplicación de la asignación.')
      return
    }

    try {
      await client.delete(`/asignaciones/${asig.id}`, cabecerasAplicacion(aplicacionId))
      if (editandoAsig?.id === asig.id) limpiarFormulario()
      // Redistribuir % entre las asignaciones restantes
      await redistribuirPct(asig.persona_id, asig.id)
      await recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }, [editandoAsig?.id, limpiarFormulario, puedeEditarAsignaciones, recargar, redistribuirPct, resolverAppAsignacion])

  const iniciarEdicionInline = useCallback((asig: AsignacionItem) => {
    if (!puedeEditarAsignaciones) return
    setAviso('')
    setEdicionInlineId(asig.id)
    setEdicionInlineValor(String(asig.total_porcentaje))
  }, [puedeEditarAsignaciones])

  const cancelarEdicionInline = useCallback(() => {
    setEdicionInlineId(null)
    setEdicionInlineValor('')
  }, [])

  const guardarEdicionInline = useCallback(async (asig: AsignacionItem) => {
    if (!puedeEditarAsignaciones) return
    if (edicionInlineId !== asig.id) return

    const nuevoPct = edicionInlineValor ? Number(edicionInlineValor) : 0
    setAviso('')
    if (!validarCapacidad(asig.persona_id, nuevoPct, asig.id)) return

    const aplicacionId = resolverAppAsignacion(asig)
    if (!aplicacionId) {
      setAviso('No fue posible determinar la aplicación de la asignación.')
      return
    }

    try {
      await client.put(
        `/asignaciones/${asig.id}`,
        {
          persona_id: asig.persona_id,
          categoria_id: asig.categoria_id,
          total_porcentaje: nuevoPct,
          estado: asig.estado ?? 'active',
          activo: asig.activo ?? true,
          proyectos: asig.proyectos,
        },
        cabecerasAplicacion(aplicacionId),
      )
      cancelarEdicionInline()
      await recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }, [cancelarEdicionInline, edicionInlineId, edicionInlineValor, puedeEditarAsignaciones, recargar, resolverAppAsignacion, validarCapacidad])

  const cambiarPrioridad = useCallback(async (asig: AsignacionItem) => {
    if (!puedeEditarAsignaciones) return
    const aplicacionId = resolverAppAsignacion(asig)
    if (!aplicacionId) return
    try {
      await client.patch(`/asignaciones/${asig.id}/prioridad`, {}, cabecerasAplicacion(aplicacionId))
      await recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }, [puedeEditarAsignaciones, recargar, resolverAppAsignacion])

  const onPersonaChange = useCallback((value: string) => {
    setPersonaId(value)
    if (!modoEdicion) setPorcentaje(value ? calcularPctSugerido(value) : '')
  }, [calcularPctSugerido, modoEdicion])

  const alternarGrupo = useCallback((reqId: string | null) => {
    setGruposExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(reqId)) next.delete(reqId)
      else next.add(reqId)
      return next
    })
  }, [])

  const onReqHeaderClick = useCallback((event: ReactMouseEvent<HTMLButtonElement>, reqId: string | null) => {
    event.preventDefault()
    alternarGrupo(reqId)
  }, [alternarGrupo])

  const onInlineKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.currentTarget.blur()
    }
    if (event.key === 'Escape') cancelarEdicionInline()
  }, [cancelarEdicionInline])

  return (
    <div>
      <h1 className="titulo-pagina mb-4">Asignaciones de carga</h1>

      {puedeEditarAsignaciones && (
      <form onSubmit={modoEdicion ? actualizar : crear} className="mb-4 rounded-xl border bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-slate-600">
            {modoEdicion ? '✏️ Editando asignación' : 'Nueva asignación'}
          </span>
          {modoEdicion && (
            <button
              type="button"
              onClick={limpiarFormulario}
              className="enlace-accion-sutil"
            >
              Cancelar edición ✕
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Persona</span>
            <select
              value={personaId}
              onChange={(e) => onPersonaChange(e.target.value)}
              required
              className="campo"
            >
              <option value="">— Seleccionar —</option>
              {personasDisponibles.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Categoría</span>
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              required
              className="campo"
            >
              <option value="">— Seleccionar —</option>
              {categorias
                .slice()
                .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'))
                .map((categoria) => (
                  <option key={categoria.id} value={categoria.id}>
                    {categoria.nombre}
                  </option>
                ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-slate-600">% de carga</span>
            <input
              value={porcentaje}
              onChange={(e) => setPorcentaje(e.target.value)}
              type="number"
              min="0"
              max="100"
              required
              className="campo w-28"
            />
            {!modoEdicion && personaId && porcentaje === porcentajeSugerido && porcentaje && (
              <span className="mt-1 block text-xs text-emerald-700">{porcentajeSugerido}% (sugerido)</span>
            )}
          </label>

          <div ref={reqBoxRef} className="relative min-w-0 flex-1 basis-full text-sm sm:min-w-[320px]">
            <span className="mb-1 block text-slate-600">
              Requerimiento <span className="text-slate-400">(opcional)</span>
            </span>
            <input
              value={busquedaReq}
              onChange={(e) => cambiarBusquedaReq(e.target.value)}
              onFocus={() => setDropdownReqAbierto(true)}
              placeholder="Buscar SC - REQ - Nombre"
              className="campo w-full"
            />
            {busquedaReq && (
              <button
                type="button"
                onClick={() => {
                  setBusquedaReq('')
                  setRequerimientoId('')
                  setDropdownReqAbierto(false)
                }}
                className="absolute right-3 top-[34px] text-slate-400 hover:text-slate-700"
                aria-label="Limpiar requerimiento"
              >
                ✕
              </button>
            )}
            {dropdownReqAbierto && (
              <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border bg-white shadow-lg">
                {opcionesReqFiltradas.length > 0 ? (
                  opcionesReqFiltradas.map((opcion) => (
                    <button
                      key={opcion.id}
                      type="button"
                      onClick={() => seleccionarReq(opcion)}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 ${requerimientoId === opcion.id ? 'bg-marca/10 text-marca-osc' : ''}`}
                    >
                      <span className="truncate">{opcion.label}</span>
                      {opcion.estado && (
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${claseBadgeEstado(opcion.estado)}`}>
                          {opcion.estado.length > 20 ? opcion.estado.slice(0, 20) + '…' : opcion.estado}
                        </span>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-slate-500">Sin coincidencias.</div>
                )}
              </div>
            )}
          </div>

          <button
            disabled={!puedeEditarAsignaciones}
            className={`btn ${modoEdicion ? 'btn-exito' : 'btn-primario'}`}
          >
            {modoEdicion ? 'Actualizar' : 'Crear'}
          </button>
        </div>
      </form>
      )}

      {modoConsolidado && !requerimientoId && !modoEdicion && (
        <div className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          {'Modo consolidado: selecciona un requerimiento para crear la asignación en la aplicación correcta.'}
        </div>
      )}

      {(aviso || error) && (
        <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{aviso || error}</div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex items-center gap-1 rounded-lg border bg-slate-100 p-1 w-fit">
        <button type="button" onClick={() => setVistaActiva('actas')}
          className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${vistaActiva === 'actas' ? 'bg-white text-marca shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
          Por Actas / Requerimientos
        </button>
        <button type="button" onClick={() => setVistaActiva('personas')}
          className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${vistaActiva === 'personas' ? 'bg-white text-marca shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
          Por Personas
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-600">Filtrar por estado del requerimiento:</label>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="campo campo-sm"
          >
            <option value="__todos__">Todos</option>
            {estadosUnicos.map((estado) => (
              <option key={estado} value={estado}>{estado}</option>
            ))}
            <option value="__sin_estado__">Sin estado</option>
          </select>
          {filtroEstado !== '__todos__' && (
            <button
              type="button"
              onClick={() => setFiltroEstado('__todos__')}
              className="enlace-accion-sutil"
            >
              Limpiar ✕
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-600">Buscar persona:</label>
          <input
            type="text"
            value={busquedaPersona}
            onChange={(e) => setBusquedaPersona(e.target.value)}
            placeholder="Nombre de la persona…"
            className="campo campo-sm w-56"
          />
          <select
            value={filtroPersona}
            onChange={(e) => setFiltroPersona(e.target.value)}
            className="campo campo-sm"
          >
            <option value="__todos__">Todas</option>
            {personasDisponibles.map((persona) => (
              <option key={persona.id} value={persona.id}>{persona.nombre}</option>
            ))}
          </select>
          {(filtroPersona !== '__todos__' || busquedaPersona) && (
            <button
              type="button"
              onClick={() => { setFiltroPersona('__todos__'); setBusquedaPersona('') }}
              className="enlace-accion-sutil"
            >
              Limpiar ✕
            </button>
          )}
        </div>
      </div>

      {vistaActiva === 'actas' && (
      <div className="space-y-4">
        {gruposFiltrados.map((grupo) => {
          const expandido = gruposExpandidos.has(grupo.reqId)
          return (
            <section key={grupo.reqId ?? 'sin-requerimiento'} className="tarjeta overflow-hidden">
              <div className="flex items-center justify-between gap-3 bg-marca-osc px-4 py-3 text-white">
                <button
                  type="button"
                  onClick={(event) => onReqHeaderClick(event, grupo.reqId)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="text-sm">{expandido ? '▼' : '▶'}</span>
                  <span className="truncate text-sm font-semibold">{grupo.reqLabel}</span>
                  {grupo.reqId && (() => {
                    if (!grupo.horasEstimadas) return null
                    const horasReales = grupo.horasEstimadas * 0.9
                    return (
                      <div className="ml-4 flex shrink-0 items-center gap-4 border-l border-white/30 pl-4 text-xs font-medium">
                        <div>
                          <div className="text-white/70">Horas est.</div>
                          <div>{grupo.horasEstimadas.toFixed(1)} h</div>
                        </div>
                        <div>
                          <div className="text-white/70">Horas reales (90%)</div>
                          <div>{horasReales.toFixed(1)} h</div>
                        </div>
                      </div>
                    )
                  })()}
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  {grupo.reqId && (
                    <Link
                      to={`/requerimientos/${grupo.reqId}`}
                      className="rounded-full bg-white/10 px-2 py-1 text-xs font-medium text-white hover:bg-white/20"
                    >
                      Ver req
                    </Link>
                  )}
                  <span className={`chip ${claseBadgeEstado(grupo.reqEstado)}`}>
                    {grupo.reqEstado ?? 'Sin estado'}
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-medium text-white">
                    {grupo.items.length} asignación{grupo.items.length === 1 ? '' : 'es'}
                  </span>
                </div>
              </div>

              {expandido && (
                <TablaScroll plano>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700">
                        <th className="p-3 text-left">Persona</th>
                        <th className="p-3 text-left">Categoría</th>
                        <th className="p-3 text-center">Prioridad</th>
                        <th className="p-3 text-right">% carga</th>
                        <th className="p-3 text-right">Horas según carga</th>
                        <th className="p-3 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grupo.items.map(({ asig, horasCarga }) => {
                        const enEdicionInline = edicionInlineId === asig.id
                        return (
                          <tr key={asig.id} className={`border-t ${editandoAsig?.id === asig.id ? 'bg-amber-50' : ''}`}>
                            <td className="p-3">{personaPorId.get(asig.persona_id)?.nombre ?? asig.persona_id}</td>
                            <td className="p-3">{categoriaPorId.get(asig.categoria_id)?.nombre ?? asig.categoria_id}</td>
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={asig.prioridad === true}
                                onChange={() => void cambiarPrioridad(asig)}
                                title="Marcar como prioridad"
                                className={`h-4 w-4 accent-marca ${puedeEditarAsignaciones ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                                disabled={!puedeEditarAsignaciones}
                              />
                            </td>
                            <td className="p-3 text-right font-medium">
                              {enEdicionInline ? (
                                <input
                                  autoFocus
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={edicionInlineValor}
                                  onChange={(e) => setEdicionInlineValor(e.target.value)}
                                  onBlur={() => void guardarEdicionInline(asig)}
                                  onKeyDown={onInlineKeyDown}
                                  className="campo campo-sm w-20 text-right"
                                />
                              ) : (
                                <span className="inline-flex items-center gap-1">
                                  <span className={asig.total_porcentaje === 0 ? 'text-red-500' : ''}>
                                    {asig.total_porcentaje}%
                                  </span>
                                  {puedeEditarAsignaciones && (
                                    <button
                                      type="button"
                                      onClick={() => iniciarEdicionInline(asig)}
                                      title="Editar %"
                                      className="text-slate-400 hover:text-marca"
                                    >
                                      ✎
                                    </button>
                                  )}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right text-slate-700">{horasCarga.toFixed(1)} h</td>
                            <td className="p-3 text-center whitespace-nowrap">
                              {puedeEditarAsignaciones && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => abrirEdicion(asig)}
                                    className="mr-3 text-xs text-marca hover:underline"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void eliminar(asig)}
                                    className="text-xs text-red-600 hover:underline"
                                  >
                                    Eliminar
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </TablaScroll>
              )}
            </section>
          )
        })}

        {gruposFiltrados.length === 0 && (
          <div className="tarjeta p-6 text-center text-sm text-slate-400">
            {filtroEstado !== '__todos__' ? 'No hay asignaciones con ese estado de requerimiento.' : 'Sin asignaciones.'}
          </div>
        )}
      </div>
      )}

      {vistaActiva === 'personas' && (
      <div className="space-y-4">
        {gruposPorPersona.map((gp) => {
          const expandida = personasExpandidas.has(gp.persona.id)
          const totalHoras = gp.reqs.reduce((s, r) => s + r.horasCarga, 0)
          return (
            <section key={gp.persona.id} className="tarjeta overflow-hidden">
              <div className="flex items-center justify-between gap-3 bg-marca-osc px-4 py-3 text-white">
                <button
                  type="button"
                  onClick={() => setPersonasExpandidas((prev) => {
                    const n = new Set(prev)
                    if (n.has(gp.persona.id)) n.delete(gp.persona.id); else n.add(gp.persona.id)
                    return n
                  })}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="text-sm">{expandida ? '▼' : '▶'}</span>
                  <span className="truncate text-sm font-semibold">{gp.persona.nombre}</span>
                  <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-xs">{gp.reqs.length} asignaciones</span>
                  <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-xs">{totalHoras.toFixed(0)}h carga</span>
                  {(wosPorPersonaMap.get(gp.persona.id)?.length ?? 0) > 0 && (
                    <span className="shrink-0 rounded-full bg-emerald-400/30 px-2 py-0.5 text-xs">{wosPorPersonaMap.get(gp.persona.id)!.length} WO</span>
                  )}
                </button>
              </div>
              {expandida && (
                <div className="space-y-0">
                  <TablaScroll plano>
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-3 py-2">Requerimiento</th>
                          <th className="px-3 py-2">Estado</th>
                          <th className="px-3 py-2">Categoría</th>
                          <th className="px-3 py-2 text-right">%</th>
                          <th className="px-3 py-2 text-right">Horas carga</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gp.reqs.map((r, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="px-3 py-2 font-medium">{r.reqLabel}</td>
                            <td className="px-3 py-2">
                              {r.reqEstado && <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${claseBadgeEstado(r.reqEstado)}`}>{r.reqEstado}</span>}
                            </td>
                            <td className="px-3 py-2">{categoriaPorId.get(r.asig.categoria_id)?.nombre ?? '—'}</td>
                            <td className="px-3 py-2 text-right">{r.asig.total_porcentaje}%</td>
                            <td className="px-3 py-2 text-right font-mono">{r.horasCarga.toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TablaScroll>
                  {(wosPorPersonaMap.get(gp.persona.id)?.length ?? 0) > 0 && (
                    <div className="border-t bg-emerald-50/50 px-3 py-2">
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Solicitudes Soporte WO ({wosPorPersonaMap.get(gp.persona.id)!.length})</p>
                      <TablaScroll plano>
                        <table className="w-full text-left text-xs">
                          <thead className="text-emerald-700">
                            <tr>
                              <th className="px-2 py-1">WO ID</th>
                              <th className="px-2 py-1">Estado</th>
                              <th className="px-2 py-1">Prioridad</th>
                              <th className="px-2 py-1">Fecha</th>
                              <th className="px-2 py-1">Descripción</th>
                            </tr>
                          </thead>
                          <tbody>
                            {wosPorPersonaMap.get(gp.persona.id)!.map((wo) => (
                              <tr key={wo.id} className="border-t border-emerald-100">
                                <td className="px-2 py-1 font-mono font-medium">{wo.wo_id}</td>
                                <td className="px-2 py-1">{wo.status}</td>
                                <td className="px-2 py-1">{wo.priority}</td>
                                <td className="px-2 py-1">{wo.created_date}</td>
                                <td className="px-2 py-1 max-w-[200px] truncate">{wo.descripcion}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </TablaScroll>
                    </div>
                  )}
                </div>
              )}
            </section>
          )
        })}
        {gruposPorPersona.length === 0 && (
          <div className="tarjeta p-6 text-center text-sm text-slate-400">
            Sin asignaciones para mostrar.
          </div>
        )}
      </div>
      )}
    </div>
  )
}
