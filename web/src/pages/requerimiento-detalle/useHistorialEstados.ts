import { useCallback, useState } from 'react'
import client from '../../api/client'
import { mensajeError } from '../../api/hooks'

export interface SegmentoHistorial {
  estado: string | null
  desde: string | null
  hasta: string | null
  duracion_segundos: number | null
  en_curso: boolean
}

/**
 * Historial de estados (popup con cuánto tiempo estuvo en cada estado y a
 * cuál pasó) tanto del requerimiento como de una entrega puntual.
 */
export function useHistorialEstados(reqId: string | undefined) {
  const [abierto, setAbierto] = useState<'req' | 'entrega' | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [segmentos, setSegmentos] = useState<SegmentoHistorial[]>([])
  const [titulo, setTitulo] = useState('')

  const verHistorialRequerimiento = useCallback(async (): Promise<void> => {
    setAbierto('req')
    setTitulo('Historial de estados del requerimiento')
    setCargando(true)
    setError('')
    try {
      const { data } = await client.get<{ segmentos: SegmentoHistorial[] }>(
        `/requerimientos/${reqId}/historial-estados`,
      )
      setSegmentos(data.segmentos)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setCargando(false)
    }
  }, [reqId])

  const verHistorialEntrega = useCallback(async (numero: number | string): Promise<void> => {
    if (!numero) return
    setAbierto('entrega')
    setTitulo(`Historial de estados de la entrega N° ${numero}`)
    setCargando(true)
    setError('')
    try {
      const { data } = await client.get<{ segmentos: SegmentoHistorial[] }>(
        `/requerimientos/${reqId}/entregas/${numero}/historial-estados`,
      )
      setSegmentos(data.segmentos)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setCargando(false)
    }
  }, [reqId])

  const cerrar = useCallback(() => setAbierto(null), [])

  return {
    abierto: abierto !== null,
    titulo,
    cargando,
    error,
    segmentos,
    verHistorialRequerimiento,
    verHistorialEntrega,
    cerrar,
  }
}
