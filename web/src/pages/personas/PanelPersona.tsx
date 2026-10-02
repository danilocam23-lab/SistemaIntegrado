// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useId } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Aviso, Boton, Campo, Interruptor, Selector } from '../../components/ui'
import type { Aplicacion, Persona } from '../../types'
import { PanelLateral } from '../asignaciones/PanelLateral'
import { AvatarRol, ChipRol } from './ChipRol'
import { InsigniasPersona } from './InsigniasPersona'
import { SelectorSquads } from './SelectorSquads'
import { ROL_SIN_CONTRATACION } from './roles'
import { useFormularioPersona } from './useFormularioPersona'

interface Props {
  /** `null` = alta nueva. */
  persona: Persona | null
  todas: Persona[]
  aplicaciones: Aplicacion[]
  roles: string[]
  tiposContratacion: string[]
  esGerente: boolean
  puedeEditar: boolean
  puedeCrear: boolean
  puedeEliminar: boolean
  modoConsolidado: boolean
  aplicacionActiva: string
  /** Error de una acción lanzada desde fuera del formulario (p. ej. eliminar → 409). */
  errorExterno: string
  onGuardado: (movidaA?: string) => void
  onEliminar: (persona: Persona) => void
  onCerrar: () => void
}

function Seccion({ titulo, nota, children }: { titulo: string; nota?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3 border-b border-slate-100 pb-4 last:border-b-0">
      <h3 className="text-2xs font-bold uppercase tracking-wider text-slate-500">{titulo}</h3>
      {children}
      {nota && <p className="text-xs text-slate-500">{nota}</p>}
    </section>
  )
}

