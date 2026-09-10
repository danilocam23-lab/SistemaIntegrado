import { useCallback, useState } from 'react'
import { ESTADOS_ENTREGA } from '../../constantes'
import type { Entrega } from '../../types'

export interface ValoresEntrega {
  numero: string
  horas: string
  fecha: string
  fechaReal: string
  estado: string
  mesAprobacion: string
  observaciones: string
  observacionesHitss: string
  tipificacion: string
  garantia: boolean
  numeroGarantia: number | null
}

const VALORES_VACIOS: Omit<ValoresEntrega, 'estado'> = {
  numero: '',
  horas: '',
  fecha: '',
  fechaReal: '',
  mesAprobacion: '',
  observaciones: '',
  observacionesHitss: '',
  tipificacion: '',
  garantia: false,
  numeroGarantia: null,
}

/**
 * Estados y lógica del sub-formulario de alta/edición de entrega.
 *
 * Nota: el estado inicial usa la constante `ESTADOS_ENTREGA[0]`, mientras que
 * `cancelar()` y `cargarEntrega()` usan `estadosEnt[0]` (la lista configurable).
 * Esa diferencia se mantiene tal cual estaba en el componente original.
 */
export function useFormularioEntrega(estadosEnt: string[]) {
  const [valores, setValores] = useState<ValoresEntrega>({
    ...VALORES_VACIOS,
    estado: ESTADOS_ENTREGA[0],
  })
  const [editando, setEditando] = useState(false)

  const actualizar = useCallback(
    <K extends keyof ValoresEntrega>(clave: K, valor: ValoresEntrega[K]): void => {
      setValores((v) => ({ ...v, [clave]: valor }))
    },
    [],
  )

  const cambiarEstado = useCallback((nuevo: string): void => {
    setValores((v) => ({
      ...v,
      estado: nuevo,
      mesAprobacion: nuevo.toUpperCase() !== 'APROBADA' ? '' : v.mesAprobacion,
    }))
  }, [])

  const cambiarGarantia = useCallback((v: boolean): void => {
    setValores((prev) => ({
      ...prev,
      garantia: v,
      numeroGarantia: v && !prev.numeroGarantia ? 1 : prev.numeroGarantia,
    }))
  }, [])

  const cargarEntrega = useCallback((en: Entrega): void => {
    setValores({
      numero: String(en.numero),
      horas: en.horas != null ? String(en.horas) : '',
      fecha: en.fecha_comprometida ? en.fecha_comprometida.slice(0, 10) : '',
      fechaReal: en.fecha_recepcion ? en.fecha_recepcion.slice(0, 10) : '',
      estado: en.estado ?? estadosEnt[0],
      mesAprobacion: en.mes_aprobacion ?? '',
      observaciones: en.observaciones ?? '',
      observacionesHitss: en.observaciones_hitss ?? '',
      tipificacion: en.tipificacion ?? '',
      garantia: en.garantia ?? false,
      numeroGarantia: en.numero_garantia ?? (en.garantia ? 1 : null),
    })
    setEditando(true)
  }, [estadosEnt])

  const cancelar = useCallback((): void => {
    setValores({ ...VALORES_VACIOS, estado: estadosEnt[0] })
    setEditando(false)
  }, [estadosEnt])

  const limpiarTrasGuardar = useCallback((): void => {
    setValores((v) => ({
      ...v,
      numero: '',
      horas: '',
      fecha: '',
      fechaReal: '',
      mesAprobacion: '',
      observaciones: '',
      observacionesHitss: '',
      tipificacion: '',
    }))
    setEditando(false)
  }, [])

  const cuerpoEntrega = useCallback((): Record<string, unknown> => ({
    numero: Number(valores.numero),
    horas: valores.horas ? Number(valores.horas) : null,
    fecha_comprometida: valores.fecha || null,
    fecha_recepcion: valores.fechaReal || null,
    estado: valores.estado,
    mes_aprobacion:
      valores.estado.toUpperCase() === 'APROBADA' ? (valores.mesAprobacion || null) : null,
    observaciones: valores.observaciones || null,
    observaciones_hitss: valores.observacionesHitss || null,
    tipificacion: valores.tipificacion || null,
    garantia: valores.garantia,
    numero_garantia: valores.garantia ? (valores.numeroGarantia ?? 1) : null,
  }), [valores])

  return {
    valores,
    editando,
    actualizar,
    cambiarEstado,
    cambiarGarantia,
    cargarEntrega,
    cancelar,
    limpiarTrasGuardar,
    cuerpoEntrega,
  }
}

export type FormularioEntregaControl = ReturnType<typeof useFormularioEntrega>
