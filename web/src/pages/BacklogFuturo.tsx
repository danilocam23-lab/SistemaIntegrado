import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import client from '../api/client'
import { mensajeError, useLista } from '../api/hooks'
import { useAuth } from '../context/AuthContext'
import { Boton, EncabezadoPagina, Icono, Kpi } from '../components/ui'
import ModalBacklogFuturo from './backlog-futuro/ModalBacklogFuturo'
import TableroKanban from './backlog-futuro/TableroKanban'
import { FORM_VACIO } from './backlog-futuro/tipos'
import type { Aplicacion, BacklogFuturo, Persona, Requerimiento } from '../types'

export default function BacklogFuturoPage() {
  const { datos, error, recargar } = useLista<BacklogFuturo>('/backlog-futuro')
  const { datos: aplicaciones } = useLista<Aplicacion>('/aplicaciones')
  const { datos: requerimientos } = useLista<Requerimiento>('/requerimientos')
  const { datos: personas } = useLista<Persona>('/personas')
  const { tienePermiso } = useAuth()
  const puedeEditar = tienePermiso('backlog_futuro.editar')

  const [modalAbierto, setModalAbierto] = useState(false)
  const [form, setForm] = useState(FORM_VACIO)
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

  function abrirNuevo(estadoInicial?: string): void {
    setForm(estadoInicial ? { ...FORM_VACIO, estado: estadoInicial } : FORM_VACIO)
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
            <Boton variante="primario" onClick={() => abrirNuevo()}>
              + Agregar registro
            </Boton>
          ) : undefined
        }
      />

      {error && <div className="aviso aviso-error">{error}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi
          rotulo="Registros"
          valor={totales.registros}
          nota={`${totales.registros} iniciativa${totales.registros !== 1 ? 's' : ''} en el backlog`}
        />
        <Kpi rotulo="Horas aproximadas" valor={totales.horas} />
        <Kpi rotulo="Con acta" valor={totales.conActa} nota="Iniciativas que ya volvieron acta" />
      </div>

      <TableroKanban
        datos={datos}
        puedeEditar={puedeEditar}
        squadPorCodigo={squadPorCodigo}
        personaPorId={personaPorId}
        actaPorId={actaPorId}
        onEditar={abrirEditar}
        onEliminar={eliminar}
        onAgregarEnEstado={abrirNuevo}
      />

      <ModalBacklogFuturo
        abierto={modalAbierto}
        form={form}
        setForm={setForm}
        aviso={aviso}
        aplicaciones={aplicaciones}
        personasArQa={personasArQa}
        actasOrdenadas={actasOrdenadas}
        onCerrar={cerrar}
        onGuardar={guardar}
      />
    </div>
  )
}
