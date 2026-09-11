import { useState } from 'react'
import type { FormEvent } from 'react'
import client from '../../api/client'
import { mensajeError, useLista } from '../../api/hooks'
import type { Tarifa } from '../../types'

// INVARIANTE 14: RAMIFICACIONES vive en scope de modulo; solo se lee.
export const RAMIFICACIONES = ['Fábrica', 'Soporte']

export function useTarifas() {
  const { datos: tarifas, recargar: recargarTarifas } = useLista<Tarifa>('/tarifas')
  const [tAnio, setTAnio] = useState(String(new Date().getFullYear()))
  const [tValorHora, setTValorHora] = useState('')
  const [tRamificacion, setTRamificacion] = useState(RAMIFICACIONES[0])
  const [tAviso, setTAviso] = useState('')
  const [tEditItem, setTEditItem] = useState<Tarifa | null>(null)
  const [tEditAnio, setTEditAnio] = useState('')
  const [tEditValorHora, setTEditValorHora] = useState('')
  const [tEditRamificacion, setTEditRamificacion] = useState('')
  // INVARIANTE 5: Tarifas usa aviso propio y no toca el aviso compartido del shell.

  function abrirEdicionTarifa(t: Tarifa) {
    setTEditItem(t)
    setTEditAnio(String(t.anio))
    setTEditValorHora(String(t.valor_hora))
    setTEditRamificacion(t.ramificacion ?? RAMIFICACIONES[0])
  }

  async function guardarPopupTarifa(): Promise<void> {
    if (!tEditItem) return
    setTAviso('')
    try {
      // INVARIANTE 15: configuracion global; no introducir cabecerasAplicacion.
      await client.put(`/tarifas/${tEditItem.id}`, {
        anio: Number(tEditAnio),
        valor_hora: Number(tEditValorHora),
        ramificacion: tEditRamificacion,
      })
      setTEditItem(null)
      recargarTarifas()
    } catch (err) {
      setTAviso(mensajeError(err))
    }
  }

  async function crearTarifa(e: FormEvent): Promise<void> {
    e.preventDefault()
    setTAviso('')
    try {
      // INVARIANTE 15: configuracion global; no introducir cabecerasAplicacion.
      await client.post('/tarifas', {
        anio: Number(tAnio),
        valor_hora: Number(tValorHora),
        ramificacion: tRamificacion,
      })
      // INVARIANTE 16: crearTarifa limpia solo el valor/hora, no anio ni ramificacion.
      setTValorHora('')
      recargarTarifas()
    } catch (err) {
      setTAviso(mensajeError(err))
    }
  }

  async function eliminarTarifa(t: Tarifa): Promise<void> {
    // INVARIANTE 12: eliminarTarifa se conserva sin try/catch.
    await client.delete(`/tarifas/${t.id}`)
    recargarTarifas()
  }

  return {
    tarifas,
    tAnio,
    setTAnio,
    tValorHora,
    setTValorHora,
    tRamificacion,
    setTRamificacion,
    tAviso,
    tEditItem,
    setTEditItem,
    tEditAnio,
    setTEditAnio,
    tEditValorHora,
    setTEditValorHora,
    tEditRamificacion,
    setTEditRamificacion,
    abrirEdicionTarifa,
    guardarPopupTarifa,
    crearTarifa,
    eliminarTarifa,
  }
}

export type TarifasState = ReturnType<typeof useTarifas>
