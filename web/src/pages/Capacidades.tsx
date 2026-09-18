// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import client from '../api/client'
import { mensajeError, useLista } from '../api/hooks'
import { useAuth } from '../context/AuthContext'
import { Boton, EncabezadoPagina, Icono } from '../components/ui'
import ModalCapacidad from './capacidades/ModalCapacidad'
import TablaCapacidadesMatriz from './capacidades/TablaCapacidadesMatriz'
import { useMatrizCapacidades } from './capacidades/useMatrizCapacidades'
import type { Capacidad, Persona } from '../types'

const ROLES_EXCLUIDOS_CAPACIDAD_PERSONA = ['LT_EPM']

export default function Capacidades() {
  const { datos, error, recargar } = useLista<Capacidad>('/capacidades')
  const { datos: personas } = useLista<Persona>('/personas')
  const { tienePermiso } = useAuth()
  const puedeEditarCapacidades = tienePermiso('capacidades.editar')

  const [modalAbierto, setModalAbierto] = useState(false)
  const [personaId, setPersonaId] = useState('')
  const [mes, setMes] = useState('')
  const [horas, setHoras] = useState('180')
  const [aviso, setAviso] = useState('')

  const [editCell, setEditCell] = useState<{ id: string; campo: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const cancelarBlurRef = useRef(false)

  const personasPorId = useMemo(() => {
    const map = new Map<string, Persona>()
    for (const persona of personas) map.set(persona.id, persona)
    return map
  }, [personas])

  const personasDisponibles = useMemo(
    () => personas
      .filter((p) => p.rol_operativo && !ROLES_EXCLUIDOS_CAPACIDAD_PERSONA.includes(p.rol_operativo))
      .slice()
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [personas],
  )

  const capacidadesPersona = useMemo(
    () => datos.filter((capacidad) => {
      if (capacidad.scope !== 'persona' || !capacidad.persona_id) return false
      const persona = personasPorId.get(capacidad.persona_id)
      return Boolean(persona && !ROLES_EXCLUIDOS_CAPACIDAD_PERSONA.includes(persona.rol_operativo))
    }),
    [datos, personasPorId],
  )

  const { aniosParaPestanas, anioSeleccionado, seleccionarAnio, filas } =
    useMatrizCapacidades(capacidadesPersona, personasPorId)

  function abrirModalNueva() {
    if (!puedeEditarCapacidades) return
    setPersonaId('')
    setMes('')
    setHoras('180')
    setAviso('')
    setModalAbierto(true)
  }

  function abrirModalCeldaVacia(idPersona: string, mesCelda: string) {
    if (!puedeEditarCapacidades) return
    setPersonaId(idPersona)
    setMes(mesCelda)
    setHoras('180')
    setAviso('')
    setModalAbierto(true)
  }

  function cerrarModal() {
    setModalAbierto(false)
    setAviso('')
  }

  function iniciarEdicion(capacidad: Capacidad) {
    if (!puedeEditarCapacidades) return
    setEditCell({ id: capacidad.id, campo: 'horas_disponibles' })
    setEditValue(String(capacidad.horas_disponibles))
    cancelarBlurRef.current = false
  }

  function cancelarEdicion() {
    cancelarBlurRef.current = true
    setEditCell(null)
    setEditValue('')
  }

  async function guardarEdicion(capacidad: Capacidad) {
    if (!puedeEditarCapacidades) return
    if (!editCell) return
    try {
      const payload = {
        scope: 'persona',
        persona_id: capacidad.persona_id,
        mes: capacidad.mes,
        horas_disponibles: Number(editValue),
      }
      await client.put(`/capacidades/${capacidad.id}`, payload)
      setEditCell(null)
      setEditValue('')
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  async function crear(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (!puedeEditarCapacidades) return
    setAviso('')
    try {
      await client.post('/capacidades', {
        scope: 'persona',
        persona_id: personaId,
        mes,
        horas_disponibles: Number(horas),
      })
      cerrarModal()
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  async function eliminar(capacidad: Capacidad): Promise<void> {
    if (!puedeEditarCapacidades) return
    if (editCell?.id === capacidad.id) {
      cancelarBlurRef.current = true
      setEditCell(null)
      setEditValue('')
    }
    await client.delete(`/capacidades/${capacidad.id}`)
    recargar()
  }

  return (
    <div>
      <EncabezadoPagina
        icono={<Icono nombre="grafico-barras" />}
        titulo="Capacidades mensuales"
        acciones={puedeEditarCapacidades && (
          <Boton variante="primario" onClick={abrirModalNueva}>Nueva capacidad</Boton>
        )}
      />

      {(aviso || error) && !modalAbierto && (
        <div className="aviso aviso-error mb-3">{aviso || error}</div>
      )}

      <div className="pestanas mb-4">
        {aniosParaPestanas.map((anio) => (
          <button
            key={anio}
            onClick={() => seleccionarAnio(anio)}
            className={`pestana ${anio === anioSeleccionado ? 'pestana-activa' : ''}`}
          >
            {anio}
          </button>
        ))}
      </div>

      <TablaCapacidadesMatriz
        filas={filas}
        anioSeleccionado={anioSeleccionado}
        puedeEditarCapacidades={puedeEditarCapacidades}
        editCell={editCell}
        editValue={editValue}
        onCambiarEditValue={setEditValue}
        onIniciarEdicion={iniciarEdicion}
        onGuardarEdicion={guardarEdicion}
        onCancelarEdicion={cancelarEdicion}
        onEliminar={eliminar}
        cancelarBlurRef={cancelarBlurRef}
        onAbrirCeldaVacia={abrirModalCeldaVacia}
      />

      <ModalCapacidad
        abierto={modalAbierto}
        onCerrar={cerrarModal}
        personasDisponibles={personasDisponibles}
        personaId={personaId}
        onCambiarPersonaId={setPersonaId}
        mes={mes}
        onCambiarMes={setMes}
        horas={horas}
        onCambiarHoras={setHoras}
        aviso={aviso}
        onSubmit={crear}
      />
    </div>
  )
}
