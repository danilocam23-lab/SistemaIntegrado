// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import axios from 'axios'
import { useMemo, useState } from 'react'
import client from '../../api/client'
import { mensajeError } from '../../api/hooks'
import type { Aplicacion, Persona } from '../../types'
import { ROLES_DEFAULT } from './roles'

interface Args {
  /** `null` = alta nueva. */
  persona: Persona | null
  todas: Persona[]
  aplicaciones: Aplicacion[]
  roles: string[]
  tiposContratacion: string[]
  esGerente: boolean
  puedeGuardar: boolean
  modoConsolidado: boolean
  aplicacionActiva: string
  /** `movida` trae el nombre de la aplicación destino si el backend movió a la persona. */
  onGuardado: (movidaA?: string) => void
}

/**
 * Estado y envío del formulario del panel. El componente que lo usa debe remontarse
 * (`key`) al cambiar de persona: el estado inicial sale de `persona`.
 */
export function useFormularioPersona({
  persona,
  todas,
  aplicaciones,
  roles,
  tiposContratacion,
  esGerente,
  puedeGuardar,
  modoConsolidado,
  aplicacionActiva,
  onGuardado,
}: Args) {
  const [nombre, setNombre] = useState(persona?.nombre ?? '')
  const [email, setEmail] = useState(persona?.email ?? '')
  const [rol, setRol] = useState(persona?.rol_operativo ?? roles[0] ?? ROLES_DEFAULT[0])
  const [tipo, setTipo] = useState(persona?.tipo_contratacion ?? '')
  const [squads, setSquads] = useState<string[]>(persona?.squads ?? [])
  const [activo, setActivo] = useState(persona?.activo ?? true)
  const [fechaDesactivacion, setFechaDesactivacion] = useState(
    persona?.fecha_desactivacion ? persona.fecha_desactivacion.slice(0, 10) : '',
  )
  const [valorPersona, setValorPersona] = useState(String(persona?.valor_persona ?? 0))
  const [valorPerifericos, setValorPerifericos] = useState(String(persona?.valor_perifericos ?? 0))
  const [aplicacionManual, setAplicacionManual] = useState('')
  const [errorCorreo, setErrorCorreo] = useState('')
  const [errorGeneral, setErrorGeneral] = useState('')
  const [guardando, setGuardando] = useState(false)

  const codigoPorSquad = useMemo(() => {
    const m = new Map<string, string>()
    for (const a of aplicaciones) m.set(a.nombre, a.codigo)
    return m
  }, [aplicaciones])

  const aplicacionEfectiva = useMemo(() => {
    if (aplicacionManual) return aplicacionManual
    for (const s of squads) {
      const cod = codigoPorSquad.get(s)
      if (cod) return cod
    }
    return modoConsolidado ? '' : aplicacionActiva
  }, [aplicacionManual, squads, codigoPorSquad, modoConsolidado, aplicacionActiva])

  const nombreAplicacion = (codigo: string) => aplicaciones.find((a) => a.codigo === codigo)?.nombre ?? codigo

  // Edición: el backend reasigna la aplicación según el primer squad; se avisa si ese squad cambió.
  const squadPrincipalOriginal = persona?.squads?.[0] ?? null
  const cambiaAplicacion = !!persona && squads.length > 0 && squads[0] !== squadPrincipalOriginal && codigoPorSquad.has(squads[0])

  // Solo datos legados: ya estaba inactiva y sin fecha. Si se acaba de desmarcar «Activa», el backend fija la fecha.
  const fechaEditable = !activo && !!persona && !persona.activo && !persona.fecha_desactivacion
  const fechaExistente = !activo && !!persona && !persona.activo ? persona.fecha_desactivacion ?? null : null

  const opcionesRol = useMemo(() => (rol && !roles.includes(rol) ? [...roles, rol] : roles), [roles, rol])
  const opcionesTipo = useMemo(
    () => (tipo && !tiposContratacion.includes(tipo) ? [...tiposContratacion, tipo] : tiposContratacion),
    [tiposContratacion, tipo],
  )

  async function guardar(): Promise<void> {
    if (!puedeGuardar || guardando) return
    setErrorCorreo('')
    setErrorGeneral('')
    if (!nombre.trim()) {
      setErrorGeneral('El nombre es obligatorio.')
      return
    }

    // Unicidad correo + squad (squads nuevos respecto al registro original).
    const correo = email.trim().toLowerCase()
    if (correo) {
      const nuevos = persona ? squads.filter((s) => !(persona.squads ?? []).includes(s)) : squads
      for (const squad of nuevos) {
        const repetida = todas.find(
          (p) => p.id !== persona?.id && (p.email ?? '').trim().toLowerCase() === correo && (p.squads ?? []).includes(squad),
        )
        if (repetida) {
          setErrorCorreo(`El correo "${email}" ya está registrado en el squad "${squad}" (persona: ${repetida.nombre}).`)
          return
        }
      }
    }

    const payload: Record<string, unknown> = {
      nombre: nombre.trim(),
      email: email.trim() || null,
      rol_operativo: rol,
      tipo_contratacion: tipo || null,
      squads,
      activo,
    }
    if (esGerente) {
      payload.valor_persona = Number(valorPersona) || 0
      payload.valor_perifericos = Number(valorPerifericos) || 0
    }
    if (fechaEditable && fechaDesactivacion) payload.fecha_desactivacion = fechaDesactivacion

    setGuardando(true)
    try {
      if (persona) {
        // Campos sin UI de edición: se reenvían tal cual para no perderlos.
        const { data } = await client.put<{ aplicacion_movida?: { hacia: string } }>(`/personas/${persona.id}`, {
          ...payload,
          es_lider_tecnico: persona.es_lider_tecnico ?? false,
          permite_sobrecarga: persona.permite_sobrecarga ?? false,
          usuario_id: persona.usuario_id ?? null,
        })
        onGuardado(data?.aplicacion_movida ? nombreAplicacion(data.aplicacion_movida.hacia) : undefined)
      } else {
        if (!aplicacionEfectiva) {
          setErrorGeneral('Selecciona al menos un squad o una aplicación.')
          return
        }
        await client.post('/personas', { ...payload, aplicacion_id: aplicacionEfectiva })
        onGuardado()
      }
    } catch (err) {
      const detalle = mensajeError(err)
      const sinAcceso = axios.isAxiosError(err) && err.response?.status === 403
      setErrorGeneral(
        sinAcceso && !persona
          ? `${detalle}. La persona se crea en la aplicación de su primer squad` +
            `${aplicacionEfectiva ? ` («${nombreAplicacion(aplicacionEfectiva)}»)` : ''}, y no tienes acceso de escritura a ella. ` +
            'Elige como primer squad uno de la aplicación activa y vuelve a intentarlo.'
          : detalle,
      )
    } finally {
      setGuardando(false)
    }
  }

  return {
    nombre, setNombre,
    email, setEmail,
    rol, setRol,
    tipo, setTipo,
    squads, setSquads,
    activo, setActivo,
    fechaDesactivacion, setFechaDesactivacion,
    valorPersona, setValorPersona,
    valorPerifericos, setValorPerifericos,
    aplicacionManual, setAplicacionManual,
    aplicacionEfectiva,
    nombreAplicacion,
    cambiaAplicacion,
    fechaEditable,
    fechaExistente,
    opcionesRol,
    opcionesTipo,
    errorCorreo,
    errorGeneral,
    guardando,
    guardar,
  }
}
