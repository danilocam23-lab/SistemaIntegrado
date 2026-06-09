import { useState } from 'react'
import type { FormEvent } from 'react'
import client from '../api/client'
import { mensajeError, useLista } from '../api/hooks'
import type { Acta } from '../types'

export default function Actas() {
  const { datos, error, recargar } = useLista<Acta>('/actas')
  const [codigo, setCodigo] = useState('')
  const [fecha, setFecha] = useState('')
  const [direccion, setDireccion] = useState('')
  const [aviso, setAviso] = useState('')
  const [editCell, setEditCell] = useState<{ id: string; campo: string } | null>(null)
  const [editValue, setEditValue] = useState('')

  function iniciarEdicion(id: string, campo: string, valorActual: string) {
    setAviso('')
    setEditCell({ id, campo })
    setEditValue(valorActual)
  }

  async function guardarEdicion(acta: Acta): Promise<void> {
    if (!editCell || editCell.id !== acta.id) return
    try {
      const payload = {
        codigo: editCell.campo === 'codigo' ? editValue : acta.codigo,
        fecha: editCell.campo === 'fecha' ? editValue || null : acta.fecha,
        direccion: editCell.campo === 'direccion' ? editValue || null : acta.direccion,
      }
      await client.put(`/actas/${acta.id}`, payload)
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
      await client.post('/actas', {
        codigo,
        fecha: fecha || null,
        direccion: direccion || null,
      })
      setCodigo('')
      setFecha('')
      setDireccion('')
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  async function eliminar(a: Acta): Promise<void> {
    await client.delete(`/actas/${a.id}`)
    recargar()
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-marca-osc">Actas de trabajo</h1>

      <form onSubmit={crear} className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Código</span>
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)} required
            className="rounded border px-3 py-2" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Fecha</span>
          <input value={fecha} onChange={(e) => setFecha(e.target.value)} type="date"
            className="rounded border px-3 py-2" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Dirección</span>
          <input value={direccion} onChange={(e) => setDireccion(e.target.value)}
            className="rounded border px-3 py-2" />
        </label>
        <button className="rounded bg-marca px-4 py-2 text-white hover:bg-marca-osc">Crear</button>
      </form>

      {(aviso || error) && (
        <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{aviso || error}</div>
      )}

      <table className="w-full overflow-hidden rounded-xl border bg-white text-sm">
        <thead className="bg-marca-osc text-white">
          <tr>
            <th className="p-2 text-left">Código</th>
            <th className="p-2 text-left">Fecha</th>
            <th className="p-2 text-left">Dirección</th>
            <th className="p-2 text-right">Total horas</th>
            <th className="p-2 text-right">Total valor</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {datos.map((a) => (
            <tr key={a.id} className="border-t">
              <td
                className="p-2 font-mono cursor-pointer"
                title="Doble clic para editar"
                onDoubleClick={() => iniciarEdicion(a.id, 'codigo', a.codigo)}
              >
                {editCell?.id === a.id && editCell.campo === 'codigo' ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => void guardarEdicion(a)}
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
                    className="w-full rounded border px-2 py-1 font-mono"
                  />
                ) : (
                  a.codigo
                )}
              </td>
              <td
                className="p-2 cursor-pointer"
                title="Doble clic para editar"
                onDoubleClick={() => iniciarEdicion(a.id, 'fecha', a.fecha?.slice(0, 10) ?? '')}
              >
                {editCell?.id === a.id && editCell.campo === 'fecha' ? (
                  <input
                    autoFocus
                    type="date"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => void guardarEdicion(a)}
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
                  a.fecha?.slice(0, 10) ?? '—'
                )}
              </td>
              <td
                className="p-2 cursor-pointer"
                title="Doble clic para editar"
                onDoubleClick={() => iniciarEdicion(a.id, 'direccion', a.direccion ?? '')}
              >
                {editCell?.id === a.id && editCell.campo === 'direccion' ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => void guardarEdicion(a)}
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
                  a.direccion ?? '—'
                )}
              </td>
              <td className="p-2 text-right">{a.total_horas ?? '—'}</td>
              <td className="p-2 text-right">{a.total_valor ?? '—'}</td>
              <td className="p-2 text-center">
                <button onClick={() => eliminar(a)} className="text-red-600 hover:underline">
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
          {datos.length === 0 && (
            <tr><td colSpan={6} className="p-4 text-center text-slate-400">Sin actas.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
