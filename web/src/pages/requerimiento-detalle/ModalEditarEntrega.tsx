import type { FormEvent } from 'react'
import Modal from '../../components/Modal'
import { Boton, Campo, Selector } from '../../components/ui'
import { MESES_ES } from '../../constantes'
import type { FormularioEntregaControl } from './useFormularioEntrega'

interface Props {
  abierto: boolean
  form: FormularioEntregaControl
  estadosEnt: string[]
  estadoRequerimiento: string
  onSubmit: (e: FormEvent) => void
  onCerrar: () => void
}

/**
 * Modal de edición de una entrega existente. Usa una instancia de
 * `useFormularioEntrega` independiente de la del formulario de alta (al pie
 * de la tabla de Entregas), para que editar no comparta estado con crear.
 * Mismos campos que antes editaba el formulario inline (salvo el N° de
 * entrega, que ahora solo se muestra en el título, de solo lectura igual que
 * antes) y el mismo endpoint/payload de guardado.
 */
export default function ModalEditarEntrega({
  abierto,
  form,
  estadosEnt,
  estadoRequerimiento,
  onSubmit,
  onCerrar,
}: Props) {
  const { valores } = form
  const fechaComprometidaRequerida = estadoRequerimiento.toUpperCase() !== 'CONTROL DE CAMBIOS'

  return (
    <Modal
      titulo={`Editar entrega N° ${valores.numero || '—'}`}
      abierto={abierto}
      onCerrar={onCerrar}
      ancho="xl"
    >
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Horas</span>
          <Campo
            value={valores.horas}
            onChange={(e) => form.actualizar('horas', e.target.value)}
            type="number"
            step="any"
            className="w-28"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">
            Fecha comprometida
            {fechaComprometidaRequerida && <span className="ml-1 text-red-500">*</span>}
          </span>
          <Campo
            value={valores.fecha}
            onChange={(e) => form.actualizar('fecha', e.target.value)}
            type="date"
            required={fechaComprometidaRequerida}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Fecha real entrega</span>
          <Campo value={valores.fechaReal} onChange={(e) => form.actualizar('fechaReal', e.target.value)} type="date" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Estado</span>
          <Selector value={valores.estado} onChange={(e) => form.cambiarEstado(e.target.value)}>
            {estadosEnt.map((s) => <option key={s} value={s}>{s}</option>)}
          </Selector>
        </label>
        {valores.estado.toUpperCase() === 'APROBADA' && (
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Mes de aprobación</span>
            <Selector
              value={valores.mesAprobacion}
              onChange={(e) => form.actualizar('mesAprobacion', e.target.value)}
            >
              <option value="">— Seleccionar —</option>
              {MESES_ES.map((mes) => <option key={mes} value={mes}>{mes}</option>)}
            </Selector>
          </label>
        )}
        <label className="min-w-[280px] flex-1 text-sm">
          <span className="mb-1 block text-slate-600">Observaciones EPM</span>
          <Campo
            value={valores.observaciones}
            onChange={(e) => form.actualizar('observaciones', e.target.value)}
            placeholder="Notas de la entrega (EPM)"
            className="w-full"
          />
        </label>
        <label className="min-w-[280px] flex-1 text-sm">
          <span className="mb-1 block text-slate-600">Observaciones Hitss</span>
          <Campo
            value={valores.observacionesHitss}
            onChange={(e) => form.actualizar('observacionesHitss', e.target.value)}
            placeholder="Notas de la entrega (Hitss)"
            className="w-full"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Tipificación</span>
          <Selector
            value={valores.tipificacion}
            onChange={(e) => form.actualizar('tipificacion', e.target.value)}
          >
            <option value="">— Seleccionar —</option>
            <option value="HITSS">Hitss</option>
            <option value="EPM">EPM</option>
          </Selector>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={valores.garantia} onChange={(e) => form.cambiarGarantia(e.target.checked)} />
          <span className="text-slate-600">Garantía</span>
        </label>
        {valores.garantia && (
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">N° Garantía</span>
            <Campo
              type="number"
              min={1}
              value={valores.numeroGarantia ?? ''}
              onChange={(e) => form.actualizar('numeroGarantia', e.target.value ? Number(e.target.value) : null)}
              compacto
              className="w-20"
            />
          </label>
        )}
        <div className="flex w-full justify-end gap-2 border-t pt-3">
          <Boton variante="secundario" type="button" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton variante="primario" type="submit">
            Guardar
          </Boton>
        </div>
      </form>
    </Modal>
  )
}
