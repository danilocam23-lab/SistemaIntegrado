import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import client from '../api/client'
import { mensajeError, useLista } from '../api/hooks'
import type { Asignacion, Categoria, Persona } from '../types'

export default function Asignaciones() {
  const { datos: asignaciones, error, recargar } = useLista<Asignacion>('/asignaciones')
  const { datos: personas } = useLista<Persona>('/personas')
  const { datos: categorias } = useLista<Categoria>('/categorias')
  const [personaId, setPersonaId] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [porcentaje, setPorcentaje] = useState('')
  const [aviso, setAviso] = useState('')
  const [editCell, setEditCell] = useState<{ id: string; campo: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const cancelarBlurRef = useRef(false)

  const nombrePersona = (id: string): string =>
    personas.find((p) => p.id === id)?.nombre ?? id
  const nombreCategoria = (id: string): string =>
    categorias.find((c) => c.id === id)?.nombre ?? id

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

  async function guardarEdicion(asig: Asignacion) {
    if (!editCell) return

    const nuevoPorcentaje = editValue ? Number(editValue) : 0
    const totalActual = asignaciones
      .filter((a) => a.persona_id === asig.persona_id && a.id !== asig.id)
      .reduce((sum, a) => sum + a.total_porcentaje, 0)
    if (totalActual + nuevoPorcentaje > 100) {
      setAviso(`La persona ya tiene ${totalActual}% asignado. Agregar ${nuevoPorcentaje}% superaría el 100% de capacidad.`)
      return
    }

    try {
      const payload = {
        persona_id: asig.persona_id,
        categoria_id: asig.categoria_id,
        total_porcentaje: nuevoPorcentaje,
      }
      await client.put(`/asignaciones/${asig.id}`, payload)
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

    // Validar que no supere 100% de capacidad para la persona
    const nuevoPorcentaje = porcentaje ? Number(porcentaje) : 0
    const totalActual = asignaciones
      .filter((a) => a.persona_id === personaId)
      .reduce((sum, a) => sum + a.total_porcentaje, 0)
    if (totalActual + nuevoPorcentaje > 100) {
      setAviso(`La persona ya tiene ${totalActual}% asignado. Agregar ${nuevoPorcentaje}% superaría el 100% de capacidad.`)
      return
    }

    try {
      await client.post('/asignaciones', {
        persona_id: personaId,
        categoria_id: categoriaId,
        total_porcentaje: nuevoPorcentaje,
      })
      setPorcentaje('')
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  async function eliminar(asig: Asignacion): Promise<void> {
    await client.delete(`/asignaciones/${asig.id}`)
    recargar()
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-marca-osc">Asignaciones de carga</h1>

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
          <span className="mb-1 block text-slate-600">Categoría</span>
          <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} required
            className="rounded border px-3 py-2">
            <option value="">— Seleccionar —</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">% de carga</span>
          <input value={porcentaje} onChange={(e) => setPorcentaje(e.target.value)} type="number"
            className="w-28 rounded border px-3 py-2" />
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
            <th className="p-2 text-left">Categoría</th>
            <th className="p-2 text-right">% carga</th>
            <th className="p-2 text-center">Proyectos</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {asignaciones.map((a) => (
            <tr key={a.id} className="border-t">
              <td className="p-2">{nombrePersona(a.persona_id)}</td>
              <td className="p-2">{nombreCategoria(a.categoria_id)}</td>
              <td
                className="cursor-pointer p-2 text-right"
                title="Doble clic para editar"
                onDoubleClick={() => iniciarEdicion(a.id, 'total_porcentaje', String(a.total_porcentaje))}
              >
                {editCell?.id === a.id && editCell.campo === 'total_porcentaje' ? (
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
                      void guardarEdicion(a)
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
                ) : `${a.total_porcentaje}%`}
              </td>
              <td className="p-2 text-center">{a.proyectos.length}</td>
              <td className="p-2 text-center">
                <button onClick={() => eliminar(a)} className="text-red-600 hover:underline">
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
          {asignaciones.length === 0 && (
            <tr><td colSpan={5} className="p-4 text-center text-slate-400">Sin asignaciones.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
