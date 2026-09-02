import { useEffect, useMemo, useState } from 'react'
import { useLista } from '../api/hooks'
import type { Asignacion, Categoria, Persona, Requerimiento } from '../types'

/* ─── helpers de fecha ─── */
function mesKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function parseFecha(s: string | null | undefined): Date | null {
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}
function fmtCorta(d: Date) {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][d.getMonth()]
  const yy = String(d.getFullYear()).slice(-2)
  return `${dd} ${mm} ${yy}`
}
function nombreMes(m: number) {
  return ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][m]
}

/* ─── tipos internos ─── */
interface ReqConFechas {
  req: Requerimiento
  inicio: Date
  fin: Date
}

interface GrupoCat {
  categoria: string
  color: string
  porcentaje: number
  reqs: ReqConFechas[]
}

interface GrupoPersona {
  persona: Persona
  categorias: GrupoCat[]
  totalProy: number
  conFechas: number
}

const SIN_ASIGNAR_ID = '__sin_asignar__'

/* ─── colores para barras ─── */
const COLORS_REQ = [
  'bg-[#1d4ed8]', // blue
  'bg-[#0f766e]', // teal
  'bg-[#7c3aed]', // violet
  'bg-[#b45309]', // amber
  'bg-[#be185d]', // rose
  'bg-[#0f172a]', // slate
]
function colorReq(idx: number) {
  return COLORS_REQ[idx % COLORS_REQ.length]
}

