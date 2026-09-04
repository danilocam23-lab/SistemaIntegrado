import { useEffect, useMemo, useRef, useState } from 'react'
import client from '../api/client'
import { mensajeError } from '../api/hooks'
import { useAuth } from '../context/AuthContext'
import { FiltroDesplegable, TablaScroll } from '../components/ui'

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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function cargarANS(wo?: string, assigned?: string, anos?: Set<string>, meses?: Set<string>): Promise<void> {
    setCargando(true)
    setAviso('')
    try {
      const params = new URLSearchParams()
      const _wo = wo ?? filtroWo
      const _assigned = assigned ?? filtroAssignedTo
      const _anos = anos ?? anosActivos
      const _meses = meses ?? mesesActivos
      if (_wo) params.set('filtro_wo', _wo)
      if (_assigned) params.set('filtro_assigned', _assigned)
      if (_anos.size === 1) params.set('filtro_ano', [..._anos][0])
      if (_meses.size === 1) params.set('filtro_mes', [..._meses][0])
      const { data } = await client.get<ListadoResponse>(`/soporte/solicitudes-fabrica/ans-datos?${params}`)
      setRegistros(data.registros ?? [])
    } catch (err) {
      setAviso(mensajeError(err))
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    void cargarANS()
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

  const assignedToOpciones = useMemo(() => {
    const unicos = new Set<string>()
    registros.forEach((r) => {
      const valor = (r.datos?.['Assigned To'] ?? '').trim()
      if (valor) unicos.add(valor)
    })
    return Array.from(unicos).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
  }, [registros])

  // Filtrado local solo para año/mes multi-select (servidor ya filtró WO y Assigned)
  const registrosFiltrados = useMemo(() => {
    if (anosActivos.size === 0 && mesesActivos.size === 0) return registros
    return registros.filter((r) => {
      const fecha = r.datos?.['Fecha_Fin_Real'] ?? ''
      const ano = fecha.substring(0, 4)
      const mm = String(Number(fecha.substring(5, 7)))
      if (anosActivos.size > 0 && !anosActivos.has(ano)) return false
      if (mesesActivos.size > 0 && !mesesActivos.has(mm)) return false
      return true
    })
  }, [registros, anosActivos, mesesActivos])

  const resumen = useMemo(() => {
    const oportunidad: EstadoResumen = crearResumen()
    const cumplimiento: EstadoResumen = crearResumen()
    const inicio: EstadoResumen = crearResumen()

    // Cada registro cuenta siempre hacia el total (denominador real). Solo se marca
    // como "cumple" si el estado es explícitamente CUMPLE; cualquier otro valor
    // (NO CUMPLE, "Sin información", vacío, etc.) se contabiliza como no-cumple,
    // para que el % de la card refleje el cumplimiento real y no solo el de los
    // registros con estado explícito.
    registrosFiltrados.forEach((r) => {
      const estadoOportunidad = estadoANS(r.datos?.['Estado_ANS_Oportunidad'])
      oportunidad.total++
      if (estadoOportunidad === 'CUMPLE') oportunidad.cumple++
      else oportunidad.noCumple++

      const estadoCumplimiento = estadoANS(r.datos?.['Estado_ANS_Cumplimiento'])
      cumplimiento.total++
      if (estadoCumplimiento === 'CUMPLE') cumplimiento.cumple++
      else cumplimiento.noCumple++

      const estadoInicio = estadoANS(r.datos?.['Estado_ANS_inicio_trabajo'])
      inicio.total++
      if (estadoInicio === 'CUMPLE') inicio.cumple++
      else inicio.noCumple++
    })

    return { oportunidad, cumplimiento, inicio }
  }, [registrosFiltrados])

  const registrosOportunidad = useMemo(
    () => registrosFiltrados
      .filter((r) => estadoANS(r.datos?.['Estado_ANS_Oportunidad']) !== 'CUMPLE')
      .sort(ordenarPorWorkOrderID),
    [registrosFiltrados],
  )
  const registrosCumplimiento = useMemo(
    () => registrosFiltrados
      .filter((r) => estadoANS(r.datos?.['Estado_ANS_Cumplimiento']) !== 'CUMPLE')
      .sort(ordenarPorWorkOrderID),
    [registrosFiltrados],
  )
  const registrosInicio = useMemo(
    () => registrosFiltrados
      .filter((r) => estadoANS(r.datos?.['Estado_ANS_inicio_trabajo']) !== 'CUMPLE')
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
      <h1 className="titulo-pagina">Detalle ANS</h1>
      <p className="text-sm text-slate-500">Vista de seguimiento ANS para solicitudes de soporte.</p>

      {aviso && <div className="aviso aviso-error">{aviso}</div>}

      {/* ─── Filtros ─── */}
      <div className="tarjeta tarjeta-pad space-y-3">
        {/* Work Order ID + Assigned To */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="filtro-wo-ans">
              Filtrar por Work Order ID
            </label>
            <input
              id="filtro-wo-ans"
              className="campo mt-2 w-full"
              placeholder="Buscar Work Order ID…"
              value={filtroWo}
              onChange={(e) => {
                const v = e.target.value
                setFiltroWo(v)
                if (debounceRef.current) clearTimeout(debounceRef.current)
                debounceRef.current = setTimeout(() => void cargarANS(v), 500)
              }}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="filtro-assigned-ans">
              Filtrar por Assigned To
            </label>
            <select
              id="filtro-assigned-ans"
              className="campo mt-2 w-full"
              value={filtroAssignedTo}
              onChange={(e) => {
                const v = e.target.value
                setFiltroAssignedTo(v)
                void cargarANS(undefined, v)
              }}
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
          <p className="etiqueta-sup">
            📅 Filtrar por Fecha Fin Real
          </p>
          <div className="flex flex-wrap items-start gap-3">
            <FiltroDesplegable
              label="Año"
              icono="📅"
              opciones={anosDisponibles}
              activos={anosActivos}
              setActivos={setAnosActivos}
              anchoPanel="170px"
            />
            <FiltroDesplegable
              label="Mes"
              icono="🗓️"
              opciones={MESES_LABELS}
              activos={mesesActivos}
              setActivos={setMesesActivos}
              esMes
              anchoPanel="240px"
            />

            {hayFiltroFecha && (
              <button type="button" onClick={() => { setAnosActivos(new Set()); setMesesActivos(new Set()) }}
                className="btn btn-secundario btn-sm">
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
  const pct = data.total > 0 ? Number(((data.cumple / data.total) * 100).toFixed(2)) : 0
  return (
    <div className={`rounded-xl border p-4 ${colores.borde} ${colores.fondo}`}>
      <p className={`text-sm font-semibold ${colores.sub}`}>{titulo}</p>
      <p className={`text-2xl font-bold ${colores.texto}`}>{pct.toFixed(2)}%</p>
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
  const [visibles, setVisibles] = useState(50)

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
    <div className="tarjeta">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={abierta}
        className="flex w-full flex-col items-start gap-3 border-b border-slate-200 px-4 py-3 text-left hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 text-xs font-semibold text-marca">{abierta ? '▲ Ocultar' : '▼ Mostrar'}</span>
          <span className="truncate text-sm font-semibold text-slate-800">{titulo}</span>
        </div>
        <span className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
          <span className="chip chip-exito" title="Registros con ANS levantado">
            {totalLevantados} levantados
          </span>
          <span className="chip chip-neutro" title="Total de registros en esta sección">
            {registros.length} registros
          </span>
        </span>
      </button>
      {abierta && (
        <TablaScroll plano>
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
                registros.slice(0, visibles).map((r) => {
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
                            className="campo campo-sm min-w-0 flex-1"
                            placeholder={puedeActualizar ? 'Agregar observaciones…' : 'Sin observaciones'}
                          />
                          {puedeActualizar && (
                            <button
                              type="button"
                              onClick={() => void guardarObservacion(r)}
                              disabled={guardandoObservacion.has(r.id)}
                              className="btn btn-primario btn-sm self-start"
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
          {visibles < registros.length && (
            <div className="flex justify-center border-t p-3">
              <button
                type="button"
                onClick={() => setVisibles((v) => v + 50)}
                className="rounded bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
              >
                Mostrar más ({registros.length - visibles} restantes)
              </button>
            </div>
          )}
        </TablaScroll>
      )}
    </div>
  )
}