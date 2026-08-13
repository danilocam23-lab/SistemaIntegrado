import { useEffect, useMemo, useState } from 'react'
import client from '../api/client'
import { mensajeError } from '../api/hooks'
import { useAuth } from '../context/AuthContext'

interface RegistroSoporte {
  id: string
  lider: string
  squad: string
  datos: Record<string, string>
}

interface ListadoResponse {
  registros: RegistroSoporte[]
}

type EstadoResumen = {
  total: number
  cumple: number
  noCumple: number
}

type AnsTipo = 'oportunidad' | 'cumplimiento' | 'inicio'

const ANS_DETALLE_CAMPOS: Record<AnsTipo, { levantado: string; observaciones: string }> = {
  oportunidad: {
    levantado: 'Se_levanto_ANS_Oportunidad',
    observaciones: 'Observaciones_ANS_Oportunidad',
  },
  cumplimiento: {
    levantado: 'Se_levanto_ANS_Cumplimiento',
    observaciones: 'Observaciones_ANS_Cumplimiento',
  },
  inicio: {
    levantado: 'Se_levanto_ANS_inicio_trabajo',
    observaciones: 'Observaciones_ANS_inicio_trabajo',
  },
}

function estadoANS(valor: string | undefined): 'CUMPLE' | 'NO_CUMPLE' | 'OTRO' {
  const v = (valor ?? '').trim().toUpperCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
  if (v === 'CUMPLE') return 'CUMPLE'
  if (v === 'NO CUMPLE' || (v.startsWith('NO ') && v.includes('CUMPLE'))) return 'NO_CUMPLE'
  return 'OTRO'
}

function crearResumen() {
  return { total: 0, cumple: 0, noCumple: 0 }
}

function ordenarPorWorkOrderID(a: RegistroSoporte, b: RegistroSoporte): number {
  const woA = (a.datos?.['Work Order ID'] ?? '').trim()
  const woB = (b.datos?.['Work Order ID'] ?? '').trim()
  return woA.localeCompare(woB, 'es', { numeric: true, sensitivity: 'base' })
}

function normalizarTexto(v: string): string {
  return v.trim().toLowerCase()
}

function seLevantoAns(registro: RegistroSoporte, tipo: AnsTipo): boolean {
  const valor = (registro.datos?.[ANS_DETALLE_CAMPOS[tipo].levantado] ?? '').trim().toUpperCase()
  return valor === 'SI' || valor === 'TRUE' || valor === '1'
}

function observacionesAns(registro: RegistroSoporte, tipo: AnsTipo): string {
  return registro.datos?.[ANS_DETALLE_CAMPOS[tipo].observaciones] ?? ''
}

