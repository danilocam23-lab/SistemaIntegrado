import { useMemo } from 'react'
import type { Requerimiento } from '../../types'
import { calcularDiasTranscurridos, normalizarAns } from './utilidades'

/** Accesores de valor (texto/número) por clave de columna, usados para exportar a
 *  Excel y para renderizar las columnas "extra" (no editables, activadas desde
 *  Configuración). Las 15 columnas históricas se siguen renderizando con su JSX
 *  específico (edición inline, badges, etc.) para no romper esa funcionalidad.
 *  INVARIANTE 14: dos caminos de render deliberadamente distintos — no unificar.
 *  INVARIANTE 15: catálogo (REQUERIMIENTOS_COLUMNAS) y accesores viajan juntos;
 *  este objeto queda en un único archivo, nunca duplicado. */
export function useAccesoresRequerimiento(
  squadPorId: Map<string, string>,
  categoriaPorId: Map<string, string>,
  personaPorId: Map<string, string>,
  nombrePersona: (id: string | null) => string,
) {
  const CAMPO_ACCESOR_REQ = useMemo<Record<string, (r: Requerimiento) => string | number>>(() => ({
    codigoReq: (r) => r.codigo_req,
    sc: (r) => r.solicitud?.codigo_sc ?? '',
    squad: (r) => (r.solicitud?.squad_id ? (squadPorId.get(String(r.solicitud.squad_id)) ?? String(r.solicitud.squad_id)) : ''),
    nombreActa: (r) => r.nombre ?? '',
    aplicacionEpm: (r) => (r.nombre ? r.nombre.split('-')[0].trim() : ''),
    estado: (r) => r.estado,
    ansEstimacion: (r) => normalizarAns(r.ans_acta),
    ltHitss: (r) => nombrePersona(r.solicitud?.lt_hitss_id ?? null),
    scrum: (r) => nombrePersona(r.solicitud?.scrum_id ?? null),
    horas: (r) => r.total_horas_estimadas ?? '',
    fechaSolicitud: (r) => (r.fecha_solicitud_acta ? r.fecha_solicitud_acta.slice(0, 10) : ''),
    fechaLimite: (r) => (r.fecha_limite ? r.fecha_limite.slice(0, 10) : ''),
    fechaReal: (r) => (r.fecha_real_entrega_estimacion ? r.fecha_real_entrega_estimacion.slice(0, 10) : ''),
    diasTranscurridos: (r) => {
      const result = calcularDiasTranscurridos(r.fecha_limite, r.fecha_real_entrega_estimacion)
      return result ? `${result.esNegativo ? '-' : '+'}${result.dias}` : ''
    },
    entregasCount: (r) => r.entregas?.length ?? 0,
    // ── Extra ──
    ansEstimacionReal: (r) => r.ans_estimacion ?? '',
    seLevantoAnsReq: (r) => (r.se_levanto_ans == null ? '' : r.se_levanto_ans ? 'Sí' : 'No'),
    observacionesAnsReq: (r) => r.observaciones_ans ?? '',
    motivoCierre: (r) => r.motivo_cierre ?? '',
    seguimiento: (r) => r.seguimiento ?? '',
    seguimientoEpm: (r) => r.seguimiento_epm ?? '',
    tipificacion: (r) => r.tipificacion ?? '',
    montoPactado: (r) => r.monto_pactado ?? '',
    actaTrabajo: (r) => r.acta_trabajo ?? '',
    cantidadEntregas: (r) => r.cantidad_entregas ?? '',
    categoria: (r) => (r.categoria_id ? (categoriaPorId.get(String(r.categoria_id)) ?? String(r.categoria_id)) : ''),
    developers: (r) => (r.developers_asignados ?? []).map((id) => personaPorId.get(String(id)) ?? String(id)).join(', '),
    fechaInicio: (r) => (r.fecha_inicio ? r.fecha_inicio.slice(0, 10) : ''),
    fechaFin: (r) => (r.fecha_fin ? r.fecha_fin.slice(0, 10) : ''),
    ltEpm: (r) => nombrePersona(r.solicitud?.lt_epm_id ?? null),
    analista: (r) => nombrePersona(r.solicitud?.analista_requerimientos_id ?? null),
    tipoCosto: (r) => r.solicitud?.tipo_costo ?? '',
    tecnologia: (r) => r.solicitud?.tecnologia ?? '',
    solicitudEstado: (r) => r.solicitud?.estado ?? '',
    fechaSolicitudSc: (r) => (r.solicitud?.fecha_solicitud ? r.solicitud.fecha_solicitud.slice(0, 10) : ''),
    anioTarifa: (r) => r.solicitud?.anio_tarifa ?? '',
  }), [squadPorId, categoriaPorId, personaPorId, nombrePersona])

  return { CAMPO_ACCESOR_REQ }
}
