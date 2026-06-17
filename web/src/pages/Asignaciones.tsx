import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent, MouseEvent as ReactMouseEvent } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client'
import { mensajeError, useLista } from '../api/hooks'
import { useAplicacion } from '../context/AplicacionContext'
import { useAuth } from '../context/AuthContext'
import type {
  Asignacion,
  Capacidad,
  Categoria,
  Configuracion,
  Persona,
  Requerimiento,
} from '../types'

const ESTADO_ACTIVO = 'ESTIMACION APROBADA ENTREGA PENDIENTE'

type AsignacionItem = Asignacion & {
  aplicacion_id?: string
  activo?: boolean
}

interface OpcionReq {
  id: string
  label: string
  aplicacionId: string
  estado?: string
}

interface GrupoReq {
  reqId: string | null
  reqLabel: string
  reqEstado: string | null
  items: { asig: AsignacionItem; horasCarga: number }[]
}

function writeHeaders(aplicacionId: string) {
  return { headers: { 'X-Aplicacion': aplicacionId } }
}

function badgeEstadoClass(estado: string | null): string {
  if (!estado) return 'bg-slate-100 text-slate-600'
  if (estado === ESTADO_ACTIVO) return 'bg-green-100 text-green-700'
  if (estado.toLowerCase().includes('cancel')) return 'bg-slate-100 text-slate-700'
  return 'bg-amber-100 text-amber-700'
}

