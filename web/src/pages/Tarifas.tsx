import { useState } from 'react'
import type { FormEvent } from 'react'
import client from '../api/client'
import { mensajeError, useLista } from '../api/hooks'
import type { Tarifa } from '../types'

const RAMIFICACIONES = ['Fábrica', 'Soporte']

export default function Tarifas() {
  const { datos, error, recargar } = useLista<Tarifa>('/tarifas')
  const [anio, setAnio] = useState(String(new Date().getFullYear()))
  const [valorHora, setValorHora] = useState('')
  const [ramificacion, setRamificacion] = useState(RAMIFICACIONES[0])
  const [aviso, setAviso] = useState('')
  const [editCell, setEditCell] = useState<{ id: string; campo: string } | null>(null)
  const [editValue, setEditValue] = useState('')

  // ── Popup edición ──
  const [editItem, setEditItem] = useState<Tarifa | null>(null)
  const [editAnio, setEditAnio] = useState('')
  const [editValorHora, setEditValorHora] = useState('')
  const [editRamificacion, setEditRamificacion] = useState('')

  function abrirEdicion(t: Tarifa) {
    setEditItem(t)
    setEditAnio(String(t.anio))
    setEditValorHora(String(t.valor_hora))
    setEditRamificacion(t.ramificacion ?? RAMIFICACIONES[0])
  }

  async function guardarPopup(): Promise<void> {
    if (!editItem) return
    setAviso('')
    try {
      await client.put(`/tarifas/${editItem.id}`, {
        anio: Number(editAnio),
        valor_hora: Number(editValorHora),
        ramificacion: editRamificacion,
      })
      setEditItem(null)
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  function iniciarEdicion(id: string, campo: string, valorActual: string) {
    setAviso('')
    setEditCell({ id, campo })
    setEditValue(valorActual)
  }

  async function guardarEdicion(tarifa: Tarifa): Promise<void> {
    if (!editCell || editCell.id !== tarifa.id) return
    try {
      const payload = {
        anio: editCell.campo === 'anio' ? Number(editValue) : tarifa.anio,
        valor_hora: editCell.campo === 'valor_hora' ? Number(editValue) : tarifa.valor_hora,
        ramificacion: editCell.campo === 'ramificacion' ? editValue : tarifa.ramificacion,
      }
      await client.put(`/tarifas/${tarifa.id}`, payload)
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
      await client.post('/tarifas', {
        anio: Number(anio),
        valor_hora: Number(valorHora),
        ramificacion,
      })
      setValorHora('')
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  async function eliminar(tarifa: Tarifa): Promise<void> {
    await client.delete(`/tarifas/${tarifa.id}`)
    recargar()
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-marca-osc">Tarifas</h1>

      <form onSubmit={crear} className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Año</span>
          <input value={anio} onChange={(e) => setAnio(e.target.value)} type="number" required
            className="w-24 rounded border px-3 py-2" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Valor hora</span>
          <input value={valorHora} onChange={(e) => setValorHora(e.target.value)} type="number" required
            className="w-32 rounded border px-3 py-2" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Ramificación</span>
          <select value={ramificacion} onChange={(e) => setRamificacion(e.target.value)}
            className="rounded border px-3 py-2">
            {RAMIFICACIONES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <button className="rounded bg-marca px-4 py-2 text-white hover:bg-marca-osc">Crear</button>
      </form>

      {(aviso || error) && (
        <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{aviso || error}</div>
      )}

      <table className="w-full overflow-hidden rounded-xl border bg-white text-sm">
        <thead className="bg-marca-osc text-white">
          <tr>
            <th className="p-2 text-left">Año</th>
            <th className="p-2 text-right">Valor hora</th>
            <th className="p-2 text-left">Ramificación</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {datos.map((t) => (
            <tr key={t.id} className="border-t">
              <td
                className="p-2 cursor-pointer"
                title="Doble clic para editar"
                onDoubleClick={() => iniciarEdicion(t.id, 'anio', String(t.anio))}
              >
                {editCell?.id === t.id && editCell.campo === 'anio' ? (
                  <input
                    autoFocus
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => void guardarEdicion(t)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        e.currentTarget.blur()
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault()
                        setEditCell(null)
                        setEditValue('')
                      }
                    }}
                    className="w-full rounded border px-2 py-1"
                  />
                ) : (
                  t.anio
                )}
              </td>
              <td
                className="p-2 text-right cursor-pointer"
                title="Doble clic para editar"
                onDoubleClick={() => iniciarEdicion(t.id, 'valor_hora', String(t.valor_hora))}
              >
                {editCell?.id === t.id && editCell.campo === 'valor_hora' ? (
                  <input
                    autoFocus
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => void guardarEdicion(t)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        e.currentTarget.blur()
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault()
                        setEditCell(null)
                        setEditValue('')
                      }
                    }}
                    className="w-full rounded border px-2 py-1 text-right"
                  />
                ) : (
                  t.valor_hora
                )}
              </td>
              <td
                className="p-2 cursor-pointer"
                title="Doble clic para editar"
                onDoubleClick={() => iniciarEdicion(t.id, 'ramificacion', t.ramificacion ?? RAMIFICACIONES[0])}
              >
                {editCell?.id === t.id && editCell.campo === 'ramificacion' ? (
                  <select
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => void guardarEdicion(t)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        e.currentTarget.blur()
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault()
                        setEditCell(null)
                        setEditValue('')
                      }
                    }}
                    className="w-full rounded border px-2 py-1"
                  >
                    {RAMIFICACIONES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                ) : (
                  t.ramificacion ?? '—'
                )}
              </td>
              <td className="p-2 text-center">
                <div className="flex justify-center gap-2">
                  <button onClick={() => abrirEdicion(t)} className="text-amber-600 hover:underline">
                    Editar
                  </button>
                  <button onClick={() => eliminar(t)} className="text-red-600 hover:underline">
                    Eliminar
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {datos.length === 0 && (
            <tr><td colSpan={4} className="p-4 text-center text-slate-400">Sin tarifas.</td></tr>
          )}
        </tbody>
      </table>

      {/* ═══ Modal edición ═══ */}
      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setEditItem(null)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-bold text-marca-osc">Editar tarifa</h2>
            <div className="mb-3">
              <label className="mb-1 block text-sm text-slate-600">Año</label>
              <input value={editAnio} onChange={(e) => setEditAnio(e.target.value)}
                type="number" className="w-full rounded border px-3 py-2" />
            </div>
            <div className="mb-3">
              <label className="mb-1 block text-sm text-slate-600">Valor hora</label>
              <input value={editValorHora} onChange={(e) => setEditValorHora(e.target.value)}
                type="number" className="w-full rounded border px-3 py-2" />
            </div>
            <div className="mb-4">
              <label className="mb-1 block text-sm text-slate-600">Ramificación</label>
              <select value={editRamificacion} onChange={(e) => setEditRamificacion(e.target.value)}
                className="w-full rounded border px-3 py-2">
                {RAMIFICACIONES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditItem(null)}
                className="rounded border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={guardarPopup}
                className="rounded bg-marca px-4 py-2 text-sm text-white hover:bg-marca-osc">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
