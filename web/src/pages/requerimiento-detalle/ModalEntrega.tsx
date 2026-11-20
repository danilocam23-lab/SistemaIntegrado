// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useEffect, useState } from 'react'
import type { FormEvent, MouseEvent } from 'react'
import Modal from '../../components/Modal'
import { AreaTexto, Aviso, Boton, Campo, PanelPestana, Pestanas, Selector } from '../../components/ui'
import type { DefinicionPestana } from '../../components/ui'
import { MESES_ES, TIPIFICACIONES } from '../../constantes'
import type { FormularioEntregaControl } from './useFormularioEntrega'

export type ModoModalEntrega = 'crear' | 'editar'

interface Props {
  abierto: boolean
  modo: ModoModalEntrega
  form: FormularioEntregaControl
  estadosEnt: string[]
  estadoRequerimiento: string
  onSubmit: (e: FormEvent) => void
  onCerrar: () => void
  /** Error a mostrar sobre las pestañas (p. ej. N.º de entrega repetido). */
  error?: string
}

const PREFIJO = 'modal-entrega'

/**
 * Modal único de entrega, para crear y para editar (reemplaza al formulario en línea del
 * pie de la tabla y al modal de edición, que eran casi idénticos).
 *
 * - Crear: pestañas Entrega | Tipificación y garantía; N.º editable; sin Observaciones
 *   (el backend registra solo la nota "Entrega N.º X creada").
 * - Editar: Entrega | Observaciones | Tipificación y garantía; N.º de solo lectura.
 *
 * Todos los paneles quedan montados (ocultos) para no perder lo escrito. El estado vive en
 * el `useFormularioEntrega` del padre; el modal solo lo presenta.
 *
 * INVARIANTES (no cambiar): fecha comprometida obligatoria salvo en CONTROL DE CAMBIOS;
 * "Mes de aprobación" solo con estado APROBADA; N.º de garantía solo con garantía marcada;
 * mismos `data-analytics-*` y mismo payload (`cuerpoEntrega`) que antes.
 */
