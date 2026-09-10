import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import client from '../../api/client'
import { mensajeError } from '../../api/hooks'
import type { Entrega, EventoBitacora, Liquidacion, Requerimiento } from '../../types'

/**
 * Los 16 campos editables del detalle del requerimiento.
 *
 * INVARIANTE: `seguimiento` y `tipificacion` son el MISMO estado que consumen
 * la tarjeta "Datos generales" (a través de `guardar`, PUT `/requerimientos/:id`)
 * y la tarjeta "Seguimiento Hitss" (a través de `guardarTipificacionReq`, PATCH
 * `/requerimientos/detalle-ans`). No deben separarse: "Guardar cambios" arrastra
 * lo tecleado en la tarjeta Hitss aunque no se haya guardado aparte.
 */
export interface ValoresRequerimiento {
  nombreActa: string
  codigoSc: string
  tipoCosto: string
  squadId: string
  ltHitssId: string
  ltEpmId: string
  scrumId: string
  analistaId: string
  horas: string
  fechaSolicitudActa: string
  fechaRealEntregaEst: string
  seguimiento: string
  seguimientoEpm: string
  tipificacion: string
  motivoCierre: string
  actaTrabajo: string
}

const VALORES_VACIOS: ValoresRequerimiento = {
  nombreActa: '',
  codigoSc: '',
  tipoCosto: 'TYM',
  squadId: '',
  ltHitssId: '',
  ltEpmId: '',
  scrumId: '',
  analistaId: '',
  horas: '',
  fechaSolicitudActa: '',
  fechaRealEntregaEst: '',
  seguimiento: '',
  seguimientoEpm: '',
  tipificacion: '',
  motivoCierre: '',
  actaTrabajo: '',
}

export interface CamposRequerimiento {
  valores: ValoresRequerimiento
  actualizar: <K extends keyof ValoresRequerimiento>(clave: K, valor: ValoresRequerimiento[K]) => void
}

interface Opciones {
  modoConsolidado: boolean
  puedeEditarReq: boolean
  puedeEditarTipificacion: boolean
}

/**
 * Estado y escrituras del detalle del requerimiento: carga (`req`,
 * `liquidacion`, `eventos`), formulario de datos generales, las 7 escrituras
 * async y la edición en línea de tipificación por entrega.
 */
