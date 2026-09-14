import { useMemo, useState } from 'react'
import client, { APP_KEY } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import type { EndpointCatalogo } from '../../types'
import {
  construirCurl,
  construirUrlConPath,
  esMultipart,
  generarEjemploCuerpo,
  pathParamsDeRuta,
} from './invocacion'
import type { ResultadoInvocacion } from './invocacion'

type MetodoAxios = 'get' | 'post' | 'put' | 'patch' | 'delete'

/**
 * Estado y ejecución de la prueba en vivo de un endpoint del catálogo (F4.6/F4.7,
 * ADR-0008). La llamada real sale del mismo `client` (axios) que ya inyecta el JWT
 * y `X-Aplicacion`; no hay proxy en el backend (decidido en el ADR-0007/0008).
 */
export function useProbadorEndpoint(endpoint: EndpointCatalogo) {
  const { tienePermiso } = useAuth()
  const puedeProbar = tienePermiso('admin.endpoints.probar')

  const nombresPath = useMemo(() => pathParamsDeRuta(endpoint.ruta), [endpoint.ruta])
  const parametrosQuery = useMemo(
    () => endpoint.parametros.filter((p) => p.in === 'query'),
    [endpoint.parametros],
  )
  const parametrosHeader = useMemo(
    () => endpoint.parametros.filter((p) => p.in === 'header'),
    [endpoint.parametros],
  )
  const multipart = useMemo(() => esMultipart(endpoint.esquema_de_cuerpo), [endpoint.esquema_de_cuerpo])
  const requiereCuerpo = !!endpoint.esquema_de_cuerpo && !multipart

  const [valoresPath, setValoresPath] = useState<Record<string, string>>({})
  const [valoresQuery, setValoresQuery] = useState<Record<string, string>>({})
  const [valoresHeader, setValoresHeader] = useState<Record<string, string>>({})
  const [cuerpoTexto, setCuerpoTexto] = useState(() =>
    requiereCuerpo ? generarEjemploCuerpo(endpoint.esquema_de_cuerpo) : '',
  )
  const [errorCuerpo, setErrorCuerpo] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const [rutaConfirmacion, setRutaConfirmacion] = useState('')
  const [ejecutando, setEjecutando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoInvocacion | null>(null)

  function actualizarPath(nombre: string, valor: string): void {
    setValoresPath((v) => ({ ...v, [nombre]: valor }))
  }
  function actualizarQuery(nombre: string, valor: string): void {
    setValoresQuery((v) => ({ ...v, [nombre]: valor }))
  }
  function actualizarHeader(nombre: string, valor: string): void {
    setValoresHeader((v) => ({ ...v, [nombre]: valor }))
  }

  const urlSinPrefijo = useMemo(
    () => construirUrlConPath(endpoint.ruta, valoresPath).replace(/^\/api/, ''),
    [endpoint.ruta, valoresPath],
  )

  const requiereConfirmacion = endpoint.riesgo !== 'seguro'
  const confirmacionValida =
    endpoint.riesgo !== 'destructivo' || rutaConfirmacion.trim() === endpoint.ruta
  const puedeEjecutar = puedeProbar && !multipart && !ejecutando

  const queryLimpia = useMemo(
    () => Object.fromEntries(Object.entries(valoresQuery).filter(([, v]) => v.trim() !== '')),
    [valoresQuery],
  )
  const headerLimpio = useMemo(
    () => Object.fromEntries(Object.entries(valoresHeader).filter(([, v]) => v.trim() !== '')),
    [valoresHeader],
  )

  const curl = useMemo(() => {
    const aplicacionActiva = localStorage.getItem(APP_KEY)
    const headers: Record<string, string> = { Authorization: 'Bearer $TOKEN', ...headerLimpio }
    if (aplicacionActiva && !headers['X-Aplicacion']) headers['X-Aplicacion'] = aplicacionActiva
    const query = new URLSearchParams(queryLimpia).toString()
    const urlAbsoluta = `${window.location.origin}${import.meta.env.BASE_URL}api${urlSinPrefijo}${query ? `?${query}` : ''}`
    return construirCurl({
      metodo: endpoint.metodo,
      urlCompleta: urlAbsoluta,
      headers,
      cuerpo: requiereCuerpo && cuerpoTexto.trim() ? cuerpoTexto : undefined,
    })
  }, [endpoint.metodo, urlSinPrefijo, queryLimpia, headerLimpio, requiereCuerpo, cuerpoTexto])

  /** Ejecuta la llamada real. Solo se invoca tras pasar la compuerta de riesgo (F4.7). */
  async function ejecutar(): Promise<void> {
    let cuerpo: unknown
    if (requiereCuerpo && cuerpoTexto.trim()) {
      try {
        cuerpo = JSON.parse(cuerpoTexto)
        setErrorCuerpo('')
      } catch {
        setErrorCuerpo('El cuerpo no es JSON válido.')
        return
      }
    }
    setEjecutando(true)
    setConfirmando(false)
    const inicio = performance.now()
    const metodo = endpoint.metodo.toLowerCase() as MetodoAxios
    const config = { params: queryLimpia, headers: headerLimpio }
    try {
      const respuesta =
        metodo === 'get' || metodo === 'delete'
          ? await client[metodo](urlSinPrefijo, config)
          : await client[metodo](urlSinPrefijo, cuerpo, config)
      setResultado({
        estadoHttp: respuesta.status,
        estadoTexto: respuesta.statusText,
        latenciaMs: Math.round(performance.now() - inicio),
        cuerpo: respuesta.data,
        esError: false,
      })
    } catch (err) {
      const axiosErr = err as { response?: { status: number; statusText: string; data: unknown }; message?: string }
      if (axiosErr.response) {
        setResultado({
          estadoHttp: axiosErr.response.status,
          estadoTexto: axiosErr.response.statusText,
          latenciaMs: Math.round(performance.now() - inicio),
          cuerpo: axiosErr.response.data,
          esError: true,
        })
      } else {
        setResultado({
          estadoHttp: null,
          estadoTexto: 'Error de red',
          latenciaMs: Math.round(performance.now() - inicio),
          cuerpo: axiosErr.message ?? 'No fue posible contactar al servidor.',
          esError: true,
        })
      }
    } finally {
      setEjecutando(false)
    }
  }

  /** Punto de entrada del botón "Ejecutar": aplica la compuerta de riesgo (F4.7). */
  function intentarEjecutar(): void {
    if (!puedeEjecutar) return
    if (requiereConfirmacion) {
      setRutaConfirmacion('')
      setConfirmando(true)
      return
    }
    void ejecutar()
  }

  function confirmar(): void {
    if (!confirmacionValida) return
    void ejecutar()
  }

  function cancelarConfirmacion(): void {
    setConfirmando(false)
    setRutaConfirmacion('')
  }

  return {
    puedeProbar,
    nombresPath,
    parametrosQuery,
    parametrosHeader,
    multipart,
    requiereCuerpo,
    valoresPath,
    actualizarPath,
    valoresQuery,
    actualizarQuery,
    valoresHeader,
    actualizarHeader,
    cuerpoTexto,
    setCuerpoTexto,
    errorCuerpo,
    confirmando,
    rutaConfirmacion,
    setRutaConfirmacion,
    confirmacionValida,
    requiereConfirmacion,
    ejecutando,
    puedeEjecutar,
    resultado,
    curl,
    intentarEjecutar,
    confirmar,
    cancelarConfirmacion,
  }
}

export type EstadoProbadorEndpoint = ReturnType<typeof useProbadorEndpoint>
