import { useMemo, useState } from 'react'
import { useLista } from '../api/hooks'
import type { Persona } from '../types'

interface Fila {
  key: string       // persona_id + squad
  personaId: string
  nombre: string
  rol: string
  squad: string
  tipoContratacion: string
  opcionesLt: string[]
}

export default function ControlHorasFacturable() {
  const { datos: personas, cargando } = useLista<Persona>('/personas')
  const [busqueda, setBusqueda] = useState('')
  const [seleccionLt, setSeleccionLt] = useState<Record<string, string>>({})
  const [eliminadas, setEliminadas] = useState<Set<string>>(new Set())
  const [horasSoporte, setHorasSoporte] = useState<Record<string, number>>({})
  const [horasDesarrollo, setHorasDesarrollo] = useState<Record<string, number>>({})

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
              <th className="p-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={9} className="p-4 text-center text-slate-400">Cargando…</td>
              </tr>
            )}
            {!cargando && filas.length === 0 && (
              <tr>
                <td colSpan={9} className="p-4 text-center text-slate-400">Sin registros.</td>
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
