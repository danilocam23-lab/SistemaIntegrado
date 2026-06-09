import { useCallback, useEffect, useState } from 'react'
import client from './client'
import { ESTADOS_ENTREGA, ESTADOS_REQUERIMIENTO } from '../constantes'

/** Carga una lista desde la API y la mantiene refrescable. */
export function useLista<T>(endpoint: string) {
  const [datos, setDatos] = useState<T[]>([])
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)

  const recargar = useCallback(() => {
    setCargando(true)
    client
      .get<T[]>(endpoint)
      .then((r) => {
        setDatos(r.data)
        setError('')
      })
      .catch(() => setError('No fue posible cargar los datos'))
      .finally(() => setCargando(false))
  }, [endpoint])

  useEffect(() => {
    recargar()
  }, [recargar])

  return { datos, error, cargando, recargar }
}

/** Extrae el mensaje `detail` de un error de Axios. */
export function mensajeError(err: unknown): string {
  const data = (err as { response?: { data?: { detail?: unknown } } })?.response?.data
  const detalle = data?.detail
  if (typeof detalle === 'string') return detalle
  // Pydantic validation errors return detail as an array of objects
  if (Array.isArray(detalle) && detalle.length > 0) {
    const primero = detalle[0] as { msg?: string; loc?: string[] }
    const campo = primero.loc ? primero.loc.filter((l) => l !== 'body').join('.') : ''
    return campo ? `${campo}: ${primero.msg ?? 'Error de validación'}` : (primero.msg ?? 'Error de validación')
  }
  return 'Ocurrió un error'
}

/** Carga los estados de requerimiento y entrega desde la configuración. */
export function useEstados() {
  const [estadosReq, setEstadosReq] = useState<string[]>(ESTADOS_REQUERIMIENTO)
  const [estadosEnt, setEstadosEnt] = useState<string[]>(ESTADOS_ENTREGA)

  const recargar = useCallback(() => {
    client
      .get<{ clave: string; valor: string }[]>('/configuracion')
      .then((r) => {
        const req = r.data.find((c) => c.clave === 'estados_requerimiento')
        const ent = r.data.find((c) => c.clave === 'estados_entrega')
        if (req?.valor) setEstadosReq(req.valor.split(',').map((s) => s.trim()).filter(Boolean))
        if (ent?.valor) setEstadosEnt(ent.valor.split(',').map((s) => s.trim()).filter(Boolean))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    recargar()
  }, [recargar])

  return { estadosReq, estadosEnt, recargar }
}