const MESES_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export default function SoporteDetalleANS() {
  const { tienePermiso } = useAuth()
  const puedeActualizar = tienePermiso('soporte.detalle_ans.editar')
  const [cargando, setCargando] = useState(true)
  const [aviso, setAviso] = useState('')
  const [registros, setRegistros] = useState<RegistroSoporte[]>([])
  const [filtroWo, setFiltroWo] = useState('')
  const [filtroAssignedTo, setFiltroAssignedTo] = useState('')
  const [anosActivos, setAnosActivos] = useState<Set<string>>(new Set())
  const [mesesActivos, setMesesActivos] = useState<Set<string>>(new Set())
  const [abiertas, setAbiertas] = useState({
    oportunidad: false,
    cumplimiento: false,
    inicio: false,
  })

  useEffect(() => {
    setCargando(true)
    setAviso('')
    client
      .get<ListadoResponse>('/soporte/solicitudes-fabrica/ans-datos')
      .then((r) => setRegistros(r.data.registros ?? []))
      .catch((err) => setAviso(mensajeError(err)))
      .finally(() => setCargando(false))
  }, [])

  // ─── Años disponibles desde Fecha_Fin_Real ─────────────
  const anosDisponibles = useMemo(() => {
    const s = new Set<string>()
    registros.forEach((r) => {
      const fecha = r.datos?.['Fecha_Fin_Real']
      if (fecha && fecha.length >= 4) s.add(fecha.substring(0, 4))
    })
    return Array.from(s).sort()
  }, [registros])

  const registrosBaseFiltrados = useMemo(() => {
    const wo = normalizarTexto(filtroWo)
    return registros.filter((r) => {
      if (wo && !normalizarTexto(r.datos?.['Work Order ID'] ?? '').includes(wo)) return false
      // Filtro por año/mes (Fecha_Fin_Real)
      if (anosActivos.size > 0 || mesesActivos.size > 0) {
        const fecha = r.datos?.['Fecha_Fin_Real'] ?? ''
        const ano = fecha.substring(0, 4)
        const mm  = String(Number(fecha.substring(5, 7)))
        if (anosActivos.size > 0 && !anosActivos.has(ano)) return false
        if (mesesActivos.size > 0 && !mesesActivos.has(mm)) return false
      }
      return true
    })
  }, [registros, filtroWo, anosActivos, mesesActivos])

  const assignedToOpciones = useMemo(() => {
    const unicos = new Set<string>()
    registrosBaseFiltrados.forEach((r) => {
      const valor = (r.datos?.['Assigned To'] ?? '').trim()
      if (valor) unicos.add(valor)
    })
    return Array.from(unicos).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
  }, [registrosBaseFiltrados])

  const registrosFiltrados = useMemo(() => {
    const assigned = normalizarTexto(filtroAssignedTo)
    return registrosBaseFiltrados.filter((r) => {
      if (assigned && normalizarTexto(r.datos?.['Assigned To'] ?? '') !== assigned) return false
      return true
    })
  }, [registrosBaseFiltrados, filtroAssignedTo])

  const resumen = useMemo(() => {
    const oportunidad: EstadoResumen = crearResumen()
    const cumplimiento: EstadoResumen = crearResumen()
    const inicio: EstadoResumen = crearResumen()

    registrosFiltrados.forEach((r) => {
      const estadoOportunidad = estadoANS(r.datos?.['Estado_ANS_Oportunidad'])
      if (estadoOportunidad !== 'OTRO') {
        oportunidad.total++
        if (estadoOportunidad === 'CUMPLE') oportunidad.cumple++
        else oportunidad.noCumple++
      }

      const estadoCumplimiento = estadoANS(r.datos?.['Estado_ANS_Cumplimiento'])
      if (estadoCumplimiento !== 'OTRO') {
        cumplimiento.total++
        if (estadoCumplimiento === 'CUMPLE') cumplimiento.cumple++
        else cumplimiento.noCumple++
      }

      const estadoInicio = estadoANS(r.datos?.['Estado_ANS_inicio_trabajo'])
      if (estadoInicio !== 'OTRO') {
        inicio.total++
        if (estadoInicio === 'CUMPLE') inicio.cumple++
        else inicio.noCumple++
      }
    })

    return { oportunidad, cumplimiento, inicio }
  }, [registrosFiltrados])

  const registrosOportunidad = useMemo(
    () => registrosFiltrados
      .filter((r) => estadoANS(r.datos?.['Estado_ANS_Oportunidad']) === 'NO_CUMPLE')
      .sort(ordenarPorWorkOrderID),
    [registrosFiltrados],
  )
  const registrosCumplimiento = useMemo(
    () => registrosFiltrados
      .filter((r) => estadoANS(r.datos?.['Estado_ANS_Cumplimiento']) === 'NO_CUMPLE')
      .sort(ordenarPorWorkOrderID),
    [registrosFiltrados],
  )
  const registrosInicio = useMemo(
    () => registrosFiltrados
      .filter((r) => estadoANS(r.datos?.['Estado_ANS_inicio_trabajo']) === 'NO_CUMPLE')
      .sort(ordenarPorWorkOrderID),
    [registrosFiltrados],
  )

  const hayFiltroFecha = anosActivos.size > 0 || mesesActivos.size > 0

  function actualizarRegistroLocal(actualizado: RegistroSoporte) {
    setRegistros((actuales) => actuales.map((r) => (r.id === actualizado.id ? actualizado : r)))
  }

  if (cargando) return <div className="p-6 text-slate-500">Cargando detalle ANS…</div>

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-marca-osc">Detalle ANS</h1>
      <p className="text-sm text-slate-500">Vista de seguimiento ANS para solicitudes de soporte.</p>

      {aviso && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{aviso}</div>}

      {/* ─── Filtros ─── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        {/* Work Order ID + Assigned To */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="filtro-wo-ans">
              Filtrar por Work Order ID
            </label>
            <input
              id="filtro-wo-ans"
              className="mt-2 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
              placeholder="Buscar Work Order ID…"
              value={filtroWo}
              onChange={(e) => setFiltroWo(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="filtro-assigned-ans">
              Filtrar por Assigned To
            </label>
            <select
              id="filtro-assigned-ans"
              className="mt-2 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
              value={filtroAssignedTo}
              onChange={(e) => setFiltroAssignedTo(e.target.value)}
            >
              <option value="">Todos</option>
              {assignedToOpciones.map((persona) => (
                <option key={persona} value={persona}>{persona}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Filtros Año / Mes por Fecha_Fin_Real */}
        <div className="border-t border-slate-100 pt-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            📅 Filtrar por Fecha Fin Real
          </p>
          <div className="flex flex-wrap items-start gap-3">
            {/* Año */}
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border-2 border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:border-slate-300 transition-colors">
                <span>📅 Año</span>
                {anosActivos.size > 0 && (
                  <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">{anosActivos.size}</span>
                )}
                <svg className="h-3.5 w-3.5 text-slate-400 transition-transform group-open:rotate-180" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z" clipRule="evenodd" />
                </svg>
              </summary>
              <div className="absolute z-20 mt-1 min-w-[160px] rounded-lg border border-slate-200 bg-white p-2.5 shadow-lg">
                <div className="flex justify-end gap-3 mb-2">
                  <button type="button" onClick={() => setAnosActivos(new Set(anosDisponibles))} className="text-[10px] font-semibold text-blue-600 hover:underline">Todos</button>
                  <button type="button" onClick={() => setAnosActivos(new Set())} className="text-[10px] font-semibold text-slate-400 hover:underline">Limpiar</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {anosDisponibles.map((ano) => {
                    const checked = anosActivos.has(ano)
                    return (
                      <label key={ano} className={`flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-[11px] font-semibold transition-colors ${checked ? 'border-blue-300 bg-blue-50 text-blue-900' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                        <input type="checkbox" checked={checked} onChange={() => setAnosActivos((p) => { const n = new Set(p); n.has(ano) ? n.delete(ano) : n.add(ano); return n })} />
                        {ano}
                      </label>
                    )
                  })}
                </div>
              </div>
            </details>

            {/* Mes */}
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border-2 border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:border-slate-300 transition-colors">
                <span>🗓️ Mes</span>
                {mesesActivos.size > 0 && (
                  <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">{mesesActivos.size}</span>
                )}
                <svg className="h-3.5 w-3.5 text-slate-400 transition-transform group-open:rotate-180" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z" clipRule="evenodd" />
                </svg>
              </summary>
              <div className="absolute z-20 mt-1 min-w-[200px] rounded-lg border border-slate-200 bg-white p-2.5 shadow-lg">
                <div className="flex justify-end gap-3 mb-2">
                  <button type="button" onClick={() => setMesesActivos(new Set(['1','2','3','4','5','6','7','8','9','10','11','12']))} className="text-[10px] font-semibold text-blue-600 hover:underline">Todos</button>
                  <button type="button" onClick={() => setMesesActivos(new Set())} className="text-[10px] font-semibold text-slate-400 hover:underline">Limpiar</button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {MESES_LABELS.map((label, idx) => {
                    const k = String(idx + 1)
                    const checked = mesesActivos.has(k)
                    return (
                      <label key={k} className={`flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-[11px] font-semibold transition-colors ${checked ? 'border-blue-300 bg-blue-50 text-blue-900' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                        <input type="checkbox" checked={checked} onChange={() => setMesesActivos((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n })} />
                        {label}
                      </label>
                    )
                  })}
                </div>
              </div>
            </details>

            {hayFiltroFecha && (
              <button type="button" onClick={() => { setAnosActivos(new Set()); setMesesActivos(new Set()) }}
                className="rounded-lg border-2 border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                ✕ Limpiar fechas
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <CardANS titulo="ANS Oportunidad" data={resumen.oportunidad} color="green" />
        <CardANS titulo="ANS Cumplimiento" data={resumen.cumplimiento} color="amber" />
        <CardANS titulo="ANS Inicio Trabajo" data={resumen.inicio} color="purple" />
      </div>

      <DetalleTablaANS
        titulo="Detalle ANS Oportunidad"
        registros={registrosOportunidad}
        tipo="oportunidad"
        estadoKey="Estado_ANS_Oportunidad"
        estadoLabel="Estado ANS Oportunidad"
        abierta={abiertas.oportunidad}
        onToggle={() => setAbiertas((v) => ({ ...v, oportunidad: !v.oportunidad }))}
        onActualizado={actualizarRegistroLocal}
        onAviso={setAviso}
        puedeActualizar={puedeActualizar}
      />
      <DetalleTablaANS
        titulo="Detalle ANS Cumplimiento"
        registros={registrosCumplimiento}
        tipo="cumplimiento"
        estadoKey="Estado_ANS_Cumplimiento"
        estadoLabel="Estado ANS Cumplimiento"
        abierta={abiertas.cumplimiento}
        onToggle={() => setAbiertas((v) => ({ ...v, cumplimiento: !v.cumplimiento }))}
        onActualizado={actualizarRegistroLocal}
        onAviso={setAviso}
        puedeActualizar={puedeActualizar}
      />
      <DetalleTablaANS
        titulo="Detalle ANS Inicio Trabajo"
        registros={registrosInicio}
        tipo="inicio"
        estadoKey="Estado_ANS_inicio_trabajo"
        estadoLabel="Estado ANS Inicio Trabajo"
        abierta={abiertas.inicio}
        onToggle={() => setAbiertas((v) => ({ ...v, inicio: !v.inicio }))}
        onActualizado={actualizarRegistroLocal}
        onAviso={setAviso}
        puedeActualizar={puedeActualizar}
      />
    </div>
  )
}

function CardANS({ titulo, data, color }: { titulo: string; data: EstadoResumen; color: 'green' | 'amber' | 'purple' }) {
  const colores = {
    green: { borde: 'border-green-200', fondo: 'bg-green-50', texto: 'text-green-800', sub: 'text-green-600' },
    amber: { borde: 'border-amber-200', fondo: 'bg-amber-50', texto: 'text-amber-800', sub: 'text-amber-600' },
    purple: { borde: 'border-purple-200', fondo: 'bg-purple-50', texto: 'text-purple-800', sub: 'text-purple-600' },
  }[color]
  const pct = data.total > 0 ? Math.round((data.cumple / data.total) * 100) : 0
  return (
    <div className={`rounded-xl border p-4 ${colores.borde} ${colores.fondo}`}>
      <p className={`text-sm font-semibold ${colores.sub}`}>{titulo}</p>
      <p className={`text-2xl font-bold ${colores.texto}`}>{pct}%</p>
      <p className={`text-sm ${colores.sub}`}>Cumple: {data.cumple} / {data.total}</p>
      <p className="text-sm text-red-600">No cumple: {data.noCumple}</p>
    </div>
  )
}

function DetalleTablaANS({
  titulo,
  registros,
  tipo,
  estadoKey,
  estadoLabel,
  abierta,
  onToggle,
  onActualizado,
  onAviso,
  puedeActualizar,
}: {
  titulo: string
  registros: RegistroSoporte[]
  tipo: AnsTipo
  estadoKey: 'Estado_ANS_Oportunidad' | 'Estado_ANS_Cumplimiento' | 'Estado_ANS_inicio_trabajo'
  estadoLabel: string
  abierta: boolean
  onToggle: () => void
  onActualizado: (registro: RegistroSoporte) => void
  onAviso: (mensaje: string) => void
  puedeActualizar: boolean
}) {
  const [observaciones, setObservaciones] = useState<Record<string, string>>({})
  const [guardandoCheck, setGuardandoCheck] = useState<Set<string>>(new Set())
  const [guardandoObservacion, setGuardandoObservacion] = useState<Set<string>>(new Set())

  useEffect(() => {
    setObservaciones((actuales) => {
      const siguiente = { ...actuales }
      registros.forEach((registro) => {
        if (siguiente[registro.id] === undefined) {
          siguiente[registro.id] = observacionesAns(registro, tipo)
        }
      })
      return siguiente
    })
  }, [registros, tipo])

  async function guardarCheck(registro: RegistroSoporte, checked: boolean) {
    if (!puedeActualizar) {
      onAviso('No tienes permiso para actualizar el detalle ANS.')
      return
    }
    const datosOptimistas = {
      ...registro.datos,
      [ANS_DETALLE_CAMPOS[tipo].levantado]: checked ? 'SI' : 'NO',
    }
    onActualizado({ ...registro, datos: datosOptimistas })
    setGuardandoCheck((actual) => new Set(actual).add(registro.id))
    onAviso('')
    try {
      const { data } = await client.patch<RegistroSoporte>(`/soporte/solicitudes-fabrica/${registro.id}/detalle-ans`, {
        tipo,
        se_levanto_ans: checked,
      })
      onActualizado(data)
    } catch (err) {
      onActualizado(registro)
      onAviso(mensajeError(err))
    } finally {
      setGuardandoCheck((actual) => {
        const siguiente = new Set(actual)
        siguiente.delete(registro.id)
        return siguiente
      })
    }
  }

  async function guardarObservacion(registro: RegistroSoporte) {
    if (!puedeActualizar) {
      onAviso('No tienes permiso para actualizar observaciones ANS.')
      return
    }
    const observacion = observaciones[registro.id] ?? ''
    setGuardandoObservacion((actual) => new Set(actual).add(registro.id))
    onAviso('')
    try {
      const { data } = await client.patch<RegistroSoporte>(`/soporte/solicitudes-fabrica/${registro.id}/detalle-ans`, {
        tipo,
        observaciones: observacion,
      })
      onActualizado(data)
      setObservaciones((actuales) => ({ ...actuales, [registro.id]: observacionesAns(data, tipo) }))
    } catch (err) {
      onAviso(mensajeError(err))
    } finally {
      setGuardandoObservacion((actual) => {
        const siguiente = new Set(actual)
        siguiente.delete(registro.id)
        return siguiente
      })
    }
  }

  const totalLevantados = registros.filter((registro) => seLevantoAns(registro, tipo)).length

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between border-b border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        <span>{titulo}</span>
        <span className="text-xs text-slate-500">
          {totalLevantados} levantados / {registros.length} registros · {abierta ? 'Ocultar' : 'Mostrar'}
        </span>
      </button>
      {abierta && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-700">
              <tr>
                <th className="p-2">Work Order ID</th>
                <th className="p-2 text-center">Se levantó ANS</th>
                <th className="min-w-[320px] p-2">Observaciones</th>
                <th className="p-2">Líder</th>
                <th className="p-2">Assigned To</th>
                <th className="p-2">Squad</th>
                <th className="p-2">Fecha Fin Real</th>
                <th className="p-2">{estadoLabel}</th>
              </tr>
            </thead>
            <tbody>
              {registros.length === 0 ? (
                <tr className="border-t">
                  <td className="p-4 text-center text-slate-400" colSpan={8}>Sin registros</td>
                </tr>
              ) : (
                registros.map((r) => {
                  const levantado = seLevantoAns(r, tipo)
                  return (
                    <tr key={r.id} className="border-t">
                      <td className="p-2 font-medium text-slate-800">{r.datos?.['Work Order ID'] ?? '—'}</td>
                      <td className="p-2 text-center">
                        <label className={`inline-flex items-center justify-center gap-2 rounded-lg border px-2 py-1 text-xs font-semibold ${
                          levantado ? 'border-green-200 bg-green-50 text-green-700' : 'border-slate-200 bg-slate-50 text-slate-600'
                        }`}>
                          <input
                            type="checkbox"
                            checked={levantado}
                            disabled={!puedeActualizar || guardandoCheck.has(r.id)}
                            onChange={(event) => void guardarCheck(r, event.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-marca focus:ring-marca"
                          />
                          {guardandoCheck.has(r.id) ? 'Guardando…' : levantado ? 'Sí' : 'No'}
                        </label>
                      </td>
                      <td className="p-2">
                        <div className="flex min-w-[300px] gap-2">
                          <textarea
                            value={observaciones[r.id] ?? observacionesAns(r, tipo)}
                            onChange={(event) => setObservaciones((actuales) => ({ ...actuales, [r.id]: event.target.value }))}
                            rows={2}
                            readOnly={!puedeActualizar}
                            className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                            placeholder={puedeActualizar ? 'Agregar observaciones…' : 'Sin observaciones'}
                          />
                          {puedeActualizar && (
                            <button
                              type="button"
                              onClick={() => void guardarObservacion(r)}
                              disabled={guardandoObservacion.has(r.id)}
                              className="self-start rounded bg-marca px-3 py-2 text-xs font-semibold text-white hover:bg-marca-osc disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {guardandoObservacion.has(r.id) ? 'Guardando…' : 'Guardar'}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="p-2">{r.lider || '—'}</td>
                      <td className="p-2">{r.datos?.['Assigned To'] || '—'}</td>
                      <td className="p-2">{r.squad || '—'}</td>
                      <td className="p-2">{r.datos?.['Fecha_Fin_Real'] || '—'}</td>
                      <td className="p-2">{r.datos?.[estadoKey] || '—'}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}