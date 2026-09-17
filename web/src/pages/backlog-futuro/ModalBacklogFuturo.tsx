import type { Dispatch, FormEvent, SetStateAction } from 'react'
import Modal from '../../components/Modal'
import { Boton, Campo, Selector } from '../../components/ui'
import type { Aplicacion, Persona, Requerimiento } from '../../types'
import { ESTADOS, ESTADO_LABEL } from './constantes'
import type { FormState } from './tipos'

interface Props {
  abierto: boolean
  form: FormState
  setForm: Dispatch<SetStateAction<FormState>>
  aviso: string
  aplicaciones: Aplicacion[]
  personasArQa: Persona[]
  actasOrdenadas: Requerimiento[]
  onCerrar: () => void
  onGuardar: (e: FormEvent) => void
}

export default function ModalBacklogFuturo({
  abierto,
  form,
  setForm,
  aviso,
  aplicaciones,
  personasArQa,
  actasOrdenadas,
  onCerrar,
  onGuardar,
}: Props) {
  return (
    <Modal
      titulo={form.id ? 'Editar registro' : 'Nuevo registro de backlog futuro'}
      abierto={abierto}
      onCerrar={onCerrar}
    >
      <form onSubmit={onGuardar} className="space-y-3">
        {aviso && <div className="aviso aviso-error">{aviso}</div>}

        <Campo
          etiqueta="Nombre de la iniciativa"
          value={form.nombreIniciativa}
          onChange={(e) => setForm({ ...form, nombreIniciativa: e.target.value })}
          required
          className="w-full"
        />

        <Campo
          etiqueta="Tipo de demanda"
          value={form.tipoDemanda}
          onChange={(e) => setForm({ ...form, tipoDemanda: e.target.value })}
          className="w-full"
        />

        <Selector
          etiqueta="Squad"
          value={form.squadId}
          onChange={(e) => setForm({ ...form, squadId: e.target.value })}
          required
          className="w-full"
        >
          <option value="">— Selecciona —</option>
          {aplicaciones.map((a) => (
            <option key={a.codigo} value={a.codigo}>{a.nombre}</option>
          ))}
        </Selector>

        <Selector
          etiqueta="AR/QA"
          value={form.responsableId}
          onChange={(e) => setForm({ ...form, responsableId: e.target.value })}
          className="w-full"
        >
          <option value="">— Sin asignar —</option>
          {personasArQa.map((p) => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </Selector>

        <Campo
          etiqueta="Horas aproximadas"
          type="number"
          min="0"
          step="0.5"
          value={form.horasAproximadas}
          onChange={(e) => setForm({ ...form, horasAproximadas: e.target.value })}
          className="w-full"
        />

        <Campo
          etiqueta="Fecha tentativa de inicio"
          type="date"
          value={form.fechaTentativaInicio}
          onChange={(e) => setForm({ ...form, fechaTentativaInicio: e.target.value })}
          className="w-full"
        />

        <Selector
          etiqueta="Estado"
          value={form.estado}
          onChange={(e) => setForm({ ...form, estado: e.target.value })}
          className="w-full"
        >
          {ESTADOS.map((s) => (
            <option key={s} value={s}>{ESTADO_LABEL[s]}</option>
          ))}
        </Selector>

        <Selector
          etiqueta="¿Volvió acta?"
          value={form.volvioActa ? 'si' : 'no'}
          onChange={(e) => setForm({ ...form, volvioActa: e.target.value === 'si', actaId: e.target.value === 'si' ? form.actaId : '' })}
          className="w-full"
        >
          <option value="no">No</option>
          <option value="si">Sí</option>
        </Selector>

        {form.volvioActa && (
          <Selector
            etiqueta="Acta en la que se creó"
            value={form.actaId}
            onChange={(e) => setForm({ ...form, actaId: e.target.value })}
            required={form.volvioActa}
            className="w-full"
          >
            <option value="">— Selecciona el acta —</option>
            {actasOrdenadas.map((r) => (
              <option key={r.id} value={r.id}>
                {[r.codigo_req, r.nombre].filter(Boolean).join(' - ')}
              </option>
            ))}
          </Selector>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Boton variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton variante="primario" type="submit">
            {form.id ? 'Guardar' : 'Crear'}
          </Boton>
        </div>
      </form>
    </Modal>
  )
}
