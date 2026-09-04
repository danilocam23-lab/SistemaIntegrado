import { useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import client from '../api/client'
import { mensajeError, useLista } from '../api/hooks'
import { useAuth } from '../context/AuthContext'
import { TablaScroll } from '../components/ui/primitivos'
import type { Capacidad, Persona } from '../types'

const ROLES_EXCLUIDOS_CAPACIDAD_PERSONA = ['LT_EPM']

export default function Capacidades() {
  const { datos, error, recargar } = useLista<Capacidad>('/capacidades')
  const { datos: personas } = useLista<Persona>('/personas')
  const { tienePermiso } = useAuth()
  const puedeEditarCapacidades = tienePermiso('capacidades.editar')
  const [personaId, setPersonaId] = useState('')
  const [mes, setMes] = useState('')
  const [horas, setHoras] = useState('180')
  const [aviso, setAviso] = useState('')
  const [editCell, setEditCell] = useState<{ id: string; campo: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const cancelarBlurRef = useRef(false)

  const personasPorId = useMemo(() => {
    const map = new Map<string, Persona>()
    for (const persona of personas) map.set(persona.id, persona)
    return map
  }, [personas])

  const personasDisponibles = useMemo(
    () => personas
      .filter((p) => p.rol_operativo && !ROLES_EXCLUIDOS_CAPACIDAD_PERSONA.includes(p.rol_operativo))
      .slice()
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [personas],
  )

  const capacidadesPersona = useMemo(
    () => datos.filter((capacidad) => {
      if (capacidad.scope !== 'persona' || !capacidad.persona_id) return false
      const persona = personasPorId.get(capacidad.persona_id)
      return Boolean(persona && !ROLES_EXCLUIDOS_CAPACIDAD_PERSONA.includes(persona.rol_operativo))
    }),
    [datos, personasPorId],
  )

  const nombrePersona = (id: string | null): string =>
    (id && personasPorId.get(id)?.nombre) || '—'

  function iniciarEdicion(id: string, campo: string, valorActual: string) {
    if (!puedeEditarCapacidades) return
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
    if (!puedeEditarCapacidades) return
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
    if (!puedeEditarCapacidades) return
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
    if (!puedeEditarCapacidades) return
    await client.delete(`/capacidades/${capacidad.id}`)
    recargar()
  }

  return (
    <div>
      <h1 className="titulo-pagina mb-4">Capacidades mensuales</h1>

      {puedeEditarCapacidades && (
      <form onSubmit={crear} className="barra-filtros mb-4">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Persona</span>
          <select value={personaId} onChange={(e) => setPersonaId(e.target.value)} required
            className="campo">
            <option value="">— Seleccionar —</option>
            {personasDisponibles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Mes</span>
          <input value={mes} onChange={(e) => setMes(e.target.value)} type="month" required
            className="campo" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Horas disponibles</span>
          <input value={horas} onChange={(e) => setHoras(e.target.value)} type="number" required
            className="campo w-32" />
        </label>
        <button className="btn btn-primario">Crear</button>
      </form>
      )}

      {(aviso || error) && (
        <div className="aviso aviso-error mb-3">{aviso || error}</div>
      )}

      <TablaScroll>
      <table className="text-sm">
        <thead className="bg-marca-osc text-white">
          <tr>
            <th className="p-2 text-left">Persona</th>
            <th className="p-2 text-left">Mes</th>
            <th className="p-2 text-right">Horas disponibles</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {capacidadesPersona.map((c) => (
            <tr key={c.id} className="border-t">
              <td className="p-2">{nombrePersona(c.persona_id)}</td>
              <td className="p-2">{c.mes}</td>
              <td
                className={`p-2 text-right ${puedeEditarCapacidades ? 'cursor-pointer' : ''}`}
                title={puedeEditarCapacidades ? 'Doble clic para editar' : undefined}
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
                    className="campo campo-sm w-24 text-right"
                  />
                ) : c.horas_disponibles}
              </td>
              <td className="p-2 text-center">
                {puedeEditarCapacidades && (
                  <button onClick={() => eliminar(c)} className="enlace-accion enlace-accion-peligro">
                    Eliminar
                  </button>
                )}
              </td>
            </tr>
          ))}
          {capacidadesPersona.length === 0 && (
            <tr><td colSpan={4} className="p-4 text-center text-slate-400">Sin capacidades.</td></tr>
          )}
        </tbody>
      </table>
      </TablaScroll>
    </div>
  )
}
