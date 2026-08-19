import { useMemo, useState } from 'react'
import { useLista } from '../api/hooks'
import type { Persona } from '../types'

interface Fila {
  id: string
  nombre: string
  rol: string
  squad: string
  opcionesLt: string[]  // nombres de LT_HITSS disponibles
}

export default function ControlHorasFacturable() {
  const { datos: personas, cargando } = useLista<Persona>('/personas')
  const [busqueda, setBusqueda] = useState('')
  const [seleccionLt, setSeleccionLt] = useState<Record<string, string>>({})

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

  // Personas sin LT_EPM, con opciones de LT_HITSS
  const filas = useMemo<Fila[]>(() => {
    const q = busqueda.trim().toLowerCase()
    return personas
      .filter((p) => p.rol_operativo !== 'LT_EPM' && p.activo)
      .map((p) => {
        const opciones = new Set<string>()
        for (const sq of p.squads) {
          for (const n of ltHitssPorSquad.get(sq) ?? []) opciones.add(n)
        }
        return {
          id: p.id,
          nombre: p.nombre,
          rol: p.rol_operativo,
          squad: p.squads.join(', ') || '—',
          opcionesLt: Array.from(opciones).sort((a, b) => a.localeCompare(b, 'es')),
        }
      })
      .filter((f) => !q || f.nombre.toLowerCase().includes(q) || f.squad.toLowerCase().includes(q))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [personas, ltHitssPorSquad, busqueda])

  function ltSeleccionado(fila: Fila): string {
    return seleccionLt[fila.id] ?? fila.opcionesLt[0] ?? '—'
  }

  function cambiarLt(id: string, valor: string) {
    setSeleccionLt((prev) => ({ ...prev, [id]: valor }))
  }

  function jalarAbajo(desdeIndex: number) {
    const fila = filas[desdeIndex]
    if (!fila) return
    const valor = ltSeleccionado(fila)
    if (valor === '—') return
    setSeleccionLt((prev) => {
      const siguiente = { ...prev }
      for (let i = desdeIndex + 1; i < filas.length; i++) {
        siguiente[filas[i].id] = valor
      }
      return siguiente
    })
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
        siguiente[f.id] = valor
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
          {filas.length} personas
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
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={4} className="p-4 text-center text-slate-400">Cargando…</td>
              </tr>
            )}
            {!cargando && filas.length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-center text-slate-400">Sin personas.</td>
              </tr>
            )}
            {!cargando && filas.map((f, idx) => {
              const valor = ltSeleccionado(f)
              const tieneOpciones = f.opcionesLt.length > 1
              return (
                <tr key={f.id} className="border-t hover:bg-slate-50">
                  <td className="p-2 font-medium text-slate-800">{f.nombre}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-1">
                      {tieneOpciones ? (
                        <select
                          value={valor}
                          onChange={(e) => cambiarLt(f.id, e.target.value)}
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
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
