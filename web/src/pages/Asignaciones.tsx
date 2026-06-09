import { useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import client from '../api/client'
import { mensajeError, useLista } from '../api/hooks'
import type { Asignacion, Categoria, Persona, Requerimiento } from '../types'

export default function Asignaciones() {
  const { datos: asignaciones, error, recargar } = useLista<Asignacion>('/asignaciones')
  const { datos: personas } = useLista<Persona>('/personas')
  const { datos: categorias } = useLista<Categoria>('/categorias')
  const { datos: requerimientos } = useLista<Requerimiento>('/requerimientos')
  const [personaId, setPersonaId] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [porcentaje, setPorcentaje] = useState('')
  const [requerimientoId, setRequerimientoId] = useState('')
  const [aviso, setAviso] = useState('')
  const [editCell, setEditCell] = useState<{ id: string; campo: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const cancelarBlurRef = useRef(false)

  /** Mapa id → {sc, codigoReq, nombre} para resolver etiquetas */
  const reqPorId = useMemo(() => {
    const m = new Map<string, { sc: string; codigoReq: string; nombre: string; codigoReqRaw: string }>()
    for (const r of requerimientos) {
      m.set(r.id, {
        sc: r.solicitud?.codigo_sc ?? '',
        codigoReq: r.codigo_req,
        codigoReqRaw: r.codigo_req,
        nombre: r.nombre ?? '',
      })
    }
    return m
  }, [requerimientos])

  function etiquetaReq(requerimientoId: string | null): string {
    if (!requerimientoId) return '—'
    const r = reqPorId.get(requerimientoId)
    if (!r) return requerimientoId
    return [r.sc, r.codigoReq, r.nombre].filter(Boolean).join(' - ')
  }

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
      await client.put(`/asignaciones/${asig.id}`, {
        persona_id: asig.persona_id,
        categoria_id: asig.categoria_id,
        total_porcentaje: nuevoPorcentaje,
      })
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
      // Si se seleccionó un requerimiento, sincronizarlo a la asignación recién creada
      if (requerimientoId) {
        const req = reqPorId.get(requerimientoId)
        if (req) {
          await client.post(`/asignaciones/sincronizar/${req.codigoReqRaw}`).catch(() => {})
        }
      }
      setPorcentaje('')
      setRequerimientoId('')
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  async function eliminar(asig: Asignacion): Promise<void> {
    await client.delete(`/asignaciones/${asig.id}`)
    recargar()
  }

  // Requerimientos ordenados para el selector: SC - Código REQ - Nombre de acta
  const opcionesReq = useMemo(() =>
    requerimientos
      .map((r) => ({
        id: r.id,
        label: [r.solicitud?.codigo_sc, r.codigo_req, r.nombre].filter(Boolean).join(' - '),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es')),
    [requerimientos]
  )

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-marca-osc">Asignaciones de carga</h1>

      <form onSubmit={crear} className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Persona</span>
          <select value={personaId} onChange={(e) => setPersonaId(e.target.value)} required
            className="rounded border px-3 py-2">
            <option value="">— Seleccionar —</option>
            {personas
              .filter((p) => p.rol_operativo === 'DEV' || p.rol_operativo === 'LT_HITSS')
              .map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
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
        <label className="text-sm min-w-[280px]">
          <span className="mb-1 block text-slate-600">Requerimiento <span className="text-slate-400">(opcional)</span></span>
          <select value={requerimientoId} onChange={(e) => setRequerimientoId(e.target.value)}
            className="w-full rounded border px-3 py-2">
            <option value="">— Ninguno —</option>
            {opcionesReq.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
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
            <th className="p-2 text-left">Persona</th>
            <th className="p-2 text-left">Categoría</th>
            <th className="p-2 text-right">% carga</th>
            <th className="p-2 text-left">Requerimientos</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {asignaciones.map((a) => (
            <tr key={a.id} className="border-t align-top">
              <td className="p-2">{nombrePersona(a.persona_id)}</td>
              <td className="p-2">{nombreCategoria(a.categoria_id)}</td>
              <td className="cursor-pointer p-2 text-right" title="Doble clic para editar"
                onDoubleClick={() => iniciarEdicion(a.id, 'total_porcentaje', String(a.total_porcentaje))}>
                {editCell?.id === a.id && editCell.campo === 'total_porcentaje' ? (
                  <input autoFocus type="number" value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => {
                      if (cancelarBlurRef.current) { cancelarBlurRef.current = false; return }
                      void guardarEdicion(a)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
                      if (e.key === 'Escape') { e.preventDefault(); cancelarEdicion() }
                    }}
                    className="w-24 rounded border px-2 py-1 text-right" />
                ) : `${a.total_porcentaje}%`}
              </td>
              <td className="p-2">
                {a.proyectos.length === 0 ? (
                  <span className="text-slate-400">—</span>
                ) : (
                  <ul className="space-y-1">
                    {a.proyectos.map((p) => (
                      <li key={p.id} className="flex items-start gap-2">
                        <span className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full bg-marca/60" />
                        <span className="text-xs text-slate-700">{etiquetaReq(p.requerimiento_id)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </td>
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
