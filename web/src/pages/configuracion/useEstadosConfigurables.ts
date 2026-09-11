import { useEffect, useState } from 'react'
import client from '../../api/client'
import { mensajeError } from '../../api/hooks'
import { ESTADOS_ENTREGA, ESTADOS_REQUERIMIENTO } from '../../constantes'
import type { Configuracion as Config } from '../../types'

interface Params {
  datos: Config[]
  recargar: () => void
}

export function useEstadosConfigurables({ datos, recargar }: Params) {
  const [estReq, setEstReq] = useState<string[]>(ESTADOS_REQUERIMIENTO)
  const [estEnt, setEstEnt] = useState<string[]>(ESTADOS_ENTREGA)
  const [nuevoEstReq, setNuevoEstReq] = useState('')
  const [nuevoEstEnt, setNuevoEstEnt] = useState('')
  const [estAviso, setEstAviso] = useState('')
  const [estOk, setEstOk] = useState('')
  // INVARIANTE 5: Estados usa aviso propio y no toca el aviso compartido del shell.

  useEffect(() => {
    // INVARIANTE 3: recargar() reinicia estado derivado de otras pestanas; se conserva.
    datos.forEach((c) => {
      if (c.clave === 'estados_requerimiento' && c.valor)
        setEstReq(c.valor.split(',').map((s) => s.trim()).filter(Boolean))
      if (c.clave === 'estados_entrega' && c.valor)
        setEstEnt(c.valor.split(',').map((s) => s.trim()).filter(Boolean))
    })
  }, [datos])

  async function guardarEstados(clave: string, lista: string[]): Promise<void> {
    setEstAviso('')
    setEstOk('')
    try {
      // INVARIANTE 15: configuracion global; no introducir cabecerasAplicacion.
      await client.put(`/configuracion/${encodeURIComponent(clave)}`, {
        valor: lista.join(','),
        grupo: 'estados',
      })
      setEstOk('Estados guardados.')
      recargar()
    } catch (err) {
      setEstAviso(mensajeError(err))
    }
  }

  function agregarEstadoReq(): void {
    const e = nuevoEstReq.trim().toUpperCase()
    if (!e || estReq.includes(e)) return
    const nueva = [...estReq, e]
    setNuevoEstReq('')
    setEstReq(nueva)
    void guardarEstados('estados_requerimiento', nueva)
  }

  function quitarEstadoReq(estado: string): void {
    const nueva = estReq.filter((e) => e !== estado)
    setEstReq(nueva)
    void guardarEstados('estados_requerimiento', nueva)
  }

  function agregarEstadoEnt(): void {
    const e = nuevoEstEnt.trim().toUpperCase()
    if (!e || estEnt.includes(e)) return
    const nueva = [...estEnt, e]
    setNuevoEstEnt('')
    setEstEnt(nueva)
    void guardarEstados('estados_entrega', nueva)
  }

  function quitarEstadoEnt(estado: string): void {
    const nueva = estEnt.filter((e) => e !== estado)
    setEstEnt(nueva)
    void guardarEstados('estados_entrega', nueva)
  }

  return {
    estReq,
    estEnt,
    nuevoEstReq,
    setNuevoEstReq,
    nuevoEstEnt,
    setNuevoEstEnt,
    estAviso,
    estOk,
    agregarEstadoReq,
    quitarEstadoReq,
    agregarEstadoEnt,
    quitarEstadoEnt,
  }
}

export type EstadosConfigurablesState = ReturnType<typeof useEstadosConfigurables>
