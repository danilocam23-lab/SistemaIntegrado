// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useCallback, useState } from 'react'
import client from '../../api/client'
import { mensajeError } from '../../api/hooks'
import { aItemsLote } from './plan'
import type { CapacidadFila, FilaPlanLote, ItemLote, ResultadoLote } from './tipos'

/** Filas por petición del endpoint por lote (tope del servidor). */
const FILAS_POR_LOTE = 500
/** Peticiones simultáneas del plan B (una por fila) si no existe el endpoint por lote. */
const CONCURRENCIA_FALLBACK = 4

interface Parametros {
  puedeEditar: boolean
  recargar: () => void
}

interface GuardarRegistro {
  /** Registro existente (PUT) o `null` para crear (POST). */
  registro: CapacidadFila | null
  personaId: string
  mes: string
  horas: number
  /** Solo se envía si cambió; `''` limpia la nota. */
  notas?: string
}

function estadoHttp(err: unknown): number | undefined {
  return (err as { response?: { status?: number } })?.response?.status
}

async function conConcurrencia<T>(items: T[], limite: number, tarea: (item: T) => Promise<void>) {
  let siguiente = 0
  const trabajadores = Array.from({ length: Math.min(limite, items.length) }, async () => {
    while (siguiente < items.length) {
      const item = items[siguiente]
      siguiente += 1
      await tarea(item)
    }
  })
  await Promise.all(trabajadores)
}

/**
 * Escrituras de capacidades: alta/edición de un registro, procesos en lote
 * (copiar mes, rellenar año, aplicar a varios meses) y limpieza de duplicados.
 * Nunca lanza: devuelve el mensaje de error del servidor (422/404/409) para
 * mostrarlo junto a la celda o el panel.
 */
export function useEscriturasCapacidades({ puedeEditar, recargar }: Parametros) {
  const [escribiendo, setEscribiendo] = useState(0)

  async function envolver<T>(accion: () => Promise<T>): Promise<T> {
    setEscribiendo((n) => n + 1)
    try {
      return await accion()
    } finally {
      setEscribiendo((n) => n - 1)
    }
  }

  /** PUT parcial (solo las horas y, si cambió, las notas) o POST. */
  const guardarRegistro = useCallback(async (datos: GuardarRegistro): Promise<string | null> => {
    if (!puedeEditar) return 'No tienes permiso para editar capacidades.'
    return envolver(async () => {
      try {
        if (datos.registro) {
          const cuerpo: Record<string, unknown> = { horas_disponibles: datos.horas }
          if (datos.notas !== undefined) cuerpo.notas = datos.notas
          await client.put(`/capacidades/${datos.registro.id}`, cuerpo)
        } else {
          const cuerpo: Record<string, unknown> = {
            scope: 'persona',
            persona_id: datos.personaId,
            mes: datos.mes,
            horas_disponibles: datos.horas,
          }
          if (datos.notas) cuerpo.notas = datos.notas
          await client.post('/capacidades', cuerpo)
        }
        recargar()
        return null
      } catch (err) {
        // 404/409: otra persona cambió el dato; se refresca para mostrar lo vigente.
        const estado = estadoHttp(err)
        if (estado === 404 || estado === 409) recargar()
        return mensajeError(err)
      }
    })
  }, [puedeEditar, recargar])

  /** Envía `items` al endpoint por lote (en trozos de `FILAS_POR_LOTE`). */
  async function enviarPorLote(items: ItemLote[]): Promise<ResultadoLote> {
    const resultado: ResultadoLote = { total: items.length, creadas: 0, actualizadas: 0, errores: [] }
    for (let i = 0; i < items.length; i += FILAS_POR_LOTE) {
      const trozo = items.slice(i, i + FILAS_POR_LOTE)
      try {
        const { data } = await client.put<{ creadas?: number; actualizadas?: number }>(
          '/capacidades/bulk', { filas: trozo },
        )
        resultado.creadas += data?.creadas ?? 0
        resultado.actualizadas += data?.actualizadas ?? 0
      } catch (err) {
        const estado = estadoHttp(err)
        if (estado === 404 || estado === 405) throw err // sin endpoint por lote: plan B
        resultado.errores.push(`${trozo.length} filas no se guardaron: ${mensajeError(err)}`)
      }
    }
    return resultado
  }

  /** Plan B: una petición por fila con concurrencia limitada. */
  async function enviarPorFila(plan: FilaPlanLote[]): Promise<ResultadoLote> {
    const pendientes = plan.filter((p) => p.accion !== 'omitir')
    const resultado: ResultadoLote = { total: pendientes.length, creadas: 0, actualizadas: 0, errores: [] }
    await conConcurrencia(pendientes, CONCURRENCIA_FALLBACK, async (fila) => {
      try {
        if (fila.registroId) {
          await client.put(`/capacidades/${fila.registroId}`, { horas_disponibles: fila.horas })
          resultado.actualizadas += 1
        } else {
          await client.post('/capacidades', {
            scope: 'persona', persona_id: fila.personaId, mes: fila.mes, horas_disponibles: fila.horas,
          })
          resultado.creadas += 1
        }
      } catch (err) {
        resultado.errores.push(`${fila.nombre} · ${fila.mes}: ${mensajeError(err)}`)
      }
    })
    return resultado
  }

  /** Aplica un plan (copiar mes, rellenar año, aplicar a varios meses). */
  const aplicarLote = useCallback(async (plan: FilaPlanLote[]): Promise<ResultadoLote> => {
    const items = aItemsLote(plan)
    if (!puedeEditar) {
      return { total: items.length, creadas: 0, actualizadas: 0, errores: ['No tienes permiso para editar capacidades.'] }
    }
    if (items.length === 0) return { total: 0, creadas: 0, actualizadas: 0, errores: [] }
    return envolver(async () => {
      let resultado: ResultadoLote
      try {
        resultado = await enviarPorLote(items)
      } catch {
        resultado = await enviarPorFila(plan)
      }
      recargar()
      return resultado
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puedeEditar, recargar])

  /** Elimina los registros duplicados indicados (los demás se conservan). */
  const eliminarDuplicados = useCallback(async (otros: CapacidadFila[]): Promise<string | null> => {
    if (!puedeEditar) return 'No tienes permiso para editar capacidades.'
    return envolver(async () => {
      let error: string | null = null
      for (const registro of otros) {
        try {
          await client.delete(`/capacidades/${registro.id}`)
        } catch (err) {
          error = mensajeError(err)
        }
      }
      recargar()
      return error
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puedeEditar, recargar])

  return { guardando: escribiendo > 0, guardarRegistro, aplicarLote, eliminarDuplicados }
}
