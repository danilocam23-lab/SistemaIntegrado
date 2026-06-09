import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import client from '../api/client'
import { mensajeError, useLista } from '../api/hooks'
import type { Categoria } from '../types'

export default function Categorias() {
  const { datos, error, recargar } = useLista<Categoria>('/categorias')
  const [nombre, setNombre] = useState('')
  const [color, setColor] = useState('#6366f1')
  const [aviso, setAviso] = useState('')
  const [editCell, setEditCell] = useState<{ id: string; campo: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const cancelarBlurRef = useRef(false)

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

  async function guardarEdicion(categoria: Categoria) {
    if (!editCell) return
    try {
      const payload = {
        nombre: categoria.nombre,
        color: categoria.color,
        orden: categoria.orden,
        [editCell.campo]: editCell.campo === 'orden' ? Number(editValue) : editValue,
      }
      await client.put(`/categorias/${categoria.id}`, payload)
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
      await client.post('/categorias', { nombre, color, orden: datos.length + 1 })
      setNombre('')
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  async function eliminar(categoria: Categoria): Promise<void> {
    await client.delete(`/categorias/${categoria.id}`)
    recargar()
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-marca-osc">Categorías</h1>

      <form onSubmit={crear} className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Nombre</span>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} required
            className="rounded border px-3 py-2" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Color</span>
          <input value={color} onChange={(e) => setColor(e.target.value)} type="color"
            className="h-10 w-16 rounded border" />
        </label>
        <button className="rounded bg-marca px-4 py-2 text-white hover:bg-marca-osc">Crear</button>
      </form>

      {(aviso || error) && (
        <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{aviso || error}</div>
      )}

      <table className="w-full overflow-hidden rounded-xl border bg-white text-sm">
        <thead className="bg-marca-osc text-white">
          <tr>
            <th className="p-2 text-left">Orden</th>
            <th className="p-2 text-left">Categoría</th>
            <th className="p-2 text-left">Color</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {datos.map((c) => (
            <tr key={c.id} className="border-t">
              <td
                className="cursor-pointer p-2"
                title="Doble clic para editar"
                onDoubleClick={() => iniciarEdicion(c.id, 'orden', String(c.orden))}
              >
                {editCell?.id === c.id && editCell.campo === 'orden' ? (
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
                    className="w-20 rounded border px-2 py-1"
                  />
                ) : c.orden}
              </td>
              <td
                className="cursor-pointer p-2"
                title="Doble clic para editar"
                onDoubleClick={() => iniciarEdicion(c.id, 'nombre', c.nombre)}
              >
                {editCell?.id === c.id && editCell.campo === 'nombre' ? (
                  <input
                    autoFocus
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
                    className="w-full rounded border px-2 py-1"
                  />
                ) : c.nombre}
              </td>
              <td
                className="cursor-pointer p-2"
                title="Doble clic para editar"
                onDoubleClick={() => iniciarEdicion(c.id, 'color', c.color)}
              >
                {editCell?.id === c.id && editCell.campo === 'color' ? (
                  <input
                    autoFocus
                    type="color"
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
                    className="h-10 w-16 rounded border"
                  />
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-4 w-4 rounded" style={{ background: c.color }} />
                    {c.color}
                  </span>
                )}
              </td>
              <td className="p-2 text-center">
                <button onClick={() => eliminar(c)} className="text-red-600 hover:underline">
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
          {datos.length === 0 && (
            <tr><td colSpan={4} className="p-4 text-center text-slate-400">Sin categorías.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
