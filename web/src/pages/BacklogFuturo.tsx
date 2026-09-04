import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import client from '../api/client'
import { mensajeError, useLista } from '../api/hooks'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import { TablaScroll } from '../components/ui/primitivos'
import type { Aplicacion, BacklogFuturo, Requerimiento } from '../types'

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

interface FormState {
  id: string | null
  nombreIniciativa: string
  tipoDemanda: string
  squadId: string
  horasAproximadas: string
  fechaTentativaInicio: string
  estado: string
  volvioActa: boolean
  actaId: string
}

const FORM_VACIO: FormState = {
  id: null,
  nombreIniciativa: '',
  tipoDemanda: '',
  squadId: '',
  horasAproximadas: '',
  fechaTentativaInicio: '',
  estado: 'PENDIENTE',
  volvioActa: false,
  actaId: '',
}

export default function BacklogFuturoPage() {
  const { datos, error, recargar } = useLista<BacklogFuturo>('/backlog-futuro')
  const { datos: aplicaciones } = useLista<Aplicacion>('/aplicaciones')
  const { datos: requerimientos } = useLista<Requerimiento>('/requerimientos')
  const { tienePermiso } = useAuth()
  const puedeEditar = tienePermiso('backlog_futuro.editar')

  const [modalAbierto, setModalAbierto] = useState(false)
  const [form, setForm] = useState<FormState>(FORM_VACIO)
  const [aviso, setAviso] = useState('')

  const squadPorCodigo = useMemo(() => {
    const m = new Map<string, string>()
    aplicaciones.forEach((a) => m.set(a.codigo, a.nombre))
    return m
  }, [aplicaciones])

  const actasOrdenadas = useMemo(
    () => requerimientos
      .slice()
      .sort((a, b) => a.codigo_req.localeCompare(b.codigo_req, 'es')),
    [requerimientos],
  )

  const actaPorId = useMemo(() => {
    const m = new Map<string, Requerimiento>()
    requerimientos.forEach((r) => m.set(r.id, r))
    return m
  }, [requerimientos])

  const totales = useMemo(() => {
    const totalHoras = datos.reduce((acc, item) => acc + (item.horas_aproximadas ?? 0), 0)
    const totalConActa = datos.filter((item) => item.volvio_acta).length
    return { registros: datos.length, horas: totalHoras, conActa: totalConActa }
  }, [datos])

  function abrirNuevo(): void {
    setForm(FORM_VACIO)
    setAviso('')
    setModalAbierto(true)
  }

  function abrirEditar(item: BacklogFuturo): void {
    if (!puedeEditar) return
    setForm({
      id: item.id,
      nombreIniciativa: item.nombre_iniciativa ?? '',
      tipoDemanda: item.tipo_demanda ?? '',
      squadId: item.squad_id,
      horasAproximadas: String(item.horas_aproximadas ?? ''),
      fechaTentativaInicio: item.fecha_tentativa_inicio ?? '',
      estado: item.estado,
      volvioActa: item.volvio_acta,
      actaId: item.acta_id ?? '',
    })
    setAviso('')
    setModalAbierto(true)
  }

  function cerrar(): void {
    setModalAbierto(false)
    setForm(FORM_VACIO)
    setAviso('')
  }

  async function guardar(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (!puedeEditar) return
    setAviso('')
    if (!form.squadId) {
      setAviso('Selecciona un squad.')
      return
    }
    if (!form.nombreIniciativa.trim()) {
      setAviso('Ingresa el nombre de la iniciativa.')
      return
    }
    if (form.volvioActa && !form.actaId) {
      setAviso('Selecciona el acta en la que se creó, o marca "No" si aún no volvió acta.')
      return
    }
    const payload = {
      nombre_iniciativa: form.nombreIniciativa.trim(),
      tipo_demanda: form.tipoDemanda.trim() || null,
      squad_id: form.squadId,
      horas_aproximadas: form.horasAproximadas ? Number(form.horasAproximadas) : 0,
      fecha_tentativa_inicio: form.fechaTentativaInicio || null,
      estado: form.estado,
      volvio_acta: form.volvioActa,
      acta_id: form.volvioActa ? (form.actaId || null) : null,
    }
    try {
      const headers = { headers: { 'X-Aplicacion': form.squadId } }
      if (form.id) {
        await client.put(`/backlog-futuro/${form.id}`, payload, headers)
      } else {
        await client.post('/backlog-futuro', payload, headers)
      }
      cerrar()
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  async function eliminar(item: BacklogFuturo): Promise<void> {
    if (!puedeEditar) return
    if (!window.confirm('¿Eliminar este registro del backlog futuro?')) return
    await client.delete(`/backlog-futuro/${item.id}`, { headers: { 'X-Aplicacion': item.squad_id } })
    recargar()
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="titulo-pagina">Backlog futuro</h1>
        {puedeEditar && (
          <button onClick={abrirNuevo} className="btn btn-primario">
            + Agregar registro
          </button>
        )}
      </div>

      {error && <div className="aviso aviso-error mb-3">{error}</div>}

      <TablaScroll>
        <table className="min-w-full text-sm">
          <thead className="bg-marca-osc text-white">
            <tr>
              <th className="p-2 text-left">Nombre de la iniciativa</th>
              <th className="p-2 text-left">Tipo de demanda</th>
              <th className="p-2 text-left">Squad</th>
              <th className="p-2 text-right">Horas aproximadas</th>
              <th className="p-2 text-center">F. tentativa de inicio</th>
              <th className="p-2 text-center">Estado</th>
              <th className="p-2 text-center">¿Volvió acta?</th>
              <th className="p-2 text-left">Acta</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {datos.map((item) => (
              <tr key={item.id} className="border-t">
                <td className="p-2">{item.nombre_iniciativa}</td>
                <td className="p-2">{item.tipo_demanda || '—'}</td>
                <td className="p-2">{squadPorCodigo.get(item.squad_id) ?? item.squad_id}</td>
                <td className="p-2 text-right">{item.horas_aproximadas ?? 0}</td>
                <td className="p-2 text-center">{item.fecha_tentativa_inicio || '—'}</td>
                <td className="p-2 text-center">
                  <span className={`chip ${ESTADO_BADGE[item.estado] ?? 'bg-slate-100 text-slate-700'}`}>
                    {ESTADO_LABEL[item.estado] ?? item.estado}
                  </span>
                </td>
                <td className="p-2 text-center">
                  {item.volvio_acta
                    ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Sí</span>
                    : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">No</span>}
                </td>
                <td className="p-2">
                  {item.volvio_acta && item.acta_id
                    ? (actaPorId.get(item.acta_id)?.codigo_req ?? item.acta_id)
                    : '—'}
                </td>
                <td className="p-2 text-center whitespace-nowrap">
                  {puedeEditar && (
                    <>
                      <button onClick={() => abrirEditar(item)} className="enlace-accion mr-3">
                        Editar
                      </button>
                      <button onClick={() => eliminar(item)} className="enlace-accion enlace-accion-peligro">
                        Eliminar
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {datos.length === 0 && (
              <tr><td colSpan={9} className="p-4 text-center text-slate-400">Sin registros de backlog futuro.</td></tr>
            )}
          </tbody>
          {datos.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                <td className="p-2" colSpan={3}>Totales ({totales.registros} registro{totales.registros !== 1 ? 's' : ''})</td>
                <td className="p-2 text-right">{totales.horas}</td>
                <td className="p-2"></td>
                <td className="p-2"></td>
                <td className="p-2 text-center">{totales.conActa} con acta</td>
                <td className="p-2"></td>
                <td className="p-2"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </TablaScroll>

      <Modal
        titulo={form.id ? 'Editar registro' : 'Nuevo registro de backlog futuro'}
        abierto={modalAbierto}
        onCerrar={cerrar}
      >
        <form onSubmit={guardar} className="space-y-3">
          {aviso && <div className="aviso aviso-error">{aviso}</div>}

          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Nombre de la iniciativa</span>
            <input
              value={form.nombreIniciativa}
              onChange={(e) => setForm({ ...form, nombreIniciativa: e.target.value })}
              required
              className="campo w-full"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Tipo de demanda</span>
            <input
              value={form.tipoDemanda}
              onChange={(e) => setForm({ ...form, tipoDemanda: e.target.value })}
              className="campo w-full"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Squad</span>
            <select
              value={form.squadId}
              onChange={(e) => setForm({ ...form, squadId: e.target.value })}
              required
              className="campo w-full"
            >
              <option value="">— Selecciona —</option>
              {aplicaciones.map((a) => (
                <option key={a.codigo} value={a.codigo}>{a.nombre}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Horas aproximadas</span>
            <input
              type="number"
              min="0"
              step="0.5"
              value={form.horasAproximadas}
              onChange={(e) => setForm({ ...form, horasAproximadas: e.target.value })}
              className="campo w-full"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Fecha tentativa de inicio</span>
            <input
              type="date"
              value={form.fechaTentativaInicio}
              onChange={(e) => setForm({ ...form, fechaTentativaInicio: e.target.value })}
              className="campo w-full"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Estado</span>
            <select
              value={form.estado}
              onChange={(e) => setForm({ ...form, estado: e.target.value })}
              className="campo w-full"
            >
              {ESTADOS.map((s) => (
                <option key={s} value={s}>{ESTADO_LABEL[s]}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">¿Volvió acta?</span>
            <select
              value={form.volvioActa ? 'si' : 'no'}
              onChange={(e) => setForm({ ...form, volvioActa: e.target.value === 'si', actaId: e.target.value === 'si' ? form.actaId : '' })}
              className="campo w-full"
            >
              <option value="no">No</option>
              <option value="si">Sí</option>
            </select>
          </label>

          {form.volvioActa && (
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Acta en la que se creó</span>
              <select
                value={form.actaId}
                onChange={(e) => setForm({ ...form, actaId: e.target.value })}
                required={form.volvioActa}
                className="campo w-full"
              >
                <option value="">— Selecciona el acta —</option>
                {actasOrdenadas.map((r) => (
                  <option key={r.id} value={r.id}>
                    {[r.codigo_req, r.nombre].filter(Boolean).join(' - ')}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={cerrar} className="btn btn-secundario">
              Cancelar
            </button>
            <button className="btn btn-primario">
              {form.id ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
