import { useMemo, useState } from 'react'
import { useLista } from '../api/hooks'
import type { Persona } from '../types'

export default function ControlHorasFacturable() {
  const { datos: personas, cargando } = useLista<Persona>('/personas')
  const [busqueda, setBusqueda] = useState('')

  // Mapa squad → nombre del LT_HITSS de ese squad
  const ltHitssPorSquad = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const p of personas) {
      if (p.rol_operativo === 'LT_HITSS' && p.activo) {
        for (const sq of p.squads) {
          mapa.set(sq, p.nombre)
        }
      }
    }
    return mapa
  }, [personas])

  // Personas sin LT_EPM, con su LT_HITSS resuelto
  const filas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return personas
      .filter((p) => p.rol_operativo !== 'LT_EPM' && p.activo)
      .map((p) => {
        const ltNombre = p.squads
          .map((sq) => ltHitssPorSquad.get(sq))
          .find((n) => !!n) ?? '—'
        return {
          id: p.id,
          nombre: p.nombre,
          rol: p.rol_operativo,
          squad: p.squads.join(', ') || '—',
          ltHitss: ltNombre,
        }
      })
      .filter((f) => !q || f.nombre.toLowerCase().includes(q) || f.squad.toLowerCase().includes(q))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [personas, ltHitssPorSquad, busqueda])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-marca-osc">Control de Horas Facturable</h1>
        <p className="mt-1 text-sm text-slate-500">
          Listado de personas con su líder técnico HITSS asignado.
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
            {!cargando && filas.map((f) => (
              <tr key={f.id} className="border-t hover:bg-slate-50">
                <td className="p-2 font-medium text-slate-800">{f.nombre}</td>
                <td className="p-2 text-slate-600">{f.ltHitss}</td>
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