export default function Roadmap() {
  const { datos: requerimientos } = useLista<Requerimiento>('/requerimientos')
  const { datos: personas } = useLista<Persona>('/personas')
  const { datos: categorias } = useLista<Categoria>('/categorias')
  const { datos: asignaciones } = useLista<Asignacion>('/asignaciones')

  const [filtroPersona, setFiltroPersona] = useState('__todos__')
  const [modoAgrupacion, setModoAgrupacion] = useState<'usuario' | 'plano'>('usuario')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [mesesActivos, setMesesActivos] = useState<Set<string>>(new Set())
  const [estadosActivos, setEstadosActivos] = useState<Set<string>>(new Set())

  const personaSinAsignar = useMemo<Persona>(() => ({
    id: SIN_ASIGNAR_ID,
    nombre: 'Sin asignar',
    email: null,
    rol_operativo: 'SIN ASIGNAR',
    activo: true,
    squads: [],
    es_lider_tecnico: false,
    permite_sobrecarga: false,
    usuario_id: null,
  }), [])

  const personaSinAgrupacion = useMemo<Persona>(() => ({
    id: '__sin_agrupacion__',
    nombre: 'Todos los requerimientos',
    email: null,
    rol_operativo: 'SIN AGRUPACIÓN',
    activo: true,
    squads: [],
    es_lider_tecnico: false,
    permite_sobrecarga: false,
    usuario_id: null,
  }), [])

  const catMap = useMemo(() => {
    const m: Record<string, Categoria> = {}
    categorias.forEach((c) => { m[c.id] = c })
    return m
  }, [categorias])

  const estadosRequerimiento = useMemo(() => {
    const set = new Set<string>()
    requerimientos.forEach((req) => {
      if (req.estado) set.add(req.estado)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
  }, [requerimientos])

  /* Rango de meses en el timeline */
  const { meses, mesInicio } = useMemo(() => {
    const ahora = new Date()
    // Mostrar desde 2 meses antes hasta 10 meses después
    const desde = new Date(ahora.getFullYear(), ahora.getMonth() - 2, 1)
    const ultimoMes = requerimientos.reduce((max, req) => {
      const candidatos: Array<Date | null> = [
        parseFecha(req.fecha_solicitud_acta),
        parseFecha(req.fecha_inicio),
        parseFecha(req.fecha_fin),
        ...(req.entregas ?? []).map((en) => parseFecha(en.fecha_comprometida)),
      ]
      let maxReq: Date | null = null
      for (const d of candidatos) {
        if (!d) continue
        if (!maxReq || d.getTime() > maxReq.getTime()) maxReq = d
      }
      if (!max || (maxReq && maxReq.getTime() > max.getTime())) return maxReq ?? max
      return max
    }, null as Date | null)

    const hastaBase = ultimoMes
      ? new Date(ultimoMes.getFullYear(), ultimoMes.getMonth(), 1)
      : new Date(desde.getFullYear(), desde.getMonth() + 13, 1)

    const lista: { key: string; label: string; date: Date }[] = []
    const totalMeses = Math.max(1, (hastaBase.getFullYear() - desde.getFullYear()) * 12 + (hastaBase.getMonth() - desde.getMonth()) + 1)
    for (let i = 0; i < totalMeses; i++) {
      const d = new Date(desde.getFullYear(), desde.getMonth() + i, 1)
      lista.push({ key: mesKey(d), label: `${nombreMes(d.getMonth())} ${String(d.getFullYear()).slice(-2)}`, date: d })
    }
    return { meses: lista, mesInicio: desde }
  }, [requerimientos])

  const mesesVisibles = useMemo(() => {
    return meses.filter((m) => mesesActivos.has(m.key))
  }, [meses, mesesActivos])

  const mesInicioVisible = useMemo(() => {
    return mesesVisibles.length > 0 ? mesesVisibles[0].date : mesInicio
  }, [mesesVisibles, mesInicio])

  const mesFinVisible = useMemo(() => {
    if (mesesVisibles.length === 0) return mesInicio
    const last = mesesVisibles[mesesVisibles.length - 1].date
    return new Date(last.getFullYear(), last.getMonth() + 1, 0)
  }, [mesesVisibles, mesInicio])

  /* calcular posición % de una fecha dentro del rango */
  const totalMs = Math.max(1, mesFinVisible.getTime() - mesInicioVisible.getTime())
  function posicionPct(d: Date): number {
    const ms = d.getTime() - mesInicioVisible.getTime()
    return Math.max(0, Math.min(100, (ms / totalMs) * 100))
  }

  const mesKeySet = useMemo(() => new Set(meses.map((m) => m.key)), [meses])

  const reqMatchesEstado = (req: Requerimiento): boolean => {
    if (estadosActivos.size === 0) return true
    return estadosActivos.has(req.estado)
  }

  useEffect(() => {
    setMesesActivos((prev) => {
      if (meses.length === 0) return prev
      const next = new Set<string>()
      prev.forEach((k) => {
        if (mesKeySet.has(k)) next.add(k)
      })
      if (next.size === 0) {
        meses.forEach((m) => next.add(m.key))
      }
      return next
    })
  }, [meses, mesKeySet])

  useEffect(() => {
    if (estadosRequerimiento.length === 0) return
    setEstadosActivos((prev) => {
      const next = new Set<string>()
      prev.forEach((estado) => {
        if (estadosRequerimiento.includes(estado)) next.add(estado)
      })
      if (next.size === 0) {
        estadosRequerimiento.forEach((estado) => next.add(estado))
      }
      return next
    })
  }, [estadosRequerimiento])

  const reqMatchesMeses = (req: Requerimiento): boolean => {
    const fechas = [
      parseFecha(req.fecha_solicitud_acta),
      parseFecha(req.fecha_inicio),
      parseFecha(req.fecha_fin),
      ...(req.entregas ?? []).map((en) => parseFecha(en.fecha_comprometida)),
    ].filter((d): d is Date => d !== null)
    return fechas.some((d) => mesesActivos.has(mesKey(d)))
  }

  function personasAsignadasReq(req: Requerimiento): string[] {
    const ids = new Set<string>()
    ;(req.developers_asignados ?? []).forEach((id) => {
      if (id) ids.add(id)
    })
    if (req.solicitud?.lt_hitss_id) ids.add(req.solicitud.lt_hitss_id)
    return Array.from(ids)
  }

  /* Agrupar requerimientos por persona → categoría */
  const grupos = useMemo<GrupoPersona[]>(() => {
    // Map persona_id → asignaciones
    const asigPorPersona: Record<string, Asignacion[]> = {}
    asignaciones.forEach((a) => {
      if (!asigPorPersona[a.persona_id]) asigPorPersona[a.persona_id] = []
      asigPorPersona[a.persona_id].push(a)
    })

    const construirCategorias = (reqs: ReqConFechas[], asigs: Asignacion[], mostrarPct: boolean): GrupoCat[] => {
      const catGroups: Record<string, { reqs: ReqConFechas[]; pct: number }> = {}
      reqs.forEach((r) => {
        const catId = r.req.categoria_id ?? '__sin_cat__'
        if (!catGroups[catId]) {
          const asig = asigs.find((a) => a.categoria_id === catId)
          catGroups[catId] = { reqs: [], pct: mostrarPct ? (asig?.total_porcentaje ?? 0) : 0 }
        }
        catGroups[catId].reqs.push(r)
      })

      return Object.entries(catGroups).map(([catId, g]) => {
        const cat = catMap[catId]
        return {
          categoria: cat?.nombre ?? 'Sin categoría',
          color: cat?.color ?? '#94a3b8',
          porcentaje: g.pct,
          reqs: g.reqs.sort((a, b) => a.inicio.getTime() - b.inicio.getTime()),
        }
      })
    }

    if (modoAgrupacion === 'plano') {
      const reqsPlano: ReqConFechas[] = []
      requerimientos.forEach((req) => {
        if (!reqMatchesEstado(req)) return
        if (!reqMatchesMeses(req)) return
        const inicio = parseFecha(req.fecha_solicitud_acta ?? req.fecha_inicio)
        if (!inicio) return

        const fechasComprometidas = (req.entregas ?? [])
          .map((en) => parseFecha(en.fecha_comprometida))
          .filter((d): d is Date => d !== null)
          .sort((a, b) => a.getTime() - b.getTime())
        const fin = fechasComprometidas.length > 0
          ? fechasComprometidas[fechasComprometidas.length - 1]
          : inicio

        reqsPlano.push({ req, inicio, fin })
      })

      if (reqsPlano.length === 0) return []

      return [{
        persona: personaSinAgrupacion,
        categorias: construirCategorias(reqsPlano, [], false).sort((a, b) => a.categoria.localeCompare(b.categoria)),
        totalProy: reqsPlano.length,
        conFechas: reqsPlano.length,
      }]
    }

    const personaFiltrada = filtroPersona === '__todos__' ? null : filtroPersona

    // Map para agrupar requerimientos por persona
    const reqPorPersona: Record<string, ReqConFechas[]> = {}
    requerimientos.forEach((req) => {
      if (!reqMatchesEstado(req)) return
      if (!reqMatchesMeses(req)) return
      const inicio = parseFecha(req.fecha_solicitud_acta ?? req.fecha_inicio)
      if (!inicio) return

      const fechasComprometidas = (req.entregas ?? [])
        .map((en) => parseFecha(en.fecha_comprometida))
        .filter((d): d is Date => d !== null)
        .sort((a, b) => a.getTime() - b.getTime())
      const fin = fechasComprometidas.length > 0
        ? fechasComprometidas[fechasComprometidas.length - 1]
        : inicio

      const devs = personasAsignadasReq(req)
      if (devs.length === 0) {
        if (personaFiltrada && personaFiltrada !== SIN_ASIGNAR_ID) return
        if (!reqMatchesMeses(req)) return
        if (!reqPorPersona[SIN_ASIGNAR_ID]) reqPorPersona[SIN_ASIGNAR_ID] = []
        reqPorPersona[SIN_ASIGNAR_ID].push({ req, inicio, fin })
        return
      }
      devs.forEach((pid) => {
        if (personaFiltrada && pid !== personaFiltrada) return
        if (!reqMatchesMeses(req)) return
        if (!reqPorPersona[pid]) reqPorPersona[pid] = []
        reqPorPersona[pid].push({ req, inicio, fin })
      })
    })

    return personas
      .filter((p) => p.activo)
      .filter((p) => reqPorPersona[p.id]?.length > 0)
      .filter((p) => !personaFiltrada || p.id === personaFiltrada)
      .map((persona) => {
        const reqs = reqPorPersona[persona.id] ?? []
        const asigs = asigPorPersona[persona.id] ?? []
        const catList: GrupoCat[] = construirCategorias(reqs, asigs, true)

        return {
          persona,
          categorias: catList.sort((a, b) => b.porcentaje - a.porcentaje),
          totalProy: reqs.length,
          conFechas: reqs.length,
        }
      })
      .concat(reqPorPersona[SIN_ASIGNAR_ID]?.length
        ? [{
            persona: personaSinAsignar,
            categorias: construirCategorias(reqPorPersona[SIN_ASIGNAR_ID] ?? [], [], false).sort((a, b) => a.categoria.localeCompare(b.categoria)),
            totalProy: (reqPorPersona[SIN_ASIGNAR_ID] ?? []).length,
            conFechas: (reqPorPersona[SIN_ASIGNAR_ID] ?? []).length,
          } as GrupoPersona]
        : [])
      .filter((g) => g.totalProy > 0)
      .sort((a, b) => a.persona.nombre.localeCompare(b.persona.nombre))
  }, [requerimientos, personas, categorias, asignaciones, filtroPersona, catMap, personaSinAsignar, personaSinAgrupacion, modoAgrupacion, mesesActivos, reqMatchesMeses])

  const toggleCollapse = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  /* marcar mes actual */
  const hoyKey = mesKey(new Date())

  let globalColorIdx = 0

  return (
    <div className="flex flex-col gap-0">
      {/* Header */}
      <div className="flex items-center justify-between rounded-t-xl bg-white p-4 border border-b-0">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-marca/10 p-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-marca" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h1 className="titulo-pagina">Roadmap del Equipo</h1>
            <p className="text-xs text-zinc-500">Línea de tiempo de proyectos y entregas</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={modoAgrupacion}
            onChange={(e) => setModoAgrupacion(e.target.value as 'usuario' | 'plano')}
            className="campo campo-sm"
          >
            <option value="usuario">Por usuario asignado</option>
            <option value="plano">Sin agrupar por usuario</option>
          </select>

          {modoAgrupacion === 'usuario' && (
            <select
              value={filtroPersona}
              onChange={(e) => setFiltroPersona(e.target.value)}
              className="campo campo-sm"
            >
              <option value="__todos__">Todos los desarrolladores</option>
              <option value={SIN_ASIGNAR_ID}>Sin asignar</option>
              {personas.filter((p) => p.activo).sort((a, b) => a.nombre.localeCompare(b.nombre)).map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="border-l border-r border-b border-zinc-200 bg-white px-4 py-3">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50">
            <div className="flex items-center gap-2">
              <span>Estados del requerimiento</span>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-700">
                {estadosActivos.size === 0 ? 'sin filtro' : `${estadosActivos.size} seleccionados`}
              </span>
            </div>
            <svg className="h-4 w-4 text-zinc-500 transition-transform group-open:rotate-180" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z" clipRule="evenodd" />
            </svg>
          </summary>

          <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-zinc-600">Selecciona uno o varios estados</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEstadosActivos(new Set(estadosRequerimiento))}
                  className="btn btn-secundario btn-sm"
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setEstadosActivos(new Set())}
                  className="btn btn-secundario btn-sm"
                >
                  Limpiar
                </button>
              </div>
            </div>

            <div className="max-h-56 overflow-auto rounded-md border border-zinc-200 bg-white p-2">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {estadosRequerimiento.map((estado) => {
                  const checked = estadosActivos.has(estado)
                  return (
                    <label
                      key={estado}
                      className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs transition-colors ${
                        checked ? 'border-blue-300 bg-blue-50 text-blue-900' : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setEstadosActivos((prev) => {
                            const next = new Set(prev)
                            if (next.has(estado)) next.delete(estado)
                            else next.add(estado)
                            return next
                          })
                        }}
                      />
                      <span className="truncate">{estado}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>
        </details>
      </div>

      <div className="flex flex-wrap gap-2 border-l border-r border-b border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-700">
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-2 font-semibold text-zinc-900">Meses:</span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-700">
              {mesesActivos.size === 0 ? 'sin filtro' : `${mesesActivos.size} seleccionados`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMesesActivos(new Set(meses.map((m) => m.key)))}
              className="btn btn-secundario btn-sm rounded-full"
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setMesesActivos(new Set())}
              className="btn btn-secundario btn-sm rounded-full"
            >
              Limpiar
            </button>
          </div>
        </div>
        {meses.map((m) => {
          const checked = mesesActivos.has(m.key)
          return (
            <label key={m.key} className="flex cursor-pointer items-center gap-1 rounded border border-zinc-300 px-2 py-1 bg-white">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  setMesesActivos((prev) => {
                    const next = new Set(prev)
                    if (next.has(m.key)) next.delete(m.key)
                    else next.add(m.key)
                    return next
                  })
                }}
              />
              <span>{m.label}</span>
            </label>
          )
        })}
      </div>

      {/* Timeline */}
      <div className="overflow-x-auto border rounded-b-xl border-zinc-200 bg-white">
        <div className="min-w-[1200px]">
          {/* Encabezado de meses */}
          <div className="flex border-b border-zinc-200 bg-zinc-50 text-[11px] font-medium text-zinc-700 sticky top-0 z-10">
            <div className="w-[220px] min-w-[220px] px-3 py-2 font-semibold uppercase tracking-wider">
              Recurso / Proyecto
            </div>
            <div className="relative flex flex-1">
              {mesesVisibles.map((m) => (
                <div
                  key={m.key}
                  className={`flex-1 border-l border-zinc-200 px-2 py-2 text-center ${m.key === hoyKey ? 'bg-zinc-100 font-bold text-zinc-900' : ''}`}
                >
                  {m.label}
                </div>
              ))}
            </div>
            <div className="w-[150px] min-w-[150px] border-l border-zinc-200 px-2 py-2 text-center font-semibold uppercase tracking-wider">
              <span className="text-[10px] text-zinc-600">Inicio / Fin</span>
            </div>
          </div>

          {/* Filas de datos */}
          {grupos.length === 0 && (
            <div className="p-8 text-center text-zinc-500">
              No hay requerimientos con fechas y desarrolladores asignados.
            </div>
          )}

          {grupos.map((grupo) => {
            const isCollapsed = collapsed.has(grupo.persona.id)
            const initials = grupo.persona.nombre
              .split(' ')
              .slice(0, 2)
              .map((w) => w[0]?.toUpperCase() ?? '')
              .join('')

            return (
              <div key={grupo.persona.id}>
                {/* Fila de persona */}
                <div
                  className="flex cursor-pointer items-center border-b border-zinc-200 bg-white hover:bg-zinc-50"
                  onClick={() => toggleCollapse(grupo.persona.id)}
                >
                  <div className="flex w-[220px] min-w-[220px] items-center gap-2 px-3 py-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg"
                      className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-700 text-[10px] font-bold text-white">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">{grupo.persona.nombre}</div>
                      <div className="truncate text-[10px] text-zinc-500">{grupo.persona.rol_operativo}</div>
                    </div>
                  </div>
                  <div className="flex flex-1 items-center px-2 py-1.5 text-xs text-zinc-600">
                    {grupo.totalProy} proy · {grupo.conFechas} con fechas
                    <span className="ml-2 inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  </div>
                  <div className="w-[150px] min-w-[150px]" />
                </div>

                {/* Categorías y requerimientos */}
                {!isCollapsed && grupo.categorias.map((catGrp) => (
                  <div key={catGrp.categoria}>
                    {/* Fila de categoría */}
                    <div className="flex border-b border-dashed border-zinc-200 bg-white">
                      <div className="flex w-[220px] min-w-[220px] items-center gap-2 px-6 py-1.5">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: catGrp.color }} />
                        <span className="text-xs font-semibold text-zinc-800">{catGrp.categoria}</span>
                        {modoAgrupacion === 'usuario' && catGrp.porcentaje > 0 && (
                          <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[9px] font-bold text-zinc-700">
                            {catGrp.porcentaje}%
                          </span>
                        )}
                      </div>
                      <div className="flex-1" />
                      <div className="w-[150px] min-w-[150px]" />
                    </div>

                    {/* Filas de requerimiento */}
                    {catGrp.reqs.map((r) => {
                      const ci = globalColorIdx++
                      const left = posicionPct(r.inicio < mesInicioVisible ? mesInicioVisible : r.inicio)
                      const right = posicionPct(r.fin > mesFinVisible ? mesFinVisible : r.fin)
                      const width = Math.max(right - left, 1)
                      const label = `${r.req.codigo_req} – ${r.req.nombre ?? ''}`

                      return (
                        <div key={r.req.id}>
                          {/* Barra del requerimiento */}
                          <div className="flex border-b">
                            <div className="flex w-[220px] min-w-[220px] items-center gap-1.5 px-6 py-1.5">
                              <span className="text-[10px] text-zinc-400">■</span>
                              <span className="truncate text-xs text-zinc-800" title={label}>
                                {r.req.codigo_req.length > 14 ? r.req.codigo_req.slice(0, 14) + '...' : r.req.codigo_req}
                              </span>
                            </div>
                            <div className="relative flex-1 py-1.5">
                              {/* Líneas divisorias de meses */}
                              {mesesVisibles.map((m, i) => (
                                <div
                                  key={m.key}
                                  className="absolute top-0 bottom-0 border-l border-zinc-200"
                                  style={{ left: `${(i / mesesVisibles.length) * 100}%` }}
                                />
                              ))}
                              {/* Barra del req */}
                              <div
                                className={`absolute top-2 bottom-2 rounded-full ${colorReq(ci)} flex items-center overflow-hidden shadow-sm border border-white/60`}
                                style={{ left: `${left}%`, width: `${width}%`, minWidth: '2px' }}
                                title={`${label}\n${fmtCorta(r.inicio)} → ${fmtCorta(r.fin)}`}
                              >
                                <span className="truncate px-2 text-[9px] font-semibold text-white drop-shadow">
                                  {label}
                                </span>
                              </div>
                            </div>
                            <div className="flex w-[150px] min-w-[150px] flex-col justify-center border-l border-zinc-200 px-2 py-1.5 text-[10px] text-zinc-700">
                              <div className="flex items-center justify-between gap-2">
                                <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 font-semibold uppercase tracking-wide text-zinc-600">Ini</span>
                                <span className="truncate font-medium text-zinc-800">{fmtCorta(r.inicio)}</span>
                              </div>
                              <div className="mt-1 flex items-center justify-between gap-2">
                                <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 font-semibold uppercase tracking-wide text-zinc-600">Fin</span>
                                <span className="truncate font-medium text-zinc-800">{fmtCorta(r.fin)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )
          })}

          {/* Línea "hoy" */}
          <div className="pointer-events-none absolute top-0 bottom-0 z-20" style={{ left: `calc(220px + ${posicionPct(new Date())}% * (100% - 340px) / 100%)` }}>
          </div>
        </div>
      </div>
    </div>
  )
}
