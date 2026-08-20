import { useCallback, useEffect, useMemo, useState } from 'react'
import client from '../api/client'
import { mensajeError, useLista } from '../api/hooks'
import type { Persona } from '../types'

interface Fila {
  key: string
  personaId: string
  nombre: string
  rol: string
  squad: string
  tipoContratacion: string
  opcionesLt: string[]
}

interface ControlHorasGuardado {
  persona_id: string
  squad: string
  lt_hitss: string
  horas_soporte: number
  horas_desarrollo: number
  horas_soporte_cerrado: number
  horas_desarrollo_cerrado: number
  horas_vacaciones: number
  horas_incapacidades: number
  horas_licencias: number
  horas_permisos: number
  otras_novedades: number
  horas_errores_analista: number
  horas_garantias: number
  horas_reprocesos: number
  otras_novedades_calidad: number
}

export default function ControlHorasFacturable() {
  const { datos: personas, cargando } = useLista<Persona>('/personas')
  const [busqueda, setBusqueda] = useState('')
  const [seleccionLt, setSeleccionLt] = useState<Record<string, string>>({})
  const [eliminadas, setEliminadas] = useState<Set<string>>(new Set())
  const [horasSoporte, setHorasSoporte] = useState<Record<string, number>>({})
  const [horasDesarrollo, setHorasDesarrollo] = useState<Record<string, number>>({})
  const [horasSopCerrado, setHorasSopCerrado] = useState<Record<string, number>>({})
  const [horasDesCerrado, setHorasDesCerrado] = useState<Record<string, number>>({})
  const [horasVac, setHorasVac] = useState<Record<string, number>>({})
  const [horasInc, setHorasInc] = useState<Record<string, number>>({})
  const [horasLic, setHorasLic] = useState<Record<string, number>>({})
  const [horasPerm, setHorasPerm] = useState<Record<string, number>>({})
  const [otrasNov, setOtrasNov] = useState<Record<string, number>>({})
  const [horasErr, setHorasErr] = useState<Record<string, number>>({})
  const [horasGar, setHorasGar] = useState<Record<string, number>>({})
  const [horasRep, setHorasRep] = useState<Record<string, number>>({})
  const [otrasNovCal, setOtrasNovCal] = useState<Record<string, number>>({})
  const [guardandoFila, setGuardandoFila] = useState<Set<string>>(new Set())
  const [guardandoTodos, setGuardandoTodos] = useState(false)
  const [aviso, setAviso] = useState('')
  const [avisoOk, setAvisoOk] = useState('')

  // Cargar datos guardados
  useEffect(() => {
    client.get<ControlHorasGuardado[]>('/control-horas')
      .then(({ data }) => {
        const lt: Record<string, string> = {}
        const hs: Record<string, number> = {}
        const hd: Record<string, number> = {}
        const hsc: Record<string, number> = {}
        const hdc: Record<string, number> = {}
        const hv: Record<string, number> = {}
        const hi: Record<string, number> = {}
        const hl: Record<string, number> = {}
        const hp: Record<string, number> = {}
        const on: Record<string, number> = {}
        const he: Record<string, number> = {}
        const hg: Record<string, number> = {}
        const hr: Record<string, number> = {}
        const onc: Record<string, number> = {}
        for (const r of data) {
          const k = `${r.persona_id}_${r.squad}`
          if (r.lt_hitss) lt[k] = r.lt_hitss
          if (r.horas_soporte) hs[k] = r.horas_soporte
          if (r.horas_desarrollo) hd[k] = r.horas_desarrollo
          if (r.horas_soporte_cerrado) hsc[k] = r.horas_soporte_cerrado
          if (r.horas_desarrollo_cerrado) hdc[k] = r.horas_desarrollo_cerrado
          if (r.horas_vacaciones) hv[k] = r.horas_vacaciones
          if (r.horas_incapacidades) hi[k] = r.horas_incapacidades
          if (r.horas_licencias) hl[k] = r.horas_licencias
          if (r.horas_permisos) hp[k] = r.horas_permisos
          if (r.otras_novedades) on[k] = r.otras_novedades
          if (r.horas_errores_analista) he[k] = r.horas_errores_analista
          if (r.horas_garantias) hg[k] = r.horas_garantias
          if (r.horas_reprocesos) hr[k] = r.horas_reprocesos
          if (r.otras_novedades_calidad) onc[k] = r.otras_novedades_calidad
        }
        setSeleccionLt((prev) => ({ ...lt, ...prev }))
        setHorasSoporte((prev) => ({ ...hs, ...prev }))
        setHorasDesarrollo((prev) => ({ ...hd, ...prev }))
        setHorasSopCerrado((prev) => ({ ...hsc, ...prev }))
        setHorasDesCerrado((prev) => ({ ...hdc, ...prev }))
        setHorasVac((prev) => ({ ...hv, ...prev }))
        setHorasInc((prev) => ({ ...hi, ...prev }))
        setHorasLic((prev) => ({ ...hl, ...prev }))
        setHorasPerm((prev) => ({ ...hp, ...prev }))
        setOtrasNov((prev) => ({ ...on, ...prev }))
        setHorasErr((prev) => ({ ...he, ...prev }))
        setHorasGar((prev) => ({ ...hg, ...prev }))
        setHorasRep((prev) => ({ ...hr, ...prev }))
        setOtrasNovCal((prev) => ({ ...onc, ...prev }))
      })
      .catch(() => {})
  }, [personas])

  // Todos los LT_HITSS activos
  const ltHitssPersonas = useMemo(
    () => personas.filter((p) => p.rol_operativo === 'LT_HITSS' && p.activo),
    [personas],
  )

  // Mapa squad → lista de nombres de LT_HITSS de ese squad
  const ltHitssPorSquad = useMemo(() => {
    const mapa = new Map<string, string[]>()
    for (const p of ltHitssPersonas) {
      for (const sq of p.squads) {
        if (!mapa.has(sq)) mapa.set(sq, [])
        const lista = mapa.get(sq)!
        if (!lista.includes(p.nombre)) lista.push(p.nombre)
      }
    }
    return mapa
  }, [ltHitssPersonas])

  // Una fila por squad (duplica personas con 2+ squads)
  const filasBase = useMemo<Fila[]>(() => {
    const resultado: Fila[] = []
    for (const p of personas) {
      if (p.rol_operativo === 'LT_EPM' || !p.activo) continue
      const squads = p.squads.length > 0 ? p.squads : ['—']
      for (const sq of squads) {
        const opciones = (ltHitssPorSquad.get(sq) ?? []).sort((a, b) => a.localeCompare(b, 'es'))
        resultado.push({
          key: `${p.id}_${sq}`,
          personaId: p.id,
          nombre: p.nombre,
          rol: p.rol_operativo,
          squad: sq,
          tipoContratacion: p.tipo_contratacion ?? '—',
          opcionesLt: opciones,
        })
      }
    }
    return resultado.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [personas, ltHitssPorSquad])

  const filas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return filasBase
      .filter((f) => !eliminadas.has(f.key))
      .filter((f) => !q || f.nombre.toLowerCase().includes(q) || f.squad.toLowerCase().includes(q))
  }, [filasBase, eliminadas, busqueda])

  function ltSeleccionado(fila: Fila): string {
    return seleccionLt[fila.key] ?? fila.opcionesLt[0] ?? '—'
  }

  function cambiarLt(key: string, valor: string) {
    setSeleccionLt((prev) => ({ ...prev, [key]: valor }))
  }

  function jalarAbajo(desdeIndex: number) {
    const fila = filas[desdeIndex]
    if (!fila) return
    const valor = ltSeleccionado(fila)
    if (valor === '—') return
    setSeleccionLt((prev) => {
      const siguiente = { ...prev }
      for (let i = desdeIndex + 1; i < filas.length; i++) {
        siguiente[filas[i].key] = valor
      }
      return siguiente
    })
  }

  function eliminarFila(key: string) {
    setEliminadas((prev) => new Set(prev).add(key))
  }

  function restaurarTodo() {
    setEliminadas(new Set())
  }

  function datosParaGuardar(fila: Fila) {
    return {
      persona_id: fila.personaId,
      squad: fila.squad,
      lt_hitss: ltSeleccionado(fila),
      horas_soporte: horasSoporte[fila.key] ?? 0,
      horas_desarrollo: horasDesarrollo[fila.key] ?? 0,
      horas_soporte_cerrado: horasSopCerrado[fila.key] ?? 0,
      horas_desarrollo_cerrado: horasDesCerrado[fila.key] ?? 0,
      horas_vacaciones: horasVac[fila.key] ?? 0,
      horas_incapacidades: horasInc[fila.key] ?? 0,
      horas_licencias: horasLic[fila.key] ?? 0,
      horas_permisos: horasPerm[fila.key] ?? 0,
      otras_novedades: otrasNov[fila.key] ?? 0,
      horas_errores_analista: horasErr[fila.key] ?? 0,
      horas_garantias: horasGar[fila.key] ?? 0,
      horas_reprocesos: horasRep[fila.key] ?? 0,
      otras_novedades_calidad: otrasNovCal[fila.key] ?? 0,
    }
  }

  async function guardarUno(fila: Fila) {
    setGuardandoFila((prev) => new Set(prev).add(fila.key))
    setAviso('')
    setAvisoOk('')
    try {
      await client.put('/control-horas/registro', datosParaGuardar(fila))
      setAvisoOk(`Guardado: ${fila.nombre} — ${fila.squad}`)
    } catch (err) {
      setAviso(mensajeError(err))
    } finally {
      setGuardandoFila((prev) => { const n = new Set(prev); n.delete(fila.key); return n })
    }
  }

  async function guardarTodos() {
    setGuardandoTodos(true)
    setAviso('')
    setAvisoOk('')
    try {
      const registros = filas.map(datosParaGuardar)
      const { data } = await client.put<{ guardados: number }>('/control-horas/todos', { registros })
      setAvisoOk(`${data.guardados} registros guardados correctamente`)
    } catch (err) {
      setAviso(mensajeError(err))
    } finally {
      setGuardandoTodos(false)
    }
  }

  // Todos los LT_HITSS únicos para el selector global
  const todosLtNombres = useMemo(
    () => ltHitssPersonas.map((p) => p.nombre).sort((a, b) => a.localeCompare(b, 'es')),
    [ltHitssPersonas],
  )

  function aplicarATodos(valor: string) {
    setSeleccionLt((prev) => {
      const siguiente = { ...prev }
      for (const f of filas) {
        siguiente[f.key] = valor
      }
      return siguiente
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-marca-osc">Control de Horas Facturable</h1>
        <p className="mt-1 text-sm text-slate-500">
          Listado de personas con su líder técnico HITSS. Use el selector o el botón ↓ para aplicar en bloque.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-3">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Buscar persona o squad</span>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar…"
            className="rounded border px-3 py-2 text-sm w-64"
          />
        </label>
        {busqueda && (
          <button onClick={() => setBusqueda('')} className="text-xs text-red-500 hover:underline self-end pb-2">
            Limpiar
          </button>
        )}

        {/* Aplicar LT_HITSS a todos */}
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Aplicar LT HITSS a todos</span>
          <select
            onChange={(e) => { if (e.target.value) aplicarATodos(e.target.value); e.target.value = '' }}
            defaultValue=""
            className="rounded border px-3 py-2 text-sm"
          >
            <option value="" disabled>Seleccionar…</option>
            {todosLtNombres.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>

        <span className="ml-auto text-xs text-slate-400 self-end pb-2">
          {filas.length} registros
          {eliminadas.size > 0 && (
            <button onClick={restaurarTodo} className="ml-2 text-xs text-blue-600 hover:underline">
              Restaurar {eliminadas.size} eliminados
            </button>
          )}
        </span>
      </div>

      {aviso && <div className="rounded bg-red-50 p-2 text-sm text-red-700">{aviso}</div>}
      {avisoOk && <div className="rounded bg-green-50 p-2 text-sm text-green-700">{avisoOk}</div>}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void guardarTodos()}
          disabled={guardandoTodos || filas.length === 0}
          className="rounded bg-marca px-4 py-2 text-sm font-semibold text-white hover:bg-marca-osc disabled:opacity-50"
        >
          {guardandoTodos ? 'Guardando…' : `💾 Guardar todos (${filas.length})`}
        </button>
      </div>

      <div className="w-full max-h-[70vh] overflow-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10 bg-marca-osc text-white">
            <tr>
              <th className="p-2 text-left">Nombre</th>
              <th className="p-2 text-left">LT HITSS</th>
              <th className="p-2 text-left">Squad</th>
              <th className="p-2 text-left">Rol</th>
              <th className="p-2 text-left">Tipo Contratación</th>
              <th className="p-2 text-right">Horas Facturables</th>
              <th className="p-2 text-right">Horas Soporte Proy.</th>
              <th className="p-2 text-right">Horas Desarrollo Proy.</th>
              <th className="p-2 text-right">Total Horas Fact. Proy.</th>
              <th className="p-2 text-right">Validación Meta 200</th>
              <th className="p-2 text-right">Horas Soporte Cerrado</th>
              <th className="p-2 text-right">Horas Desarrollo Cerrado</th>
              <th className="p-2 text-right">Total Horas Fact. Cerrado</th>
              <th className="p-2 text-right">% Cumplimiento Fact.</th>
              <th className="p-2 text-right">Horas Vacaciones</th>
              <th className="p-2 text-right">Horas Incapacidades</th>
              <th className="p-2 text-right">Horas Licencias / Ley</th>
              <th className="p-2 text-right">Horas Permisos / Cap.</th>
              <th className="p-2 text-right">Otras Novedades Adm.</th>
              <th className="p-2 text-right">Total Novedades Adm.</th>
              <th className="p-2 text-right">Horas Errores Analista</th>
              <th className="p-2 text-right">Horas Garantías</th>
              <th className="p-2 text-right">Horas Reprocesos</th>
              <th className="p-2 text-right">Otras Nov. Calidad</th>
              <th className="p-2 text-right">Total Nov. Calidad</th>
              <th className="p-2 text-right">Total Horas Registradas</th>
              <th className="p-2 text-right">Horas Backfill / Refuerzo</th>
              <th className="p-2 w-20"></th>
              <th className="p-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={29} className="p-4 text-center text-slate-400">Cargando…</td>
              </tr>
            )}
            {!cargando && filas.length === 0 && (
              <tr>
                <td colSpan={29} className="p-4 text-center text-slate-400">Sin registros.</td>
              </tr>
            )}
            {!cargando && filas.map((f, idx) => {
              const valor = ltSeleccionado(f)
              const tieneOpciones = f.opcionesLt.length > 1
              return (
                <tr key={f.key} className="border-t hover:bg-slate-50">
                  <td className="p-2 font-medium text-slate-800">{f.nombre}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-1">
                      {tieneOpciones ? (
                        <select
                          value={valor}
                          onChange={(e) => cambiarLt(f.key, e.target.value)}
                          className="rounded border border-slate-300 px-2 py-1 text-sm"
                        >
                          {f.opcionesLt.map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-slate-600">{valor}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => jalarAbajo(idx)}
                        title="Aplicar este LT HITSS a todas las filas de abajo"
                        className="ml-1 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                      >
                        ↓
                      </button>
                    </div>
                  </td>
                  <td className="p-2 text-slate-600">{f.squad}</td>
                  <td className="p-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      f.rol === 'LT_HITSS' ? 'bg-blue-100 text-blue-700'
                      : f.rol === 'SCRUM' ? 'bg-purple-100 text-purple-700'
                      : f.rol === 'DEV' ? 'bg-green-100 text-green-700'
                      : 'bg-slate-100 text-slate-600'
                    }`}>
                      {f.rol}
                    </span>
                  </td>
                  <td className="p-2 text-slate-600">{f.tipoContratacion}</td>
                  <td className="p-2 text-right font-mono text-slate-700">200</td>
                  <td className="p-2">
                    <input
                      type="number"
                      value={horasSoporte[f.key] ?? 0}
                      onChange={(e) => setHorasSoporte((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))}
                      className="w-20 rounded border border-slate-300 px-2 py-1 text-sm text-right"
                      min={0}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      value={horasDesarrollo[f.key] ?? 0}
                      onChange={(e) => setHorasDesarrollo((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))}
                      className="w-20 rounded border border-slate-300 px-2 py-1 text-sm text-right"
                      min={0}
                    />
                  </td>
                  <td className="p-2 text-right font-mono font-semibold text-marca-osc">
                    {(horasSoporte[f.key] ?? 0) + (horasDesarrollo[f.key] ?? 0)}
                  </td>
                  {(() => {
                    const total = (horasSoporte[f.key] ?? 0) + (horasDesarrollo[f.key] ?? 0);
                    const diff = total - 200;
                    return (
                      <td className={`p-2 text-right font-mono font-semibold ${
                        diff === 0 ? 'text-blue-600' : diff > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {diff === 0 ? '✓ OK' : diff > 0 ? `+${diff}` : `${diff}`}
                      </td>
                    );
                  })()}
                  <td className="p-2">
                    <input
                      type="number"
                      value={horasSopCerrado[f.key] ?? 0}
                      onChange={(e) => setHorasSopCerrado((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))}
                      className="w-20 rounded border border-slate-300 px-2 py-1 text-sm text-right"
                      min={0}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      value={horasDesCerrado[f.key] ?? 0}
                      onChange={(e) => setHorasDesCerrado((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))}
                      className="w-20 rounded border border-slate-300 px-2 py-1 text-sm text-right"
                      min={0}
                    />
                  </td>
                  <td className="p-2 text-right font-mono font-semibold text-marca-osc">
                    {(horasSopCerrado[f.key] ?? 0) + (horasDesCerrado[f.key] ?? 0)}
                  </td>
                  {(() => {
                    const totalCerrado = (horasSopCerrado[f.key] ?? 0) + (horasDesCerrado[f.key] ?? 0);
                    const pct = Math.round((totalCerrado / 200) * 100);
                    return (
                      <td className={`p-2 text-right font-mono font-semibold ${
                        pct >= 100 ? 'text-green-600' : pct >= 75 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {pct}%
                      </td>
                    );
                  })()}
                  <td className="p-2">
                    <input type="number" value={horasVac[f.key] ?? 0}
                      onChange={(e) => setHorasVac((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))}
                      className="w-20 rounded border border-slate-300 px-2 py-1 text-sm text-right" min={0} />
                  </td>
                  <td className="p-2">
                    <input type="number" value={horasInc[f.key] ?? 0}
                      onChange={(e) => setHorasInc((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))}
                      className="w-20 rounded border border-slate-300 px-2 py-1 text-sm text-right" min={0} />
                  </td>
                  <td className="p-2">
                    <input type="number" value={horasLic[f.key] ?? 0}
                      onChange={(e) => setHorasLic((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))}
                      className="w-20 rounded border border-slate-300 px-2 py-1 text-sm text-right" min={0} />
                  </td>
                  <td className="p-2">
                    <input type="number" value={horasPerm[f.key] ?? 0}
                      onChange={(e) => setHorasPerm((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))}
                      className="w-20 rounded border border-slate-300 px-2 py-1 text-sm text-right" min={0} />
                  </td>
                  <td className="p-2">
                    <input type="number" value={otrasNov[f.key] ?? 0}
                      onChange={(e) => setOtrasNov((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))}
                      className="w-20 rounded border border-slate-300 px-2 py-1 text-sm text-right" min={0} />
                  </td>
                  <td className="p-2 text-right font-mono font-semibold text-marca-osc">
                    {(horasVac[f.key] ?? 0) + (horasInc[f.key] ?? 0) + (horasLic[f.key] ?? 0) + (horasPerm[f.key] ?? 0) + (otrasNov[f.key] ?? 0)}
                  </td>
                  <td className="p-2">
                    <input type="number" value={horasErr[f.key] ?? 0}
                      onChange={(e) => setHorasErr((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))}
                      className="w-20 rounded border border-slate-300 px-2 py-1 text-sm text-right" min={0} />
                  </td>
                  <td className="p-2">
                    <input type="number" value={horasGar[f.key] ?? 0}
                      onChange={(e) => setHorasGar((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))}
                      className="w-20 rounded border border-slate-300 px-2 py-1 text-sm text-right" min={0} />
                  </td>
                  <td className="p-2">
                    <input type="number" value={horasRep[f.key] ?? 0}
                      onChange={(e) => setHorasRep((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))}
                      className="w-20 rounded border border-slate-300 px-2 py-1 text-sm text-right" min={0} />
                  </td>
                  <td className="p-2">
                    <input type="number" value={otrasNovCal[f.key] ?? 0}
                      onChange={(e) => setOtrasNovCal((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))}
                      className="w-20 rounded border border-slate-300 px-2 py-1 text-sm text-right" min={0} />
                  </td>
                  <td className="p-2 text-right font-mono font-semibold text-marca-osc">
                    {(horasErr[f.key] ?? 0) + (horasGar[f.key] ?? 0) + (horasRep[f.key] ?? 0) + (otrasNovCal[f.key] ?? 0)}
                  </td>
                  <td className="p-2 text-right font-mono font-bold text-slate-800">
                    {(horasSopCerrado[f.key] ?? 0) + (horasDesCerrado[f.key] ?? 0)
                      + (horasVac[f.key] ?? 0) + (horasInc[f.key] ?? 0) + (horasLic[f.key] ?? 0) + (horasPerm[f.key] ?? 0) + (otrasNov[f.key] ?? 0)
                      + (horasErr[f.key] ?? 0) + (horasGar[f.key] ?? 0) + (horasRep[f.key] ?? 0) + (otrasNovCal[f.key] ?? 0)}
                  </td>
                  <td className="p-2 text-right font-mono font-semibold text-orange-600">
                    {(horasVac[f.key] ?? 0) + (horasInc[f.key] ?? 0) + (horasLic[f.key] ?? 0) + (horasPerm[f.key] ?? 0) + (otrasNov[f.key] ?? 0)
                      + (horasErr[f.key] ?? 0) + (horasGar[f.key] ?? 0) + (horasRep[f.key] ?? 0) + (otrasNovCal[f.key] ?? 0)}
                  </td>
                  <td className="p-2 text-center">
                    <button
                      type="button"
                      onClick={() => void guardarUno(f)}
                      disabled={guardandoFila.has(f.key)}
                      title="Guardar este registro"
                      className="rounded bg-marca px-2 py-1 text-xs text-white hover:bg-marca-osc disabled:opacity-50"
                    >
                      {guardandoFila.has(f.key) ? '…' : '💾'}
                    </button>
                  </td>
                  <td className="p-2 text-center">
                    <button
                      type="button"
                      onClick={() => eliminarFila(f.key)}
                      title="Quitar este registro"
                      className="rounded p-1 text-slate-400 hover:bg-red-100 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