/** Panel lateral de detalle y edición de una persona (o alta nueva). */
export function PanelPersona(props: Props) {
  const { persona, aplicaciones, esGerente, puedeEditar, puedeCrear, puedeEliminar, modoConsolidado } = props
  const idFormulario = useId()
  const nuevo = persona === null
  const puedeGuardar = nuevo ? puedeCrear : puedeEditar
  const f = useFormularioPersona({
    persona,
    todas: props.todas,
    aplicaciones,
    roles: props.roles,
    tiposContratacion: props.tiposContratacion,
    esGerente,
    puedeGuardar,
    modoConsolidado,
    aplicacionActiva: props.aplicacionActiva,
    onGuardado: props.onGuardado,
  })

  const sinContratacion = f.rol === ROL_SIN_CONTRATACION
  const squadsActivos = aplicaciones.filter((a) => a.activa).map((a) => a.nombre)
  const error = f.errorGeneral || props.errorExterno
  const destino = f.aplicacionEfectiva ? f.nombreAplicacion(f.aplicacionEfectiva) : ''

  function alEnviar(e: FormEvent) {
    e.preventDefault()
    void f.guardar()
  }

  const titulo = (
    <span className="flex min-w-0 items-center gap-2">
      <AvatarRol nombre={f.nombre} rol={f.rol} inactiva={persona ? !persona.activo : false} />
      <span className="truncate">{nuevo ? 'Nueva persona' : persona.nombre}</span>
    </span>
  )

  const pie = (
    <>
      {persona && puedeEliminar && (
        <Boton variante="peligro-suave" onClick={() => props.onEliminar(persona)}>
          Eliminar persona…
        </Boton>
      )}
      <span className="flex-1" />
      <Boton onClick={props.onCerrar}>{puedeGuardar ? 'Cancelar' : 'Cerrar'}</Boton>
      {puedeGuardar && (
        <Boton variante="primario" type="submit" form={idFormulario} disabled={f.guardando}>
          {f.guardando ? 'Guardando…' : nuevo ? 'Crear' : 'Guardar cambios'}
        </Boton>
      )}
    </>
  )

  return (
    <PanelLateral abierto titulo={titulo} onCerrar={props.onCerrar} pie={pie}>
      <form id={idFormulario} onSubmit={alEnviar} className="space-y-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <ChipRol rol={f.rol} />
          {persona && <InsigniasPersona persona={persona} />}
        </div>

        {error && (
          <Aviso tono="error">
            <span role="alert">{error}</span>
          </Aviso>
        )}

        <Seccion titulo="Identidad">
          <Campo
            etiqueta="Nombre *"
            value={f.nombre}
            onChange={(e) => f.setNombre(e.target.value)}
            required
            disabled={!puedeGuardar}
            className="w-full"
          />
          <Campo
            etiqueta="Correo"
            type="email"
            value={f.email}
            onChange={(e) => f.setEmail(e.target.value)}
            disabled={!puedeGuardar}
            className="w-full"
            ayuda="Correo + squad no puede repetirse: se valida al guardar."
          />
          {f.errorCorreo && (
            <Aviso tono="error">
              <span role="alert">{f.errorCorreo}</span>
            </Aviso>
          )}
        </Seccion>

        <Seccion
          titulo="Rol operativo"
          nota={sinContratacion && 'LT_EPM es personal del cliente: no lleva contratación ni valores (igual que hoy).'}
        >
          <Selector
            etiqueta="Rol"
            value={f.rol}
            onChange={(e) => f.setRol(e.target.value)}
            disabled={!puedeGuardar}
            className="w-full"
          >
            {f.opcionesRol.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </Selector>
          {!sinContratacion && (
            <Selector
              etiqueta="Tipo de contratación"
              value={f.tipo}
              onChange={(e) => f.setTipo(e.target.value)}
              disabled={!puedeGuardar}
              className="w-full"
            >
              <option value="">— Sin especificar —</option>
              {f.opcionesTipo.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Selector>
          )}
        </Seccion>

        <Seccion
          titulo="Squads"
          nota={
            f.cambiaAplicacion
              ? undefined
              : 'El primer squad fija la aplicación de la persona.'
          }
        >
          <SelectorSquads
            seleccionados={f.squads}
            disponibles={squadsActivos}
            deshabilitado={!puedeGuardar}
            onCambiar={(s) => {
              f.setSquads(s)
              f.setAplicacionManual('')
            }}
          />
          {destino && (nuevo || f.cambiaAplicacion) && (
            <p className="text-xs font-semibold text-cyan-700">Se guardará en: {destino}</p>
          )}
          {f.cambiaAplicacion && (
            <Aviso tono="alerta">
              <span role="status">
                Cambiaste el squad principal: al guardar, la persona pasará a la aplicación {destino}.
              </span>
            </Aviso>
          )}
          {nuevo && (
            <Selector
              etiqueta={modoConsolidado ? 'Aplicación (obligatoria en modo consolidado)' : 'Aplicación'}
              value={f.aplicacionEfectiva}
              onChange={(e) => f.setAplicacionManual(e.target.value)}
              className="w-full"
              required={modoConsolidado}
            >
              {modoConsolidado && <option value="">— Selecciona una aplicación —</option>}
              {aplicaciones.filter((a) => a.activa).map((a) => (
                <option key={a.codigo} value={a.codigo}>{a.nombre}</option>
              ))}
            </Selector>
          )}
        </Seccion>

        {!sinContratacion && (
          <Seccion
            titulo="Valores económicos"
            nota={!esGerente && 'Sin permiso para ver los valores económicos. Esta sección no se muestra y no se envía al guardar.'}
          >
            {esGerente && (
              <div className="grid grid-cols-2 gap-3">
                <Campo
                  etiqueta="Valor de la persona ($)"
                  type="number"
                  min={0}
                  step={0.01}
                  value={f.valorPersona}
                  onChange={(e) => f.setValorPersona(e.target.value)}
                  disabled={!puedeGuardar}
                  className="w-full"
                />
                <Campo
                  etiqueta="Valor de periféricos ($)"
                  type="number"
                  min={0}
                  step={0.01}
                  value={f.valorPerifericos}
                  onChange={(e) => f.setValorPerifericos(e.target.value)}
                  disabled={!puedeGuardar}
                  className="w-full"
                />
              </div>
            )}
          </Seccion>
        )}

        <Seccion
          titulo="Estado"
          nota={
            f.activo
              ? 'Al desactivar se registra la fecha automáticamente.'
              : persona?.activo
                ? 'Se registrará la fecha de desactivación al guardar.'
                : 'Al reactivar se limpia la fecha de desactivación.'
          }
        >
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Interruptor
              activo={f.activo}
              etiquetaActivo="Persona activa"
              etiquetaInactivo="Persona inactiva"
              disabled={!puedeGuardar}
              onClick={() => f.setActivo(!f.activo)}
            />
            {f.activo ? 'Activa' : 'Inactiva'}
          </label>
          {f.fechaEditable && (
            <Campo
              etiqueta="F. desactivación (dato legado: la persona está inactiva y no tiene fecha)"
              type="date"
              value={f.fechaDesactivacion}
              onChange={(e) => f.setFechaDesactivacion(e.target.value)}
              className="w-full"
            />
          )}
          {f.fechaExistente && (
            <p className="text-xs text-slate-600">F. desactivación: {f.fechaExistente.slice(0, 10)} (no editable)</p>
          )}
        </Seccion>

        {persona && (
          <Seccion
            titulo="Vinculación (solo lectura)"
            nota="Líder técnico, «permite sobrecarga» y usuario vinculado se conservan sin cambios al guardar."
          >
            <ul className="space-y-1 text-sm text-slate-700">
              <li>Usuario: {persona.usuario_id ? 'vinculada a una cuenta de usuario' : 'sin cuenta de usuario vinculada'}</li>
              <li>Líder técnico: {persona.es_lider_tecnico ? 'sí' : 'no'}</li>
              <li>Permite sobrecarga: {persona.permite_sobrecarga ? 'sí' : 'no'}</li>
            </ul>
          </Seccion>
        )}
      </form>
    </PanelLateral>
  )
}
