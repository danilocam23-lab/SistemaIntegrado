import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import client from '../api/client'
import { mensajeError, useLista } from '../api/hooks'
import { useAuth } from '../context/AuthContext'
import type { Persona, PlanAccion } from '../types'
import { Boton, Chip, EncabezadoPagina, Icono, TablaScroll } from '../components/ui'

const ESTADOS = ['PENDIENTE', 'EN_PROGRESO', 'COMPLETADO', 'CANCELADO']

const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROGRESO: 'En progreso',
  COMPLETADO: 'Completado',
  CANCELADO: 'Cancelado',
}

const ESTADO_TONO: Record<string, 'neutro' | 'marca' | 'exito' | 'alerta' | 'error'> = {
  PENDIENTE: 'alerta',
  EN_PROGRESO: 'marca',
  COMPLETADO: 'exito',
  CANCELADO: 'neutro',
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
      <EncabezadoPagina icono={<Icono nombre="portafolio" />} titulo="Planes de acción" />

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
          <Boton variante="primario" type="submit">
            {form.id ? 'Guardar' : 'Crear'}
          </Boton>
          {form.id && (
            <Boton variante="secundario" type="button" onClick={cancelarEdicion}>
              Cancelar
            </Boton>
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
      <table className="tabla">
        <thead>
          <tr>
            <th>Título</th>
            <th>Descripción</th>
            <th>Responsable</th>
            <th className="text-center">Fecha límite</th>
            <th className="text-center">Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {planesFiltrados.map((p) => (
            <tr key={p.id}>
              <td>{p.titulo}</td>
              <td>{p.descripcion || '—'}</td>
              <td>{(p.responsable_id && personasPorId.get(p.responsable_id)?.nombre) || '—'}</td>
              <td className="text-center">{p.fecha_limite || '—'}</td>
              <td className="text-center">
                <Chip tono={ESTADO_TONO[p.estado] ?? 'neutro'}>
                  {ESTADO_LABEL[p.estado] ?? p.estado}
                </Chip>
              </td>
              <td className="text-center whitespace-nowrap">
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
