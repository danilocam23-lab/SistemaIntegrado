import { useMemo, useState } from 'react'
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

interface FilaEntrega {
  label: string
  estado: string | null
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

/* ─── colores para barras ─── */
const COLORS_REQ = [
  'bg-[#2dd4bf]', // teal
  'bg-[#a78bfa]', // violet
  'bg-[#fb923c]', // orange
  'bg-[#60a5fa]', // blue
  'bg-[#f472b6]', // pink
  'bg-[#34d399]', // emerald
]
function colorReq(idx: number) {
  return COLORS_REQ[idx % COLORS_REQ.length]
}

export default function Roadmap() {
  const { datos: requerimientos } = useLista<Requerimiento>('/requerimientos')
  const { datos: personas } = useLista<Persona>('/personas')
  const { datos: categorias } = useLista<Categoria>('/categorias')
  const { datos: asignaciones } = useLista<Asignacion>('/asignaciones')

  const [mostrarEntregas, setMostrarEntregas] = useState(true)
  const [filtroPersona, setFiltroPersona] = useState('__todos__')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const catMap = useMemo(() => {
    const m: Record<string, Categoria> = {}
    categorias.forEach((c) => { m[c.id] = c })
    return m
  }, [categorias])

  /* Rango de meses en el timeline */
  const { meses, mesInicio } = useMemo(() => {
    const ahora = new Date()
    // Mostrar desde 2 meses antes hasta 10 meses después
    const desde = new Date(ahora.getFullYear(), ahora.getMonth() - 2, 1)
    const lista: { key: string; label: string; date: Date }[] = []
    for (let i = 0; i < 14; i++) {
      const d = new Date(desde.getFullYear(), desde.getMonth() + i, 1)
      lista.push({ key: mesKey(d), label: `${nombreMes(d.getMonth())} ${String(d.getFullYear()).slice(-2)}`, date: d })
    }
    return { meses: lista, mesInicio: desde }
  }, [])

  const mesFin = useMemo(() => {
    const last = meses[meses.length - 1].date
    return new Date(last.getFullYear(), last.getMonth() + 1, 0) // último día del último mes
  }, [meses])

  /* calcular posición % de una fecha dentro del rango */
  const totalMs = mesFin.getTime() - mesInicio.getTime()
  function posicionPct(d: Date): number {
    const ms = d.getTime() - mesInicio.getTime()
    return Math.max(0, Math.min(100, (ms / totalMs) * 100))
  }

  /* Agrupar requerimientos por persona → categoría */
  const grupos = useMemo<GrupoPersona[]>(() => {
    const personaFiltrada = filtroPersona === '__todos__' ? null : filtroPersona

    // Map persona_id → asignaciones
    const asigPorPersona: Record<string, Asignacion[]> = {}
    asignaciones.forEach((a) => {
      if (!asigPorPersona[a.persona_id]) asigPorPersona[a.persona_id] = []
      asigPorPersona[a.persona_id].push(a)
    })

    // Map para agrupar requerimientos por persona
    const reqPorPersona: Record<string, ReqConFechas[]> = {}
    requerimientos.forEach((req) => {
      const inicio = parseFecha(req.fecha_inicio)
      const fin = parseFecha(req.fecha_fin)
      if (!inicio || !fin) return // solo reqs con fechas
      const devs = req.developers_asignados ?? []
      if (devs.length === 0) return
      devs.forEach((pid) => {
        if (personaFiltrada && pid !== personaFiltrada) return
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

        // agrupar por categoría
        const catGroups: Record<string, { reqs: ReqConFechas[]; pct: number }> = {}
        reqs.forEach((r) => {
          const catId = r.req.categoria_id ?? '__sin_cat__'
          if (!catGroups[catId]) {
            const asig = asigs.find((a) => a.categoria_id === catId)
            catGroups[catId] = { reqs: [], pct: asig?.total_porcentaje ?? 0 }
          }
          catGroups[catId].reqs.push(r)
        })

        const catList: GrupoCat[] = Object.entries(catGroups).map(([catId, g]) => {
          const cat = catMap[catId]
          return {
            categoria: cat?.nombre ?? 'Sin categoría',
            color: cat?.color ?? '#94a3b8',
            porcentaje: g.pct,
            reqs: g.reqs.sort((a, b) => a.inicio.getTime() - b.inicio.getTime()),
          }
        })

        return {
          persona,
          categorias: catList.sort((a, b) => b.porcentaje - a.porcentaje),
          totalProy: reqs.length,
          conFechas: reqs.length,
        }
      })
      .filter((g) => g.totalProy > 0)
      .sort((a, b) => a.persona.nombre.localeCompare(b.persona.nombre))
  }, [requerimientos, personas, categorias, asignaciones, filtroPersona, catMap])

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
            <h1 className="text-lg font-bold text-marca-osc">Roadmap del Equipo</h1>
            <p className="text-xs text-slate-400">Línea de tiempo de proyectos y entregas</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Toggle entregas */}
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <span>Entregas</span>
            <button
              type="button"
              onClick={() => setMostrarEntregas(!mostrarEntregas)}
              className={`relative h-6 w-11 rounded-full transition-colors ${mostrarEntregas ? 'bg-marca' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${mostrarEntregas ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </label>
          {/* Filtro persona */}
          <select
            value={filtroPersona}
            onChange={(e) => setFiltroPersona(e.target.value)}
            className="rounded border px-3 py-1.5 text-sm"
          >
            <option value="__todos__">Todos los desarrolladores</option>
            {personas.filter((p) => p.activo).sort((a, b) => a.nombre.localeCompare(b.nombre)).map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Timeline */}
      <div className="overflow-x-auto border rounded-b-xl bg-white">
        <div className="min-w-[1200px]">
          {/* Encabezado de meses */}
          <div className="flex border-b bg-slate-50 text-[11px] font-medium text-slate-500 sticky top-0 z-10">
            <div className="w-[220px] min-w-[220px] px-3 py-2 font-semibold uppercase tracking-wider">
              Recurso / Proyecto
            </div>
            <div className="relative flex flex-1">
              {meses.map((m) => (
                <div
                  key={m.key}
                  className={`flex-1 border-l px-2 py-2 text-center ${m.key === hoyKey ? 'bg-marca/5 font-bold text-marca' : ''}`}
                >
                  {m.label}
                </div>
              ))}
            </div>
            <div className="w-[120px] min-w-[120px] border-l px-2 py-2 text-center font-semibold uppercase tracking-wider">
              Inicio / Fin
            </div>
          </div>

          {/* Filas de datos */}
          {grupos.length === 0 && (
            <div className="p-8 text-center text-slate-400">
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
                  className="flex cursor-pointer items-center border-b bg-slate-50/50 hover:bg-slate-100/50"
                  onClick={() => toggleCollapse(grupo.persona.id)}
                >
                  <div className="flex w-[220px] min-w-[220px] items-center gap-2 px-3 py-2">
                    <svg xmlns="http://www.w3.org/2000/svg"
                      className={`h-3.5 w-3.5 text-slate-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-marca text-[10px] font-bold text-white">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-800">{grupo.persona.nombre}</div>
                      <div className="truncate text-[10px] text-slate-400">{grupo.persona.rol_operativo}</div>
                    </div>
                  </div>
                  <div className="flex flex-1 items-center px-2 py-2 text-xs text-slate-500">
                    {grupo.totalProy} proy · {grupo.conFechas} con fechas
                    <span className="ml-2 inline-block h-2 w-2 rounded-full bg-emerald-400" />
                  </div>
                  <div className="w-[120px] min-w-[120px]" />
                </div>

                {/* Categorías y requerimientos */}
                {!isCollapsed && grupo.categorias.map((catGrp) => (
                  <div key={catGrp.categoria}>
                    {/* Fila de categoría */}
                    <div className="flex border-b border-dashed">
                      <div className="flex w-[220px] min-w-[220px] items-center gap-2 px-6 py-1.5">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: catGrp.color }} />
                        <span className="text-xs font-semibold text-slate-700">{catGrp.categoria}</span>
                        {catGrp.porcentaje > 0 && (
                          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
                            {catGrp.porcentaje}%
                          </span>
                        )}
                      </div>
                      <div className="flex-1" />
                      <div className="w-[120px] min-w-[120px]" />
                    </div>

                    {/* Filas de requerimiento */}
                    {catGrp.reqs.map((r) => {
                      const ci = globalColorIdx++
                      const left = posicionPct(r.inicio)
                      const right = posicionPct(r.fin)
                      const width = Math.max(right - left, 1)
                      const label = `${r.req.codigo_req} – ${r.req.nombre ?? ''}`

                      // Entregas de este req
                      const entregas: FilaEntrega[] = (r.req.entregas ?? [])
                        .filter((en) => {
                          const eI = parseFecha(en.fecha_comprometida)
                          return eI !== null
                        })
                        .map((en) => {
                          const eI = parseFecha(en.fecha_comprometida)!
                          const eF = parseFecha(en.fecha_recepcion) ?? new Date(eI.getTime() + 14 * 86400000) // +14 días default
                          return {
                            label: `Sprint ${en.numero} - ${r.req.codigo_req.slice(0, 8)}...`,
                            estado: en.estado,
                            inicio: eI,
                            fin: eF > eI ? eF : new Date(eI.getTime() + 14 * 86400000),
                          }
                        })

                      return (
                        <div key={r.req.id}>
                          {/* Barra del requerimiento */}
                          <div className="flex border-b">
                            <div className="flex w-[220px] min-w-[220px] items-center gap-1.5 px-6 py-2">
                              <span className="text-[10px] text-marca">■</span>
                              <span className="truncate text-xs text-slate-600" title={label}>
                                {r.req.codigo_req.length > 14 ? r.req.codigo_req.slice(0, 14) + '...' : r.req.codigo_req}
                              </span>
                              <span className={`ml-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                                r.req.estado === 'Activo' || r.req.estado === 'En Ejecución' ? 'bg-emerald-100 text-emerald-700' :
                                r.req.estado === 'Finalizado' || r.req.estado === 'Cerrado' ? 'bg-slate-200 text-slate-600' :
                                r.req.estado === 'Inactivo' || r.req.estado === 'Suspendido' ? 'bg-amber-100 text-amber-700' :
                                'bg-blue-100 text-blue-700'
                              }`}>
                                {r.req.estado}
                              </span>
                            </div>
                            <div className="relative flex-1 py-2">
                              {/* Líneas divisorias de meses */}
                              {meses.map((m, i) => (
                                <div
                                  key={m.key}
                                  className="absolute top-0 bottom-0 border-l border-slate-100"
                                  style={{ left: `${(i / meses.length) * 100}%` }}
                                />
                              ))}
                              {/* Barra del req */}
                              <div
                                className={`absolute top-1.5 bottom-1.5 rounded-md ${colorReq(ci)} flex items-center overflow-hidden shadow-sm`}
                                style={{ left: `${left}%`, width: `${width}%`, minWidth: '2px' }}
                                title={`${label}\n${fmtCorta(r.inicio)} → ${fmtCorta(r.fin)}`}
                              >
                                <span className="truncate px-2 text-[10px] font-semibold text-white drop-shadow">
                                  {label}
                                </span>
                              </div>
                            </div>
                            <div className="flex w-[120px] min-w-[120px] flex-col items-end justify-center border-l px-2 text-[10px] text-slate-500">
                              <span>📅 {fmtCorta(r.inicio)}</span>
                              <span>📅 {fmtCorta(r.fin)}</span>
                            </div>
                          </div>

                          {/* Entregas (sprints) */}
                          {mostrarEntregas && entregas.map((en, ei) => {
                            const eLeft = posicionPct(en.inicio)
                            const eRight = posicionPct(en.fin)
                            const eWidth = Math.max(eRight - eLeft, 0.8)
                            return (
                              <div key={ei} className="flex border-b border-dashed border-slate-100">
                                <div className="flex w-[220px] min-w-[220px] items-center gap-1.5 px-8 py-1">
                                  <span className="text-[9px] text-slate-400">↳</span>
                                  <span className="truncate text-[10px] text-slate-500">
                                    Entrega {entregas[ei].label.split(' ')[1]}
                                  </span>
                                  <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-semibold ${
                                    en.estado === 'Aprobada' || en.estado === 'Finalizado' ? 'bg-emerald-100 text-emerald-700' :
                                    en.estado === 'Activo' || en.estado === 'En revisión' ? 'bg-cyan-100 text-cyan-700' :
                                    en.estado === 'Rechazada' ? 'bg-red-100 text-red-700' :
                                    'bg-slate-100 text-slate-500'
                                  }`}>
                                    {en.estado ?? '—'}
                                  </span>
                                </div>
                                <div className="relative flex-1 py-1">
                                  {meses.map((m, i) => (
                                    <div
                                      key={m.key}
                                      className="absolute top-0 bottom-0 border-l border-slate-100"
                                      style={{ left: `${(i / meses.length) * 100}%` }}
                                    />
                                  ))}
                                  {/* Barra con patrón rayado */}
                                  <div
                                    className="absolute top-0.5 bottom-0.5 rounded"
                                    style={{
                                      left: `${eLeft}%`,
                                      width: `${eWidth}%`,
                                      minWidth: '2px',
                                      background: `repeating-linear-gradient(135deg, rgba(45,212,191,0.3), rgba(45,212,191,0.3) 4px, rgba(45,212,191,0.15) 4px, rgba(45,212,191,0.15) 8px)`,
                                      border: '1px solid rgba(45,212,191,0.4)',
                                    }}
                                    title={`Entrega ${entregas[ei].label.split(' ')[1]}: ${fmtCorta(en.inicio)} → ${fmtCorta(en.fin)}`}
                                  />
                                </div>
                                <div className="flex w-[120px] min-w-[120px] flex-col items-end justify-center border-l px-2 text-[9px] text-slate-400">
                                  <span>{fmtCorta(en.inicio)}</span>
                                  <span>{fmtCorta(en.fin)}</span>
                                </div>
                              </div>
                            )
                          })}
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
