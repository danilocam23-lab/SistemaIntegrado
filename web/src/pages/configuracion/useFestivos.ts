import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import client from '../../api/client'
import { mensajeError, useLista } from '../../api/hooks'
import type { Festivo } from '../../types'

interface Params {
  setAviso: (aviso: string) => void
  setOk: (ok: string) => void
}

export function useFestivos({ setAviso, setOk }: Params) {
  const { datos: festivos, recargar: recargarFestivos } = useLista<Festivo>('/festivos')
  const [festFecha, setFestFecha] = useState('')

  async function crearFestivo(e: FormEvent): Promise<void> {
    e.preventDefault()
    setAviso('')
    setOk('')
    try {
      // INVARIANTE 15: configuracion global; no introducir cabecerasAplicacion.
      await client.post('/festivos', {
        fecha: festFecha,
      })
      setFestFecha('')
      recargarFestivos()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  async function eliminarFestivo(f: Festivo): Promise<void> {
    // INVARIANTE 12: eliminarFestivo sin try/catch; copiar tal cual.
    await client.delete(`/festivos/${f.id}`)
    recargarFestivos()
  }

  const festivosAgrupados = useMemo(() => {
    // INVARIANTE 7: festivosAgrupados es el unico useMemo original y solo depende de festivos.
    const grupos = new Map<string, Festivo[]>()
    for (const festivo of festivos) {
      const fecha = (festivo.fecha ?? '').slice(0, 10)
      const clave = fecha ? fecha.slice(0, 7) : 'sin-fecha'
      if (!grupos.has(clave)) grupos.set(clave, [])
      grupos.get(clave)?.push(festivo)
    }

    return Array.from(grupos.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([clave, items]) => {
        const [anio, mes] = clave.split('-')
        const fechaMes = anio && mes ? new Date(Number(anio), Number(mes) - 1, 1) : null
        const tituloBase = fechaMes
          ? fechaMes.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
          : 'Sin fecha'
        const titulo = tituloBase.charAt(0).toUpperCase() + tituloBase.slice(1)
        return {
          clave,
          titulo,
          items: items.slice().sort((a, b) => a.fecha.localeCompare(b.fecha)),
        }
      })
  }, [festivos])

  return {
    festivos,
    festFecha,
    setFestFecha,
    festivosAgrupados,
    crearFestivo,
    eliminarFestivo,
  }
}

export type FestivosState = ReturnType<typeof useFestivos>