export default function Asignaciones() {
  const { datos: asignacionesBase, error, recargar } = useLista<AsignacionItem>('/asignaciones')
  const { datos: personas } = useLista<Persona>('/personas')
  const { datos: categorias } = useLista<Categoria>('/categorias')
  const { datos: requerimientos } = useLista<Requerimiento>('/requerimientos')
  const { datos: configuraciones } = useLista<Configuracion>('/configuracion')
  const { modoConsolidado, activa } = useAplicacion()
  const { usuario } = useAuth()

  const asignaciones = useMemo(() => asignacionesBase as AsignacionItem[], [asignacionesBase])
  const esSuperadmin = usuario?.rol === 'superadmin'
  const mesSel = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }, [])

  const [capacidades, setCapacidades] = useState<Capacidad[]>([])
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
  const reqBoxRef = useRef<HTMLDivElement | null>(null)
  const autoFixedRef = useRef(false)
  const modoEdicion = editandoAsig !== null

  useEffect(() => {
    client
      .get<Capacidad[]>(`/capacidades?mes=${mesSel}`)
      .then((r) => setCapacidades(r.data))
      .catch(() => {})
  }, [mesSel])

  useEffect(() => {
    function cerrarDropdown(event: MouseEvent) {
      if (reqBoxRef.current && !reqBoxRef.current.contains(event.target as Node)) {
        setDropdownReqAbierto(false)
      }
    }

    document.addEventListener('mousedown', cerrarDropdown)
    return () => document.removeEventListener('mousedown', cerrarDropdown)
  }, [])

  const personasDisponibles = useMemo(
    () => personas
      .filter((p) => p.rol_operativo === 'DEV' || p.rol_operativo === 'LT_HITSS')
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [personas],
  )

  const personaPorId = useMemo(() => {
    const map = new Map<string, Persona>()
    for (const persona of personas) map.set(persona.id, persona)
    return map
  }, [personas])

  const categoriaPorId = useMemo(() => {
    const map = new Map<string, Categoria>()
    for (const categoria of categorias) map.set(categoria.id, categoria)
    return map
  }, [categorias])

  const reqPorId = useMemo(() => {
    const map = new Map<string, { sc: string; codigoReq: string; nombre: string }>()
    for (const req of requerimientos) {
      map.set(req.id, {
        sc: req.solicitud?.codigo_sc ?? '',
        codigoReq: req.codigo_req,
        nombre: req.nombre ?? '',
      })
    }
    return map
  }, [requerimientos])

  const reqIdsActivos = useMemo(() => {
    const ids = new Set<string>()
    for (const req of requerimientos) {
      if (req.estado === ESTADO_ACTIVO) ids.add(req.id)
    }
    return ids
  }, [requerimientos])

  const opcionesReq = useMemo<OpcionReq[]>(() => {
    return requerimientos
      .map((r) => ({
        id: r.id,
        label: [r.solicitud?.codigo_sc, r.codigo_req, r.nombre].filter(Boolean).join(' - '),
        aplicacionId: r.aplicacion_id,
        estado: r.estado,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'))
  }, [requerimientos])

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

  const horasMesDefault = useMemo(() => {
    const config = configuraciones.find((item) => item.clave === 'horas_mes_default')
    return config ? Number(config.valor) : 180
  }, [configuraciones])

  const capPorPersonaId = useMemo(() => {
    const map = new Map<string, number>()
    for (const capacidad of capacidades) {
      if (capacidad.persona_id && capacidad.scope === 'persona') {
        map.set(capacidad.persona_id, capacidad.horas_disponibles)
      }
    }
    return map
  }, [capacidades])

  const etiquetaReq = useCallback((reqId: string | null) => {
    if (!reqId) return 'Sin requerimiento'
    const req = reqPorId.get(reqId)
    if (!req) return reqId
    return [req.sc, req.codigoReq, req.nombre].filter(Boolean).join(' - ')
  }, [reqPorId])

  const capacidadUsada = useCallback((paraPersonaId: string, excluyendoId?: string) => {
    return asignaciones
      .filter((a) => a.persona_id === paraPersonaId && a.id !== excluyendoId)
      .filter((a) => a.proyectos.some((p) => p.requerimiento_id && reqIdsActivos.has(p.requerimiento_id)))
      .reduce((sum, a) => sum + a.total_porcentaje, 0)
  }, [asignaciones, reqIdsActivos])

  const calcularPctSugerido = useCallback((pid: string) => {
    const activas = asignaciones.filter((a) =>
      a.persona_id === pid &&
      a.proyectos.some((p) => p.requerimiento_id && reqIdsActivos.has(p.requerimiento_id)),
    ).length
    return String(Math.round(100 / (activas + 1)))
  }, [asignaciones, reqIdsActivos])

  const porcentajeSugerido = useMemo(
    () => (!modoEdicion && personaId ? calcularPctSugerido(personaId) : ''),
    [calcularPctSugerido, modoEdicion, personaId],
  )

  const gruposReq = useMemo<GrupoReq[]>(() => {
    const map = new Map<string | null, GrupoReq>()

    for (const asig of asignaciones) {
      const reqId = asig.proyectos[0]?.requerimiento_id ?? null
      if (!map.has(reqId)) {
        const req = reqId ? requerimientos.find((item) => item.id === reqId) : null
        const info = reqId ? reqPorId.get(reqId) : null
        map.set(reqId, {
          reqId,
          reqLabel: info
            ? [info.sc, info.codigoReq, info.nombre].filter(Boolean).join(' - ')
            : (reqId ?? 'Sin requerimiento'),
          reqEstado: req?.estado ?? null,
          items: [],
        })
      }

      const horasBase = capPorPersonaId.get(asig.persona_id) ?? horasMesDefault
      map.get(reqId)?.items.push({
        asig,
        horasCarga: horasBase * (asig.total_porcentaje / 100),
      })
    }

    return Array.from(map.values())
      .map((grupo) => ({
        ...grupo,
        items: [...grupo.items].sort((a, b) => {
          const nombreA = personaPorId.get(a.asig.persona_id)?.nombre ?? a.asig.persona_id
          const nombreB = personaPorId.get(b.asig.persona_id)?.nombre ?? b.asig.persona_id
          return nombreA.localeCompare(nombreB, 'es')
        }),
      }))
      .sort((a, b) => {
        if (!a.reqId && b.reqId) return 1
        if (a.reqId && !b.reqId) return -1
        return a.reqLabel.localeCompare(b.reqLabel, 'es')
      })
  }, [asignaciones, requerimientos, reqPorId, capPorPersonaId, horasMesDefault, personaPorId])

  const estadosUnicos = useMemo(() => {
    const set = new Set<string>()
    for (const grupo of gruposReq) {
      if (grupo.reqEstado) set.add(grupo.reqEstado)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
  }, [gruposReq])

  const gruposFiltrados = useMemo(() => {
    let resultado = gruposReq
    
    // Filtrar por estado
    if (filtroEstado === '__todos__') {
      // Mantener todos
    } else if (filtroEstado === '__sin_estado__') {
      resultado = resultado.filter((g) => !g.reqEstado)
    } else {
      resultado = resultado.filter((g) => g.reqEstado === filtroEstado)
    }
    
    // Filtrar por persona
    if (filtroPersona !== '__todos__') {
      resultado = resultado.map((g) => ({
        ...g,
        items: g.items.filter((item) => item.asig.persona_id === filtroPersona),
      }))
      resultado = resultado.filter((g) => g.items.length > 0)
    }
    
    return resultado
  }, [gruposReq, filtroEstado, filtroPersona])

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
  }, [etiquetaReq])

  const seleccionarReq = useCallback((opcion: OpcionReq) => {
    setRequerimientoId(opcion.id)
    setBusquedaReq(opcion.label)
    setDropdownReqAbierto(false)
  }, [])

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
          writeHeaders(resolverAppAsignacion(a)),
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
      // Calcular % equitativo para esta persona (incluyendo la nueva)
      const existentes = asignaciones.filter((a) =>
        a.persona_id === personaId &&
        a.proyectos.some((p) => p.requerimiento_id && reqIdsActivos.has(p.requerimiento_id)),
      ).length
      const pctEquitativo = Math.round(100 / (existentes + 1))

      await client.post(
        '/asignaciones',
        {
          persona_id: personaId,
          categoria_id: categoriaId,
          total_porcentaje: pctEquitativo,
          estado: 'active',
          activo: true,
          proyectos: requerimientoId
            ? [{ nombre: opcionReqSeleccionada?.label ?? '', estado: 'active', requerimiento_id: requerimientoId }]
            : [],
        },
        writeHeaders(aplicacionId),
      )
      // Redistribuir % equitativamente en todas las asignaciones activas existentes
      await redistribuirPct(personaId)
      limpiarFormulario()
      await recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }, [asignaciones, categoriaId, limpiarFormulario, opcionReqSeleccionada, personaId, porcentaje, recargar, requerimientoId, reqIdsActivos, redistribuirPct, resolverAppCreacion, validarCapacidad])

  const actualizar = useCallback(async (e: FormEvent) => {
    e.preventDefault()
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
        writeHeaders(aplicacionId),
      )
      limpiarFormulario()
      await recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }, [categoriaId, editandoAsig, etiquetaReq, limpiarFormulario, opcionReqSeleccionada, personaId, porcentaje, recargar, requerimientoId, resolverAppAsignacion, validarCapacidad])

  const eliminar = useCallback(async (asig: AsignacionItem) => {
    if (!window.confirm('¿Eliminar esta asignación?')) return
    setAviso('')

    const aplicacionId = resolverAppAsignacion(asig)
    if (!aplicacionId) {
      setAviso('No fue posible determinar la aplicación de la asignación.')
      return
    }

    try {
      await client.delete(`/asignaciones/${asig.id}`, writeHeaders(aplicacionId))
      if (editandoAsig?.id === asig.id) limpiarFormulario()
      // Redistribuir % entre las asignaciones restantes
      await redistribuirPct(asig.persona_id, asig.id)
      await recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }, [editandoAsig?.id, limpiarFormulario, recargar, redistribuirPct, resolverAppAsignacion])

  const iniciarEdicionInline = useCallback((asig: AsignacionItem) => {
    setAviso('')
    setEdicionInlineId(asig.id)
    setEdicionInlineValor(String(asig.total_porcentaje))
  }, [])

  const cancelarEdicionInline = useCallback(() => {
    setEdicionInlineId(null)
    setEdicionInlineValor('')
  }, [])

  const guardarEdicionInline = useCallback(async (asig: AsignacionItem) => {
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
        writeHeaders(aplicacionId),
      )
      cancelarEdicionInline()
      await recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }, [cancelarEdicionInline, edicionInlineId, edicionInlineValor, recargar, resolverAppAsignacion, validarCapacidad])

  const cambiarPrioridad = useCallback(async (asig: AsignacionItem) => {
    const aplicacionId = resolverAppAsignacion(asig)
    if (!aplicacionId) return
    try {
      await client.patch(`/asignaciones/${asig.id}/prioridad`, {}, writeHeaders(aplicacionId))
      await recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }, [recargar, resolverAppAsignacion])

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
      <h1 className="mb-4 text-xl font-bold text-marca-osc">Asignaciones de carga</h1>

      <form onSubmit={modoEdicion ? actualizar : crear} className="mb-4 rounded-xl border bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-slate-600">
            {modoEdicion ? '✏️ Editando asignación' : 'Nueva asignación'}
          </span>
          {modoEdicion && (
            <button
              type="button"
              onClick={limpiarFormulario}
              className="text-xs text-slate-400 hover:text-red-500"
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
              className="rounded border px-3 py-2"
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
              className="rounded border px-3 py-2"
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
              className="w-28 rounded border px-3 py-2"
            />
            {!modoEdicion && personaId && porcentaje === porcentajeSugerido && porcentaje && (
              <span className="mt-1 block text-xs text-emerald-700">{porcentajeSugerido}% (sugerido)</span>
            )}
          </label>

          <div ref={reqBoxRef} className="relative min-w-[320px] flex-1 text-sm">
            <span className="mb-1 block text-slate-600">
              Requerimiento <span className="text-slate-400">(opcional)</span>
            </span>
            <input
              value={busquedaReq}
              onChange={(e) => cambiarBusquedaReq(e.target.value)}
              onFocus={() => setDropdownReqAbierto(true)}
              placeholder="Buscar SC - REQ - Nombre"
              className="w-full rounded border px-3 py-2"
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
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${badgeEstadoClass(opcion.estado)}`}>
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
            className={`rounded px-5 py-2 text-white ${modoEdicion ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-marca hover:bg-marca-osc'}`}
          >
            {modoEdicion ? 'Actualizar' : 'Crear'}
          </button>
        </div>
      </form>

      {modoConsolidado && !requerimientoId && !modoEdicion && (
        <div className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          {esSuperadmin
            ? 'Modo consolidado: selecciona un requerimiento para crear la asignación en la aplicación correcta.'
            : 'Modo consolidado: selecciona un requerimiento para poder crear la asignación en la aplicación correcta.'}
        </div>
      )}

      {(aviso || error) && (
        <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{aviso || error}</div>
      )}

      <div className="mb-4 flex items-center gap-6">
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-600">Filtrar por estado del requerimiento:</label>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="rounded border px-3 py-1.5 text-sm"
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
              className="text-xs text-slate-400 hover:text-red-500"
            >
              Limpiar ✕
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-600">Filtrar por persona:</label>
          <select
            value={filtroPersona}
            onChange={(e) => setFiltroPersona(e.target.value)}
            className="rounded border px-3 py-1.5 text-sm"
          >
            <option value="__todos__">Todas</option>
            {personas
              .slice()
              .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
              .map((persona) => (
                <option key={persona.id} value={persona.id}>{persona.nombre}</option>
              ))}
          </select>
          {filtroPersona !== '__todos__' && (
            <button
              type="button"
              onClick={() => setFiltroPersona('__todos__')}
              className="text-xs text-slate-400 hover:text-red-500"
            >
              Limpiar ✕
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {gruposFiltrados.map((grupo) => {
          const expandido = gruposExpandidos.has(grupo.reqId)
          return (
            <section key={grupo.reqId ?? 'sin-requerimiento'} className="overflow-hidden rounded-xl border bg-white">
              <div className="flex items-center justify-between gap-3 bg-marca-osc px-4 py-3 text-white">
                <button
                  type="button"
                  onClick={(event) => onReqHeaderClick(event, grupo.reqId)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="text-sm">{expandido ? '▼' : '▶'}</span>
                  <span className="truncate text-sm font-semibold">{grupo.reqLabel}</span>
                  {grupo.reqId && (() => {
                    const req = requerimientos.find(r => r.id === grupo.reqId)
                    if (!req?.total_horas_estimadas) return null
                    const horasReales = req.total_horas_estimadas * 0.9
                    return (
                      <div className="ml-4 flex shrink-0 items-center gap-4 border-l border-white/30 pl-4 text-xs font-medium">
                        <div>
                          <div className="text-white/70">Horas est.</div>
                          <div>{req.total_horas_estimadas.toFixed(1)} h</div>
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
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${badgeEstadoClass(grupo.reqEstado)}`}>
                    {grupo.reqEstado ?? 'Sin estado'}
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-medium text-white">
                    {grupo.items.length} asignación{grupo.items.length === 1 ? '' : 'es'}
                  </span>
                </div>
              </div>

              {expandido && (
                <div className="overflow-x-auto">
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
                                className="h-4 w-4 cursor-pointer accent-marca"
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
                                  className="w-20 rounded border px-2 py-1 text-right"
                                />
                              ) : (
                                <span className="inline-flex items-center gap-1">
                                  <span className={asig.total_porcentaje === 0 ? 'text-red-500' : ''}>
                                    {asig.total_porcentaje}%
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => iniciarEdicionInline(asig)}
                                    title="Editar %"
                                    className="text-slate-400 hover:text-marca"
                                  >
                                    ✎
                                  </button>
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right text-slate-700">{horasCarga.toFixed(1)} h</td>
                            <td className="p-3 text-center whitespace-nowrap">
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
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )
        })}

        {gruposFiltrados.length === 0 && (
          <div className="rounded-xl border bg-white p-6 text-center text-sm text-slate-400">
            {filtroEstado !== '__todos__' ? 'No hay asignaciones con ese estado de requerimiento.' : 'Sin asignaciones.'}
          </div>
        )}
      </div>
    </div>
  )
}
