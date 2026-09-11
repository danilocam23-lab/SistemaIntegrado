import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import client from '../../api/client'
import { mensajeError } from '../../api/hooks'
import type { Configuracion as Config } from '../../types'
import type { UltimaSincronizacionResumen } from './tipos'

const CLAVE_RUTA_CARGA_SOLICITUDES_FABRICA = 'soporte.solicitudes_fabrica.ruta_carga_local'

interface Params {
  datos: Config[]
  recargar: () => void
}

export function useCargaExcel({ datos, recargar }: Params) {
  const [rutaCargaExcel, setRutaCargaExcel] = useState('')
  const [rutaCargaExcelAviso, setRutaCargaExcelAviso] = useState('')
  const [rutaCargaExcelOk, setRutaCargaExcelOk] = useState('')
  const [probandoCargaExcel, setProbandoCargaExcel] = useState(false)
  const [resultadoPruebaCargaExcel, setResultadoPruebaCargaExcel] = useState('')
  const [ultimaEjecucionAuto, setUltimaEjecucionAuto] = useState<UltimaSincronizacionResumen | null>(null)
  const [cargandoUltimaEjecucion, setCargandoUltimaEjecucion] = useState(false)
  // INVARIANTE 5: CargaExcel usa aviso propio y no toca el aviso compartido del shell.

  useEffect(() => {
    // INVARIANTE 3: recargar() reinicia estado derivado de otras pestanas; se conserva.
    const cfg = datos.find((d) => d.clave === CLAVE_RUTA_CARGA_SOLICITUDES_FABRICA)
    setRutaCargaExcel(cfg?.valor ?? '')
  }, [datos])

  async function consultarUltimaEjecucionAuto(): Promise<void> {
    setCargandoUltimaEjecucion(true)
    try {
      const { data } = await client.get<UltimaSincronizacionResumen | null>(
        '/soporte/solicitudes-fabrica/ultima-sincronizacion',
      )
      setUltimaEjecucionAuto(data)
    } catch {
      // INVARIANTE 9: catch silencioso deliberado; sin polling ni manejo de error nuevo.
    } finally {
      setCargandoUltimaEjecucion(false)
    }
  }

  useEffect(() => {
    // INVARIANTE 9: ultima ejecucion no hace polling; solo consulta al montar y tras Probar ahora.
    void consultarUltimaEjecucionAuto()
  }, [])

  async function guardarRutaCargaExcel(e: FormEvent): Promise<void> {
    e.preventDefault()
    setRutaCargaExcelAviso('')
    setRutaCargaExcelOk('')
    try {
      // INVARIANTE 15: configuracion global; no introducir cabecerasAplicacion.
      await client.put(`/configuracion/${encodeURIComponent(CLAVE_RUTA_CARGA_SOLICITUDES_FABRICA)}`, {
        valor: rutaCargaExcel.trim(),
        grupo: 'soporte_solicitudes_fabrica',
      })
      setRutaCargaExcelOk('Ruta guardada.')
      recargar()
    } catch (err) {
      setRutaCargaExcelAviso(mensajeError(err))
    }
  }

  async function probarCargaAutomatica(): Promise<void> {
    setProbandoCargaExcel(true)
    setResultadoPruebaCargaExcel('')
    try {
      const { data } = await client.post('/soporte/solicitudes-fabrica/ejecutar-carga-automatica')
      if (!data.ejecutado) {
        setResultadoPruebaCargaExcel(`⚠️ ${data.mensaje}`)
      } else {
        setResultadoPruebaCargaExcel(
          `✅ Archivo "${data.archivo}" procesado: ${data.total_encontrados} filas encontradas, ` +
            `${data.cargados} cargadas, ${data.con_error} con error.`
        )
      }
    } catch (err) {
      setResultadoPruebaCargaExcel(`❌ ${mensajeError(err)}`)
    } finally {
      setProbandoCargaExcel(false)
      // INVARIANTE 9: la tarjeta se refresca en el finally de Probar ahora.
      void consultarUltimaEjecucionAuto()
    }
  }

  return {
    rutaCargaExcel,
    setRutaCargaExcel,
    rutaCargaExcelAviso,
    rutaCargaExcelOk,
    probandoCargaExcel,
    resultadoPruebaCargaExcel,
    ultimaEjecucionAuto,
    cargandoUltimaEjecucion,
    consultarUltimaEjecucionAuto,
    guardarRutaCargaExcel,
    probarCargaAutomatica,
  }
}

export type CargaExcelState = ReturnType<typeof useCargaExcel>
