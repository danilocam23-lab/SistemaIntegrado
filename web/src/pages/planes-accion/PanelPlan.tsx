// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useId, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Aviso, AreaTexto, Boton, Campo, Icono, Selector } from '../../components/ui'
import type { Persona, PlanAccion } from '../../types'
import { PanelLateral } from '../asignaciones/PanelLateral'
import { diasHasta, finDeMes, formatearMarca, sumarDias, textoVencimiento } from './fechas'
import { ESTADOS, ESTADO_LABEL, esAbierto } from './tipos'
import type { FormPlan } from './tipos'

interface Props {
  /** `null` = cerrado. */
  form: FormPlan | null
  /** Plan original al editar (para fechas de creación/edición). */
  plan: PlanAccion | null
  responsablesAsignables: Persona[]
  personasPorId: Map<string, Persona>
  hoy: Date
  /** Devuelve el error del servidor o null si se guardó. */
  onGuardar: (form: FormPlan) => Promise<string | null>
  onEliminar: (plan: PlanAccion) => void
  onCerrar: () => void
}

/** Panel lateral de crear/editar; reemplaza al formulario fijo. Enter guarda, Esc cierra. */
export function PanelPlan(props: Props) {
  // El componente interno se remonta con cada apertura (clave por id) para reiniciar el borrador.
  if (!props.form) return null
  return <ContenidoPanel key={props.form.id ?? 'nuevo'} {...props} form={props.form} />
}

function ContenidoPanel({
  form: inicial, plan, responsablesAsignables, personasPorId, hoy, onGuardar, onEliminar, onCerrar,
}: Props & { form: FormPlan }) {
  const idFormulario = useId()
  const [form, setForm] = useState<FormPlan>(inicial)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const editando = form.id !== null

  // Opciones: activos LT_HITSS/SCRUM + el responsable actual aunque ya no cumpla (se conserva).
  const opciones = useMemo(() => {
    const lista = responsablesAsignables.map((p) => ({ id: p.id, etiqueta: p.nombre }))
    const actual = form.responsableId ? personasPorId.get(form.responsableId) : undefined
    if (form.responsableId && !lista.some((o) => o.id === form.responsableId)) {
      const motivo = !actual ? 'no encontrado' : !actual.activo ? 'inactivo' : `rol ${actual.rol_operativo}`
      lista.unshift({ id: form.responsableId, etiqueta: `${actual?.nombre ?? 'Responsable'} (${motivo})` })
    }
    return lista
  }, [responsablesAsignables, personasPorId, form.responsableId])

  const dias = diasHasta(form.fechaLimite, hoy)
  const notaFecha = form.fechaLimite && esAbierto(form.estado) ? textoVencimiento(dias) : ''

  async function enviar(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (guardando) return
    if (!form.titulo.trim()) {
      setError('El título es obligatorio.')
      return
    }
    setError('')
    setGuardando(true)
    const mensaje = await onGuardar(form)
    setGuardando(false)
    if (mensaje) setError(mensaje)
    else onCerrar()
  }

  const marcas = plan
    ? [
        plan.creado_en ? `Creado el ${formatearMarca(plan.creado_en)}` : '',
        plan.actualizado_en ? `última edición ${formatearMarca(plan.actualizado_en)}` : '',
      ].filter(Boolean).join(' · ')
    : ''

  return (
    <PanelLateral
      abierto
      titulo={editando ? 'Editar plan de acción' : 'Nuevo plan de acción'}
      onCerrar={onCerrar}
      pie={(
        <>
          <Boton
            variante="primario"
            type="submit"
            form={idFormulario}
            disabled={guardando}
            icono={<Icono nombre={editando ? 'guardar' : 'check'} />}
          >
            {guardando ? 'Guardando…' : editando ? 'Guardar' : 'Crear'}
          </Boton>
          <Boton onClick={onCerrar}>Cancelar</Boton>
          {editando && plan && (
            <Boton
              variante="peligro-suave"
              className="ml-auto"
              icono={<Icono nombre="papelera" />}
              onClick={() => {
                onEliminar(plan)
                onCerrar()
              }}
            >
              Eliminar
            </Boton>
          )}
        </>
      )}
    >
      <form id={idFormulario} onSubmit={(e) => void enviar(e)} className="grid gap-4">
        {marcas && <p className="text-xs text-slate-500">{marcas}</p>}

        {error && (
          <Aviso tono="error">
            <span role="alert">{error}</span>
          </Aviso>
        )}

        <Campo
          etiqueta="Título *"
          value={form.titulo}
          onChange={(e) => setForm({ ...form, titulo: e.target.value })}
          required
          maxLength={200}
          autoFocus
        />
        <AreaTexto
          etiqueta="Descripción"
          rows={3}
          maxLength={2000}
          value={form.descripcion}
          onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
        />

        <div>
          <Selector
            etiqueta="Responsable"
            value={form.responsableId}
            onChange={(e) => setForm({ ...form, responsableId: e.target.value })}
          >
            <option value="">— Ninguno —</option>
            {opciones.map((o) => (
              <option key={o.id} value={o.id}>{o.etiqueta}</option>
            ))}
          </Selector>
          <p className="mt-1 text-xs text-slate-500">
            Solo LT_HITSS y SCRUM activos. Si el responsable actual quedó inactivo o cambió de rol, se
            conserva hasta que lo cambies.
          </p>
        </div>

        <div>
          <Campo
            etiqueta="Fecha límite"
            type="date"
            value={form.fechaLimite}
            onChange={(e) => setForm({ ...form, fechaLimite: e.target.value })}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Boton tamano="sm" onClick={() => setForm({ ...form, fechaLimite: sumarDias(hoy, 7) })}>Hoy + 7 d</Boton>
            <Boton tamano="sm" onClick={() => setForm({ ...form, fechaLimite: finDeMes(hoy) })}>Fin de mes</Boton>
            <Boton tamano="sm" onClick={() => setForm({ ...form, fechaLimite: sumarDias(hoy, 30) })}>Hoy + 30 d</Boton>
            <Boton tamano="sm" onClick={() => setForm({ ...form, fechaLimite: '' })}>Sin fecha</Boton>
          </div>
          {notaFecha && (
            <p className={`mt-1 text-xs ${dias !== null && dias < 0 ? 'font-semibold text-red-700' : 'text-slate-500'}`}>
              {dias !== null && dias < 0 && <span aria-hidden="true">⚠ </span>}
              {notaFecha.charAt(0).toUpperCase() + notaFecha.slice(1)}
            </p>
          )}
        </div>

        <fieldset>
          <legend className="etiqueta mb-1">Estado</legend>
          <div className="flex flex-wrap gap-1.5">
            {ESTADOS.map((s) => (
              <Boton
                key={s}
                tamano="sm"
                variante={form.estado === s ? 'primario' : 'secundario'}
                aria-pressed={form.estado === s}
                onClick={() => setForm({ ...form, estado: s })}
              >
                {ESTADO_LABEL[s]}
              </Boton>
            ))}
          </div>
        </fieldset>
      </form>
    </PanelLateral>
  )
}
