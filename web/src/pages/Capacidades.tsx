import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import client from '../api/client'
import { mensajeError, useLista } from '../api/hooks'
import type { Capacidad, Persona } from '../types'

export default function Capacidades() {
  const { datos, error, recargar } = useLista<Capacidad>('/capacidades')
  const { datos: personas } = useLista<Persona>('/personas')
  const [personaId, setPersonaId] = useState('')
  const [mes, setMes] = useState('')
  const [horas, setHoras] = useState('180')
  const [aviso, setAviso] = useState('')
  const [editCell, setEditCell] = useState<{ id: string; campo: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const cancelarBlurRef = useRef(false)

  const nombrePersona = (id: string | null): string =>
    (id && personas.find((p) => p.id === id)?.nombre) || '—'

  function iniciarEdicion(id: string, campo: string, valorActual: string) {
    setEditCell({ id, campo })
    setEditValue(valorActual)
    cancelarBlurRef.current = false
  }

  function cancelarEdicion() {
    cancelarBlurRef.current = true
    setEditCell(null)
    setEditValue('')
  }

  async function guardarEdicion(capacidad: Capacidad) {
    if (!editCell) return
    try {
      const payload = {
        scope: 'persona',
        persona_id: capacidad.persona_id,
        mes: capacidad.mes,
        horas_disponibles: Number(editValue),
      }
      await client.put(`/capacidades/${capacidad.id}`, payload)
      setEditCell(null)
      setEditValue('')
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  async function crear(e: FormEvent): Promise<void> {
    e.preventDefault()
    setAviso('')
    try {
      await client.post('/capacidades', {
        scope: 'persona',
        persona_id: personaId,
        mes,
        horas_disponibles: Number(horas),
      })
      setMes('')
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  async function eliminar(capacidad: Capacidad): Promise<void> {
    await client.delete(`/capacidades/${capacidad.id}`)
    recargar()
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-marca-osc">Capacidades mensuales</h1>

      <form onSubmit={crear} className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Persona</span>
          <select value={personaId} onChange={(e) => setPersonaId(e.target.value)} required
            className="rounded border px-3 py-2">
            <option value="">— Seleccionar —</option>
            {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Mes</span>
          <input value={mes} onChange={(e) => setMes(e.target.value)} type="month" required
            className="rounded border px-3 py-2" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Horas disponibles</span>
          <input value={horas} onChange={(e) => setHoras(e.target.value)} type="number" required
            className="w-32 rounded border px-3 py-2" />
        </label>
        <button className="rounded bg-marca px-4 py-2 text-white hover:bg-marca-osc">Crear</button>
      </form>

      {(aviso || error) && (
        <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{aviso || error}</div>
      )}

      <table className="w-full overflow-hidden rounded-xl border bg-white text-sm">
        <thead className="bg-marca-osc text-white">
          <tr>
            <th className="p-2 text-left">Persona</th>
            <th className="p-2 text-left">Mes</th>
            <th className="p-2 text-right">Horas disponibles</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {datos.map((c) => (
            <tr key={c.id} className="border-t">
              <td className="p-2">{nombrePersona(c.persona_id)}</td>
              <td className="p-2">{c.mes}</td>
              <td
                className="cursor-pointer p-2 text-right"
                title="Doble clic para editar"
                onDoubleClick={() => iniciarEdicion(c.id, 'horas_disponibles', String(c.horas_disponibles))}
              >
                {editCell?.id === c.id && editCell.campo === 'horas_disponibles' ? (
                  <input
                    autoFocus
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => {
                      if (cancelarBlurRef.current) {
                        cancelarBlurRef.current = false
                        return
                      }
                      void guardarEdicion(c)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        e.currentTarget.blur()
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault()
                        cancelarEdicion()
                      }
                    }}
                    className="w-24 rounded border px-2 py-1 text-right"
                  />
                ) : c.horas_disponibles}
              </td>
              <td className="p-2 text-center">
                <button onClick={() => eliminar(c)} className="text-red-600 hover:underline">
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
          {datos.length === 0 && (
            <tr><td colSpan={4} className="p-4 text-center text-slate-400">Sin capacidades.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