export function useRequerimientoDetalle(
  reqId: string | undefined,
  { modoConsolidado, puedeEditarReq, puedeEditarTipificacion }: Opciones,
) {
  const [req, setReq] = useState<Requerimiento | null>(null)
  const [liquidacion, setLiquidacion] = useState<Liquidacion | null>(null)
  const [eventos, setEventos] = useState<EventoBitacora[]>([])
  const [aviso, setAviso] = useState('')
  const [ok, setOk] = useState('')

  // Formulario de datos generales (los 16 campos, estado único compartido por
  // las tarjetas "Datos generales" y "Seguimiento Hitss").
  const [valores, setValores] = useState<ValoresRequerimiento>(VALORES_VACIOS)

  const actualizar = useCallback(
    <K extends keyof ValoresRequerimiento>(clave: K, valor: ValoresRequerimiento[K]): void => {
      setValores((v) => ({ ...v, [clave]: valor }))
    },
    [],
  )

  // Edición inline de Observaciones Hitss / Tipificación por entrega
  // (visible para quienes tengan requerimientos.tipificacion.editar aunque no
  // tengan requerimientos.editar completo).
  const [tipifEdicion, setTipifEdicion] = useState<Record<number, { obs: string; tip: string }>>({})
  const [guardandoTipif, setGuardandoTipif] = useState<Set<number>>(new Set())

  const recargar = useCallback(async () => {
    if (!reqId) return
    try {
      const { data } = await client.get<Requerimiento>(`/requerimientos/${reqId}`)
      setReq(data)
      setValores({
        nombreActa: data.nombre ?? '',
        codigoSc: data.solicitud?.codigo_sc ?? '',
        tipoCosto: data.solicitud?.tipo_costo ?? 'TYM',
        squadId: data.solicitud?.squad_id ?? '',
        ltHitssId: data.solicitud?.lt_hitss_id ?? '',
        ltEpmId: data.solicitud?.lt_epm_id ?? '',
        scrumId: data.solicitud?.scrum_id ?? '',
        analistaId: data.solicitud?.analista_requerimientos_id ?? '',
        horas: data.total_horas_estimadas != null ? String(data.total_horas_estimadas) : '',
        fechaSolicitudActa: data.fecha_solicitud_acta ? data.fecha_solicitud_acta.slice(0, 16) : '',
        fechaRealEntregaEst: data.fecha_real_entrega_estimacion
          ? data.fecha_real_entrega_estimacion.slice(0, 16)
          : '',
        seguimiento: data.seguimiento ?? '',
        seguimientoEpm: data.seguimiento_epm ?? '',
        tipificacion: data.tipificacion ?? '',
        motivoCierre: data.motivo_cierre ?? '',
        actaTrabajo: data.acta_trabajo ?? '',
      })
      const [liq, bit] = await Promise.all([
        client.get<Liquidacion>(`/requerimientos/${reqId}/liquidacion`),
        client.get<EventoBitacora[]>(`/bitacora?entidad_id=${data.id}`),
      ])
      setLiquidacion(liq.data)
      setEventos(bit.data)
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }, [reqId])

  useEffect(() => {
    recargar()
  }, [recargar])

  // En modo consolidado el cliente envía __todas__; las escrituras necesitan
  // el código real de la aplicación. Se obtiene del propio requerimiento
  // (aplicacion_id o squad_id de la solicitud como fallback).
  function writeConfig() {
    if (!modoConsolidado) return {}
    const appCode = req?.aplicacion_id || req?.solicitud?.squad_id
    return appCode ? { headers: { 'X-Aplicacion': appCode } } : {}
  }

  async function guardar(e: FormEvent): Promise<void> {
    e.preventDefault()
    setAviso('')
    setOk('')
    if (!puedeEditarReq) {
      setAviso('No tienes permiso para editar requerimientos.')
      return
    }
    if (!req) return
    try {
      await client.put(`/requerimientos/${reqId}`, {
        nombre: valores.nombreActa || null,
        solicitud: {
          ...req.solicitud,
          codigo_sc: valores.codigoSc,
          tipo_costo: valores.tipoCosto || null,
          squad_id: valores.squadId || null,
          lt_hitss_id: valores.ltHitssId || null,
          lt_epm_id: valores.ltEpmId || null,
          scrum_id: valores.scrumId || null,
          analista_requerimientos_id: valores.analistaId || null,
        },
        total_horas_estimadas: valores.horas ? Number(valores.horas) : null,
        fecha_solicitud_acta: valores.fechaSolicitudActa || null,
        fecha_real_entrega_estimacion: valores.fechaRealEntregaEst || null,
        seguimiento: valores.seguimiento || null,
        seguimiento_epm: valores.seguimientoEpm || null,
        tipificacion: valores.tipificacion || null,
        motivo_cierre: valores.motivoCierre || null,
        acta_trabajo: valores.actaTrabajo || null,
      }, writeConfig())
      setOk('Cambios guardados.')
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  async function guardarTipificacionReq(): Promise<void> {
    setAviso('')
    setOk('')
    if (!puedeEditarTipificacion) {
      setAviso('No tienes permiso para editar Seguimiento Hitss / Tipificación.')
      return
    }
    if (!req) return
    try {
      await client.patch('/requerimientos/detalle-ans', {
        tipo: 'requerimiento',
        req_id: req.id,
        seguimiento: valores.seguimiento || null,
        tipificacion: valores.tipificacion || null,
      }, writeConfig())
      setOk('Cambios guardados.')
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  async function transicion(nuevoEstado: string): Promise<void> {
    setAviso('')
    setOk('')
    if (!puedeEditarReq) {
      setAviso('No tienes permiso para actualizar el estado del requerimiento.')
      return
    }
    try {
      await client.post(`/requerimientos/${reqId}/transicion`, { nuevo_estado: nuevoEstado }, writeConfig())
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  async function agregarEntrega(
    e: FormEvent,
    construirCuerpo: () => Record<string, unknown>,
    alGuardar: () => void,
  ): Promise<void> {
    e.preventDefault()
    setAviso('')
    setOk('')
    if (!puedeEditarReq) {
      setAviso('No tienes permiso para crear o actualizar entregas.')
      return
    }
    try {
      await client.post(`/requerimientos/${reqId}/entregas`, construirCuerpo(), writeConfig())
      alGuardar()
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  async function eliminarEntrega(numero: number): Promise<void> {
    setAviso('')
    setOk('')
    if (!puedeEditarReq) {
      setAviso('No tienes permiso para eliminar entregas.')
      return
    }
    try {
      await client.delete(`/requerimientos/${reqId}/entregas/${numero}`, writeConfig())
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  async function eliminarEvento(eventoId: string): Promise<void> {
    if (!confirm('¿Eliminar este evento de bitácora?')) return
    try {
      await client.delete(`/bitacora/${eventoId}`, writeConfig())
      setEventos((prev) => prev.filter((e) => e.id !== eventoId))
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  function iniciarEdicionTipif(en: Entrega): void {
    setTipifEdicion((p) => ({
      ...p,
      [en.numero]: { obs: en.observaciones_hitss ?? '', tip: en.tipificacion ?? '' },
    }))
  }

  function cambiarTipif(numero: number, campo: 'obs' | 'tip', valor: string): void {
    setTipifEdicion((p) => ({ ...p, [numero]: { ...p[numero], [campo]: valor } }))
  }

  function cancelarTipif(numero: number): void {
    setTipifEdicion((p) => { const n = { ...p }; delete n[numero]; return n })
  }

  async function guardarTipifEntrega(numero: number): Promise<void> {
    const edicion = tipifEdicion[numero]
    if (!edicion || !req) return
    setGuardandoTipif((s) => new Set(s).add(numero))
    try {
      await client.patch('/requerimientos/detalle-ans', {
        tipo: 'entrega',
        req_id: req.id,
        entrega_numero: numero,
        observaciones_hitss: edicion.obs || null,
        tipificacion: edicion.tip || null,
      }, writeConfig())
      setTipifEdicion((p) => { const n = { ...p }; delete n[numero]; return n })
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    } finally {
      setGuardandoTipif((s) => { const n = new Set(s); n.delete(numero); return n })
    }
  }

  return {
    req,
    liquidacion,
    eventos,
    aviso,
    ok,
    setAviso,
    campos: { valores, actualizar } as CamposRequerimiento,
    recargar,
    guardar,
    guardarTipificacionReq,
    transicion,
    agregarEntrega,
    eliminarEntrega,
    eliminarEvento,
    tipifEdicion,
    guardandoTipif,
    iniciarEdicionTipif,
    cambiarTipif,
    cancelarTipif,
    guardarTipifEntrega,
  }
}
