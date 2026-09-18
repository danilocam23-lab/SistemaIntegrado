// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useCallback, useEffect, useRef, useState } from 'react'
import client from '../../api/client'
import { mensajeError } from '../../api/hooks'
import { Aviso, Boton, Icono, Tarjeta } from '../../components/ui'
import { fmtFechaCo } from '../../utilidades/fechas'
import type { RespuestaEstadoSyncEsquemaAzure, RespuestaSyncEsquemaAzure } from '../../types'

const INTERVALO_SONDEO_MS = 3000
const MAX_FALLOS_SONDEO = 3

interface Props {
  target: string
  proyecto: string
  usuarioId: string
  puedeEditar: boolean
  ultimaSync: string | null
  onSincronizado: () => void
}

function parametros(target: string, proyecto: string, usuarioId: string): URLSearchParams {
  const params = new URLSearchParams()
  params.set('target', target)
  if (proyecto.trim()) params.set('proyecto', proyecto.trim())
  if (usuarioId) params.set('usuario_id', usuarioId)
  return params
}

export function ZonaSincronizacion({
  target,
  proyecto,
  usuarioId,
  puedeEditar,
  ultimaSync,
  onSincronizado,
}: Props) {
  const [estado, setEstado] = useState<RespuestaEstadoSyncEsquemaAzure | null>(null)
  const [iniciando, setIniciando] = useState(false)
  const [errorSync, setErrorSync] = useState('')

  const sondeoRef = useRef<number | null>(null)
  const enVueloRef = useRef(false)
  const fallosRef = useRef(0)
  const montadoRef = useRef(true)
  const estadoAnteriorRef = useRef<RespuestaEstadoSyncEsquemaAzure['estado'] | null>(null)
  const onSincronizadoRef = useRef(onSincronizado)

  useEffect(() => {
    onSincronizadoRef.current = onSincronizado
  })

  const detenerSondeo = useCallback(() => {
    if (sondeoRef.current !== null) {
      window.clearInterval(sondeoRef.current)
      sondeoRef.current = null
    }
  }, [])

  const consultarEstado = useCallback(async () => {
    // Evita solapar peticiones si una respuesta tarda más que el intervalo.
    if (enVueloRef.current) return
    enVueloRef.current = true
    try {
      const { data } = await client.get<RespuestaEstadoSyncEsquemaAzure>(
        `/azdo/esquema/sync/estado?${parametros(target, proyecto, usuarioId).toString()}`,
      )
      if (!montadoRef.current) return
      fallosRef.current = 0
      const anterior = estadoAnteriorRef.current
      estadoAnteriorRef.current = data.estado
      setEstado(data)
      if (data.estado !== 'en_curso') {
        detenerSondeo()
        if (data.estado === 'success' && anterior === 'en_curso') {
          onSincronizadoRef.current()
        }
      }
    } catch {
      if (!montadoRef.current) return
      // El endpoint aún puede no existir (404 en despliegue): corta el sondeo tras
      // varios fallos seguidos para no golpear el servidor indefinidamente.
      fallosRef.current += 1
      if (fallosRef.current >= MAX_FALLOS_SONDEO) detenerSondeo()
    } finally {
      enVueloRef.current = false
    }
  }, [target, proyecto, usuarioId, detenerSondeo])

  const iniciarSondeo = useCallback(() => {
    if (sondeoRef.current !== null) return
    sondeoRef.current = window.setInterval(() => {
      void consultarEstado()
    }, INTERVALO_SONDEO_MS)
  }, [consultarEstado])

  useEffect(() => {
    montadoRef.current = true
    fallosRef.current = 0
    estadoAnteriorRef.current = null
    setEstado(null)
    setErrorSync('')
    void (async () => {
      await consultarEstado()
      if (montadoRef.current && estadoAnteriorRef.current === 'en_curso') iniciarSondeo()
    })()
    return () => {
      montadoRef.current = false
      detenerSondeo()
    }
  }, [consultarEstado, iniciarSondeo, detenerSondeo])

  const sincronizar = useCallback(async () => {
    setIniciando(true)
    setErrorSync('')
    try {
      const { data } = await client.post<RespuestaSyncEsquemaAzure>(
        `/azdo/esquema/sync?${parametros(target, proyecto, usuarioId).toString()}`,
      )
      if (!montadoRef.current) return
      estadoAnteriorRef.current = 'en_curso'
      fallosRef.current = 0
      setEstado({
        estado: 'en_curso',
        proyecto: data.proyecto,
        work_items: 0,
        particiones_completadas: 0,
        particiones_totales: 0,
        iniciado_en: data.iniciado_en,
        finalizado_en: null,
        error: null,
      })
      iniciarSondeo()
    } catch (error) {
      if (montadoRef.current) setErrorSync(mensajeError(error))
    } finally {
      if (montadoRef.current) setIniciando(false)
    }
  }, [target, proyecto, usuarioId, iniciarSondeo])

  const estadoActual = estado?.estado ?? 'nunca'
  const enCurso = estadoActual === 'en_curso'
  const ultima = estado?.finalizado_en ?? ultimaSync

  return (
    <Tarjeta className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="text-2xs font-bold uppercase tracking-wider text-slate-500">
            Sincronización del espejo
          </div>
          {enCurso ? (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Icono nombre="recargar" />
              <span>
                {estado && estado.particiones_totales > 0
                  ? `Sincronizando ${estado.particiones_completadas} de ${estado.particiones_totales} particiones`
                  : 'Sincronización en curso…'}
                {estado ? ` · ${estado.work_items.toLocaleString('es-CO')} work items` : ''}
              </span>
            </div>
          ) : (
            <div className="text-sm text-slate-600">
              {ultima
                ? `Última sincronización: ${fmtFechaCo(ultima)}`
                : 'Este proyecto aún no se ha sincronizado.'}
            </div>
          )}
        </div>

        {puedeEditar && (
          <Boton
            variante="secundario"
            tamano="sm"
            onClick={() => void sincronizar()}
            disabled={enCurso || iniciando}
            icono={<Icono nombre="recargar" />}
          >
            {enCurso ? 'Sincronizando…' : iniciando ? 'Iniciando…' : 'Sincronizar'}
          </Boton>
        )}
      </div>

      {errorSync && <Aviso tono="error">{errorSync}</Aviso>}
      {estadoActual === 'error' && estado?.error && (
        <Aviso tono="error">La sincronización falló: {estado.error}</Aviso>
      )}
    </Tarjeta>
  )
}
