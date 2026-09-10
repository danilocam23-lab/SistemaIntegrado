import type { FormEvent } from 'react'
import { Boton, Icono } from '../../components/ui'
import { MESES_ES } from '../../constantes'
import type { FormularioEntregaControl } from './useFormularioEntrega'

interface Props {
  form: FormularioEntregaControl
  estadosEnt: string[]
  estadoRequerimiento: string
  onSubmit: (e: FormEvent) => void
  onVerHistorial: () => void
}

export default function FormularioEntrega({
  form,
  estadosEnt,
  estadoRequerimiento,
  onSubmit,
  onVerHistorial,
}: Props) {
  const { valores, editando } = form
  const fechaComprometidaRequerida = estadoRequerimiento.toUpperCase() !== 'CONTROL DE CAMBIOS'

  return (
    <form onSubmit={onSubmit} className={`flex flex-wrap items-end gap-3 border-t pt-3 ${editando ? 'rounded-lg bg-amber-50 p-3' : ''}`}>
      {editando && (
        <div className="flex w-full items-center gap-1.5 text-xs font-semibold text-amber-700">
          <Icono nombre="lapiz" />
          Editando entrega N° {valores.numero} — los cambios reemplazarán la entrega existente
        </div>
      )}
      <label className="text-sm">
        <span className="mb-1 block text-slate-600">N° entrega</span>
        <input value={valores.numero} onChange={(e) => form.actualizar('numero', e.target.value)} type="number" required
          readOnly={editando}
          className={`campo w-24 ${editando ? 'bg-slate-100 text-slate-500' : ''}`} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-slate-600">Horas</span>
        <input value={valores.horas} onChange={(e) => form.actualizar('horas', e.target.value)} type="number" step="any"
          className="campo w-28" />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-slate-600">
          Fecha comprometida
          {fechaComprometidaRequerida && (
            <span className="ml-1 text-red-500">*</span>
          )}
        </span>
        <input
          value={valores.fecha}
          onChange={(e) => form.actualizar('fecha', e.target.value)}
          type="date"
          required={fechaComprometidaRequerida}
          className="campo"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-slate-600">Fecha real entrega</span>
        <input value={valores.fechaReal} onChange={(e) => form.actualizar('fechaReal', e.target.value)} type="date"
          className="campo" />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-slate-600">Estado</span>
        <select value={valores.estado} onChange={(e) => form.cambiarEstado(e.target.value)}
          className="campo">
          {estadosEnt.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      {valores.estado.toUpperCase() === 'APROBADA' && (
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Mes de aprobación</span>
          <select
            value={valores.mesAprobacion}
            onChange={(e) => form.actualizar('mesAprobacion', e.target.value)}
            className="campo"
          >
            <option value="">— Seleccionar —</option>
            {MESES_ES.map((mes) => <option key={mes} value={mes}>{mes}</option>)}
          </select>
        </label>
      )}
      <label className="min-w-[280px] flex-1 text-sm">
        <span className="mb-1 block text-slate-600">Observaciones EPM</span>
        <input
          value={valores.observaciones}
          onChange={(e) => form.actualizar('observaciones', e.target.value)}
          placeholder="Notas de la entrega (EPM)"
          className="campo w-full"
        />
      </label>
      <label className="min-w-[280px] flex-1 text-sm">
        <span className="mb-1 block text-slate-600">Observaciones Hitss</span>
        <input
          value={valores.observacionesHitss}
          onChange={(e) => form.actualizar('observacionesHitss', e.target.value)}
          placeholder="Notas de la entrega (Hitss)"
          className="campo w-full"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-slate-600">Tipificación</span>
        <select
          value={valores.tipificacion}
          onChange={(e) => form.actualizar('tipificacion', e.target.value)}
          className="campo"
        >
          <option value="">— Seleccionar —</option>
          <option value="HITSS">Hitss</option>
          <option value="EPM">EPM</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={valores.garantia} onChange={(e) => form.cambiarGarantia(e.target.checked)} />
        <span className="text-slate-600">Garantía</span>
      </label>
      {valores.garantia && (
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">N° Garantía</span>
          <input type="number" min={1} value={valores.numeroGarantia ?? ''} onChange={(e) => form.actualizar('numeroGarantia', e.target.value ? Number(e.target.value) : null)}
            className="campo campo-sm w-20" />
        </label>
      )}
      <Boton variante="primario" type="submit">
        {editando ? 'Guardar cambios' : 'Guardar entrega'}
      </Boton>
      {editando && (
        <Boton variante="secundario" onClick={onVerHistorial}>
          Historial de estados
        </Boton>
      )}
      {editando && (
        <Boton variante="secundario" onClick={form.cancelar}>
          Cancelar
        </Boton>
      )}
    </form>
  )
}
