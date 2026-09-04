import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import client from '../api/client'
import { mensajeError, useLista } from '../api/hooks'
import { useAuth } from '../context/AuthContext'
import type { Persona, PlanAccion } from '../types'
import { TablaScroll } from '../components/ui/primitivos'

const ESTADOS = ['PENDIENTE', 'EN_PROGRESO', 'COMPLETADO', 'CANCELADO']

const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROGRESO: 'En progreso',
  COMPLETADO: 'Completado',
  CANCELADO: 'Cancelado',
}

const ESTADO_BADGE: Record<string, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-700',
  EN_PROGRESO: 'bg-blue-100 text-blue-700',
  COMPLETADO: 'bg-emerald-100 text-emerald-700',
  CANCELADO: 'bg-slate-200 text-slate-600',
}

const ROLES_RESPONSABLE = ['LT_HITSS', 'SCRUM']

interface FormState {
  id: string | null
  titulo: string
  descripcion: string
  responsableId: string
  fechaLimite: string
  estado: string
}

const FORM_VACIO: FormState = {
  id: null,
  titulo: '',
  descripcion: '',
  responsableId: '',
  fechaLimite: '',
  estado: 'PENDIENTE',
}

export default function PlanesAccion() {
  const { datos, error, recargar } = useLista<PlanAccion>('/planes-accion')
  const { datos: personas } = useLista<Persona>('/personas')
  const { tienePermiso } = useAuth()
  const puedeEditar = tienePermiso('planes_accion.editar')
  const [form, setForm] = useState<FormState>(FORM_VACIO)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [aviso, setAviso] = useState('')

  const personasPorId = useMemo(() => {
    const m = new Map<string, Persona>()
    personas.forEach((p) => m.set(p.id, p))
    return m
  }, [personas])

  const personasOrdenadas = useMemo(
    () => personas
      .filter((p) => ROLES_RESPONSABLE.includes(p.rol_operativo))
      .slice()
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [personas],
  )

  const planesFiltrados = useMemo(
    () => (filtroEstado ? datos.filter((p) => p.estado === filtroEstado) : datos),
    [datos, filtroEstado],
  )

  function editar(plan: PlanAccion) {
    if (!puedeEditar) return
    setForm({
      id: plan.id,
      titulo: plan.titulo,
      descripcion: plan.descripcion ?? '',
      responsableId: plan.responsable_id ?? '',
      fechaLimite: plan.fecha_limite ?? '',
      estado: plan.estado,
    })
  }

  function cancelarEdicion() {
    setForm(FORM_VACIO)
  }

  async function guardar(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (!puedeEditar) return
    setAviso('')
    const payload = {
      titulo: form.titulo,
      descripcion: form.descripcion || null,
      responsable_id: form.responsableId || null,
      fecha_limite: form.fechaLimite || null,
      estado: form.estado,
    }
    try {
      if (form.id) {
        await client.put(`/planes-accion/${form.id}`, payload)
      } else {
        await client.post('/planes-accion', payload)
      }
      setForm(FORM_VACIO)
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  async function eliminar(plan: PlanAccion): Promise<void> {
    if (!puedeEditar) return
    if (!window.confirm(`¿Eliminar el plan de acción "${plan.titulo}"?`)) return
    await client.delete(`/planes-accion/${plan.id}`)
    recargar()
  }

  return (
    <div>
      <h1 className="titulo-pagina mb-4">Planes de acción</h1>

      {puedeEditar && (
        <form onSubmit={guardar} className="barra-filtros mb-4">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Título</span>
            <input
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              required
              className="campo w-56"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Descripción</span>
            <input
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              className="campo w-64"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Responsable</span>
            <select
              value={form.responsableId}
              onChange={(e) => setForm({ ...form, responsableId: e.target.value })}
              className="campo"
            >
              <option value="">— Ninguno —</option>
              {personasOrdenadas.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Fecha límite</span>
            <input
              type="date"
              value={form.fechaLimite}
              onChange={(e) => setForm({ ...form, fechaLimite: e.target.value })}
              className="campo"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Estado</span>
            <select
              value={form.estado}
              onChange={(e) => setForm({ ...form, estado: e.target.value })}
              className="campo"
            >
              {ESTADOS.map((s) => (
                <option key={s} value={s}>{ESTADO_LABEL[s]}</option>
              ))}
            </select>
          </label>
          <button className="btn btn-primario">
            {form.id ? 'Guardar' : 'Crear'}
          </button>
          {form.id && (
            <button type="button" onClick={cancelarEdicion} className="btn btn-secundario">
              Cancelar
            </button>
          )}
        </form>
      )}

      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm text-slate-600">Filtrar por estado:</span>
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="campo"
        >
          <option value="">Todos</option>
          {ESTADOS.map((s) => (
            <option key={s} value={s}>{ESTADO_LABEL[s]}</option>
          ))}
        </select>
      </div>

      {(aviso || error) && (
        <div className="aviso aviso-error mb-3">{aviso || error}</div>
      )}

      <TablaScroll>
      <table className="text-sm">
        <thead className="bg-marca-osc text-white">
          <tr>
            <th className="p-2 text-left">Título</th>
            <th className="p-2 text-left">Descripción</th>
            <th className="p-2 text-left">Responsable</th>
            <th className="p-2 text-center">Fecha límite</th>
            <th className="p-2 text-center">Estado</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {planesFiltrados.map((p) => (
            <tr key={p.id} className="border-t">
              <td className="p-2">{p.titulo}</td>
              <td className="p-2">{p.descripcion || '—'}</td>
              <td className="p-2">{(p.responsable_id && personasPorId.get(p.responsable_id)?.nombre) || '—'}</td>
              <td className="p-2 text-center">{p.fecha_limite || '—'}</td>
              <td className="p-2 text-center">
                <span className={`chip ${ESTADO_BADGE[p.estado] ?? 'bg-slate-100 text-slate-700'}`}>
                  {ESTADO_LABEL[p.estado] ?? p.estado}
                </span>
              </td>
              <td className="p-2 text-center whitespace-nowrap">
                {puedeEditar && (
                  <>
                    <button onClick={() => editar(p)} className="enlace-accion mr-3">
                      Editar
                    </button>
                    <button onClick={() => eliminar(p)} className="enlace-accion enlace-accion-peligro">
                      Eliminar
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
          {planesFiltrados.length === 0 && (
            <tr><td colSpan={6} className="p-4 text-center text-slate-400">Sin planes de acción.</td></tr>
          )}
        </tbody>
      </table>
      </TablaScroll>
    </div>
  )
}
