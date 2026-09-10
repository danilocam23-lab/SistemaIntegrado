import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import client from '../api/client'
import { mensajeError, useLista } from '../api/hooks'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import { Boton, Chip, EncabezadoPagina, Icono, TablaScroll } from '../components/ui'
import type { Aplicacion, BacklogFuturo, Persona, Requerimiento } from '../types'

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
  responsableId: string
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
  responsableId: '',
}

export default function BacklogFuturoPage() {
  const { datos, error, recargar } = useLista<BacklogFuturo>('/backlog-futuro')
  const { datos: aplicaciones } = useLista<Aplicacion>('/aplicaciones')
  const { datos: requerimientos } = useLista<Requerimiento>('/requerimientos')
  const { datos: personas } = useLista<Persona>('/personas')
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

  const personasArQa = useMemo(
    () => personas.filter((p) => p.activo && p.rol_operativo === 'AR/QA'),
    [personas],
  )

  const personaPorId = useMemo(
    () => new Map(personas.map((p) => [p.id, p.nombre])),
    [personas],
  )

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
      responsableId: item.responsable_id ?? '',
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
      responsable_id: form.responsableId || null,
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
    <div className="space-y-4">
      <EncabezadoPagina
        icono={<Icono nombre="portafolio" />}
        titulo="Backlog futuro"
        acciones={
          puedeEditar ? (
            <Boton variante="primario" onClick={abrirNuevo}>
              + Agregar registro
            </Boton>
          ) : undefined
        }
      />

      {error && <div className="aviso aviso-error">{error}</div>}

      <TablaScroll>
        <table className="tabla">
          <thead>
            <tr>
              <th>Nombre de la iniciativa</th>
              <th>Tipo de demanda</th>
              <th>Squad</th>
              <th>AR/QA</th>
              <th className="text-right">Horas aproximadas</th>
              <th className="text-center">F. tentativa de inicio</th>
              <th className="text-center">Estado</th>
              <th className="text-center">¿Volvió acta?</th>
              <th>Acta</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {datos.map((item) => (
              <tr key={item.id}>
                <td>{item.nombre_iniciativa}</td>
                <td>{item.tipo_demanda || '—'}</td>
                <td>{squadPorCodigo.get(item.squad_id) ?? item.squad_id}</td>
                <td>{personaPorId.get(item.responsable_id ?? '') ?? '—'}</td>
                <td className="text-right">{item.horas_aproximadas ?? 0}</td>
                <td className="text-center">{item.fecha_tentativa_inicio || '—'}</td>
                <td className="text-center">
                  <Chip tono={ESTADO_TONO[item.estado] ?? 'neutro'}>
                    {ESTADO_LABEL[item.estado] ?? item.estado}
                  </Chip>
                </td>
                <td className="text-center">
                  {item.volvio_acta
                    ? <Chip tono="exito">Sí</Chip>
                    : <Chip tono="neutro">No</Chip>}
                </td>
                <td>
                  {item.volvio_acta && item.acta_id
                    ? (actaPorId.get(item.acta_id)?.codigo_req ?? item.acta_id)
                    : '—'}
                </td>
                <td className="text-center whitespace-nowrap">
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
              <tr><td colSpan={10} className="p-4 text-center text-slate-400">Sin registros de backlog futuro.</td></tr>
            )}
          </tbody>
          {datos.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                <td className="p-2" colSpan={4}>Totales ({totales.registros} registro{totales.registros !== 1 ? 's' : ''})</td>
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
            <span className="mb-1 block text-slate-600">AR/QA</span>
            <select
              value={form.responsableId}
              onChange={(e) => setForm({ ...form, responsableId: e.target.value })}
              className="campo w-full"
            >
              <option value="">— Sin asignar —</option>
              {personasArQa.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
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
            <Boton variante="secundario" onClick={cerrar}>
              Cancelar
            </Boton>
            <Boton variante="primario" type="submit">
              {form.id ? 'Guardar' : 'Crear'}
            </Boton>
          </div>
        </form>
      </Modal>
    </div>
  )
}