export default function ModalEntrega({
  abierto,
  modo,
  form,
  estadosEnt,
  estadoRequerimiento,
  onSubmit,
  onCerrar,
  error,
}: Props) {
  const { valores } = form
  const editar = modo === 'editar'
  const fechaComprometidaRequerida = estadoRequerimiento.toUpperCase() !== 'CONTROL DE CAMBIOS'

  const [pestana, setPestana] = useState('entrega')
  useEffect(() => {
    if (abierto) setPestana('entrega')
  }, [abierto])

  const pestanas: DefinicionPestana[] = [
    { id: 'entrega', etiqueta: 'Entrega' },
    { id: 'observaciones', etiqueta: 'Observaciones', oculta: !editar },
    { id: 'tipificacion', etiqueta: 'Tipificación y garantía' },
  ]
  const activa = pestanas.some((p) => p.id === pestana && !p.oculta) ? pestana : 'entrega'

  // Los campos obligatorios viven en la pestaña "Entrega": si el navegador no puede
  // enfocar un campo inválido oculto, se vuelve a ella y se muestra el aviso nativo.
  function alGuardar(e: MouseEvent<HTMLButtonElement>): void {
    const formulario = e.currentTarget.form
    if (formulario && !formulario.checkValidity()) {
      e.preventDefault()
      setPestana('entrega')
      window.setTimeout(() => formulario.reportValidity(), 0)
    }
  }

  return (
    <Modal
      titulo={editar ? `Editar entrega N.º ${valores.numero || '—'}` : 'Nueva entrega'}
      abierto={abierto}
      onCerrar={onCerrar}
    >
      <form
        data-analytics-form={editar ? 'entrega_editar' : 'entrega'}
        onSubmit={onSubmit}
        className="space-y-4"
      >
        <Pestanas
          prefijo={PREFIJO}
          etiqueta="Secciones de la entrega"
          pestanas={pestanas}
          activa={activa}
          onCambiar={setPestana}
        />
        {error && <div role="alert"><Aviso tono="error">{error}</Aviso></div>}

        <PanelPestana prefijo={PREFIJO} id="entrega" activa={activa}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo
              etiqueta="N.º entrega"
              value={valores.numero}
              onChange={(e) => form.actualizar('numero', e.target.value)}
              type="number"
              min={1}
              required
              readOnly={editar}
              className="w-full"
            />
            <Campo
              etiqueta="Horas"
              value={valores.horas}
              onChange={(e) => form.actualizar('horas', e.target.value)}
              type="number"
              step="any"
              className="w-full"
            />
            <Campo
              etiqueta={fechaComprometidaRequerida ? 'Fecha comprometida *' : 'Fecha comprometida'}
              value={valores.fecha}
              onChange={(e) => form.actualizar('fecha', e.target.value)}
              type="date"
              required={fechaComprometidaRequerida}
              className="w-full"
            />
            <Campo
              etiqueta="Fecha real entrega"
              value={valores.fechaReal}
              onChange={(e) => form.actualizar('fechaReal', e.target.value)}
              type="date"
              className="w-full"
            />
            <Selector
              data-analytics-id="entrega.estado"
              etiqueta="Estado"
              value={valores.estado}
              onChange={(e) => form.cambiarEstado(e.target.value)}
              className="w-full"
            >
              {estadosEnt.map((s) => <option key={s} value={s}>{s}</option>)}
            </Selector>
            {valores.estado.toUpperCase() === 'APROBADA' && (
              <Selector
                data-analytics-id="entrega.mes"
                etiqueta="Mes de aprobación"
                value={valores.mesAprobacion}
                onChange={(e) => form.actualizar('mesAprobacion', e.target.value)}
                className="w-full"
              >
                <option value="">— Seleccionar —</option>
                {MESES_ES.map((mes) => <option key={mes} value={mes}>{mes}</option>)}
              </Selector>
            )}
          </div>
        </PanelPestana>

        {editar && (
          <PanelPestana prefijo={PREFIJO} id="observaciones" activa={activa}>
            <div className="grid gap-3">
              <AreaTexto
                etiqueta="Observaciones EPM"
                value={valores.observaciones}
                onChange={(e) => form.actualizar('observaciones', e.target.value)}
                placeholder="Notas de la entrega (EPM)"
                rows={3}
                className="w-full"
              />
              <AreaTexto
                etiqueta="Observaciones Hitss"
                value={valores.observacionesHitss}
                onChange={(e) => form.actualizar('observacionesHitss', e.target.value)}
                placeholder="Notas de la entrega (Hitss)"
                rows={3}
                className="w-full"
              />
            </div>
          </PanelPestana>
        )}

        <PanelPestana prefijo={PREFIJO} id="tipificacion" activa={activa}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Selector
              data-analytics-id="entrega.tipificacion"
              etiqueta="Tipificación"
              value={valores.tipificacion}
              onChange={(e) => form.actualizar('tipificacion', e.target.value)}
              className="w-full"
            >
              <option value="">— Seleccionar —</option>
              {TIPIFICACIONES.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
            </Selector>
            <label className="flex items-center gap-2 text-sm sm:mt-6">
              <input
                data-analytics-id="entrega.garantia"
                type="checkbox"
                checked={valores.garantia}
                onChange={(e) => form.cambiarGarantia(e.target.checked)}
              />
              <span className="text-slate-600">Es garantía</span>
            </label>
            {valores.garantia && (
              <Campo
                etiqueta="N.º garantía"
                type="number"
                min={1}
                value={valores.numeroGarantia ?? ''}
                onChange={(e) => form.actualizar('numeroGarantia', e.target.value ? Number(e.target.value) : null)}
                className="w-full"
              />
            )}
          </div>
        </PanelPestana>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
          {!editar && (
            <small className="mr-auto text-xs text-slate-500">
              Al crearla se registra en la bitácora: “Entrega N.º {valores.numero || 'X'} creada”.
            </small>
          )}
          <Boton data-analytics-id="entrega.cancelar" variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton data-analytics-id="entrega.guardar" variante="primario" type="submit" onClick={alGuardar}>
            {editar ? 'Guardar cambios' : 'Crear entrega'}
          </Boton>
        </div>
      </form>
    </Modal>
  )
}
