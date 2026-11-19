// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useState } from 'react'
import type { FormEvent } from 'react'
import client from '../../api/client'
import { mensajeError } from '../../api/hooks'
import type { Configuracion as Config } from '../../types'

// Claves de configuracion que se administran en otra pestana (fuente de verdad unica).
// Se ocultan en Parametros y el hook no actua sobre ellas. NO borrar el registro: lo lee /personas/roles.
export const CLAVES_GESTIONADAS: string[] = [
  'roles_persona',
  'tipos_contratacion',
  'estados_requerimiento',
  'estados_entrega',
]

const PESTANA_DE: Record<string, string> = {
  roles_persona: 'Roles',
  tipos_contratacion: 'Tipo de contratación',
  estados_requerimiento: 'Estados',
  estados_entrega: 'Estados',
}

export const esGestionada = (clave: string): boolean => CLAVES_GESTIONADAS.includes(clave.trim())

const avisoGestionada = (clave: string): string =>
  `${clave.trim()} se administra en la pestaña ${PESTANA_DE[clave.trim()] ?? 'correspondiente'}.`

interface Params {
  recargar: () => void
  setAviso: (aviso: string) => void
  setOk: (ok: string) => void
}

export function useParametros({ recargar, setAviso, setOk }: Params) {
  const [valores, setValores] = useState<Record<string, string>>({})
  const [nuevaClave, setNuevaClave] = useState('')
  const [nuevoValor, setNuevoValor] = useState('')
  const [grupo, setGrupo] = useState('general')

  // Popup edicion
  const [editItem, setEditItem] = useState<Config | null>(null)
  const [editClave, setEditClave] = useState('')
  const [editGrupo, setEditGrupo] = useState('')
  const [editValor, setEditValor] = useState('')

  const valorDe = (c: Config): string =>
    // INVARIANTE 10: valores no se limpia con recargar(); una celda editada gana hasta desmontar.
    valores[c.clave] !== undefined ? valores[c.clave] : c.valor

  function abrirEdicion(c: Config) {
    setEditItem(c)
    setEditClave(c.clave)
    setEditGrupo(c.grupo)
    // INVARIANTE 10: el modal precarga con el valor sucio si existe.
    setEditValor(valorDe(c))
  }

  async function guardarEdicion(): Promise<void> {
    if (!editItem) return
    setAviso('')
    setOk('')
    const gestionada = [editItem.clave, editClave].find(esGestionada)
    if (gestionada) {
      setAviso(avisoGestionada(gestionada))
      return
    }
    try {
      // INVARIANTE 11: no corregir bug latente; el modal permite renombrar la clave.
      // INVARIANTE 15: configuracion global; no introducir cabecerasAplicacion.
      await client.put(`/configuracion/${encodeURIComponent(editClave)}`, {
        valor: editValor,
        grupo: editGrupo,
      })
      setOk(`"${editClave}" guardado.`)
      setEditItem(null)
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  async function guardar(c: Config): Promise<void> {
    setAviso('')
    setOk('')
    if (esGestionada(c.clave)) {
      setAviso(avisoGestionada(c.clave))
      return
    }
    try {
      // INVARIANTE 15: configuracion global; no introducir cabecerasAplicacion.
      await client.put(`/configuracion/${encodeURIComponent(c.clave)}`, {
        valor: valorDe(c),
        grupo: c.grupo,
      })
      setOk(`"${c.clave}" guardado.`)
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  async function crear(e: FormEvent): Promise<void> {
    e.preventDefault()
    setAviso('')
    setOk('')
    if (esGestionada(nuevaClave)) {
      setAviso(avisoGestionada(nuevaClave))
      return
    }
    try {
      // INVARIANTE 15: configuracion global; no introducir cabecerasAplicacion.
      await client.put(`/configuracion/${encodeURIComponent(nuevaClave)}`, {
        valor: nuevoValor,
        grupo,
      })
      setNuevaClave('')
      setNuevoValor('')
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  async function eliminarParametro(c: Config): Promise<void> {
    setAviso('')
    setOk('')
    if (esGestionada(c.clave)) {
      setAviso(avisoGestionada(c.clave))
      return
    }
    try {
      // INVARIANTE 15: configuracion global; no introducir cabecerasAplicacion.
      await client.delete(`/configuracion/${encodeURIComponent(c.clave)}`)
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  return {
    valores,
    setValores,
    nuevaClave,
    setNuevaClave,
    nuevoValor,
    setNuevoValor,
    grupo,
    setGrupo,
    editItem,
    setEditItem,
    editClave,
    setEditClave,
    editGrupo,
    setEditGrupo,
    editValor,
    setEditValor,
    valorDe,
    abrirEdicion,
    guardarEdicion,
    guardar,
    crear,
    eliminarParametro,
  }
}

export type ParametrosState = ReturnType<typeof useParametros>
