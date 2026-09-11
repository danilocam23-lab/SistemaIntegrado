import { useMemo, useState } from 'react'
import type { Persona, Requerimiento } from '../../types'
import type { Filtros } from './tipos'
import { FILTROS_INIT } from './tipos'
import { fechaComprometidaReq } from './utilidades'

/** Estado de los 13 filtros del listado, sus 5 listas de opciones derivadas de
 *  `datos` y el resultado filtrado que consume la tabla, el pie y el export. */
export function useFiltrosRequerimientos(
  datos: Requerimiento[],
  personas: Persona[],
  squadPorId: Map<string, string>,
  categoriaPorId: Map<string, string>,
) {
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INIT)
  const [mostrarFiltros, setMostrarFiltros] = useState(false)

  const squadsDisponibles = useMemo(() => {
    const nombres = new Set<string>()
    datos.forEach((req) => {
      if (req.solicitud?.squad_id) {
        const nombre = squadPorId.get(String(req.solicitud.squad_id)) ?? String(req.solicitud.squad_id)
        nombres.add(nombre)
      }
    })
    return Array.from(nombres).sort((a, b) => a.localeCompare(b, 'es'))
  }, [datos, squadPorId])

  // Lo que NO se toca: filtro de personas por activo && rol_operativo (CLAUDE.md).
  const lideresDisponibles = useMemo(() =>
    personas.filter((p) => p.activo && p.rol_operativo === 'LT_HITSS'),
    [personas])

  const categoriasDisponibles = useMemo(() =>
    Array.from(new Set(datos.filter((r) => r.categoria_id).map((r) => categoriaPorId.get(String(r.categoria_id)) ?? String(r.categoria_id))))
      .sort((a, b) => a.localeCompare(b, 'es')),
    [datos, categoriaPorId])

  const tipificacionesDisponibles = useMemo(() =>
    Array.from(new Set(datos.filter((r) => r.tipificacion).map((r) => r.tipificacion as string))),
    [datos])

  const tiposCostoDisponibles = useMemo(() =>
    Array.from(new Set(datos.filter((r) => r.solicitud?.tipo_costo).map((r) => r.solicitud!.tipo_costo as string))),
    [datos])

  const hayFiltrosActivos = Object.values(filtros).some((v) => v !== '')

  const datosFiltrados = useMemo(() => {
    return datos.filter((req) => {
      // Texto libre
      if (filtros.codigoReq && !req.codigo_req.toLowerCase().includes(filtros.codigoReq.toLowerCase())) return false
      if (filtros.sc && !(req.solicitud?.codigo_sc ?? '').toLowerCase().includes(filtros.sc.toLowerCase())) return false

      // Squad: comparar contra nombre resuelto
      if (filtros.squad) {
        const nombreSquad = req.solicitud?.squad_id
          ? (squadPorId.get(String(req.solicitud.squad_id)) ?? String(req.solicitud.squad_id))
          : ''
        if (nombreSquad !== filtros.squad) return false
      }

      // Estado exacto del requerimiento
      if (filtros.estado && req.estado !== filtros.estado) return false

      // Líder técnico por ID
      if (filtros.liderTecnico && req.solicitud?.lt_hitss_id !== filtros.liderTecnico) return false

      // Fecha solicitud acta (campo que se ve en el formulario)
      if (filtros.fechaSolicitudDesde || filtros.fechaSolicitudHasta) {
        const fecha = req.fecha_solicitud_acta ? req.fecha_solicitud_acta.slice(0, 10) : null
        if (!fecha) return false
        if (filtros.fechaSolicitudDesde && fecha < filtros.fechaSolicitudDesde) return false
        if (filtros.fechaSolicitudHasta && fecha > filtros.fechaSolicitudHasta) return false
      }

      // Fecha comprometida (usa la misma lógica que la columna)
      if (filtros.fechaComprometidaDesde || filtros.fechaComprometidaHasta) {
        const fc = fechaComprometidaReq(req)
        if (!fc) return false
        if (filtros.fechaComprometidaDesde && fc < filtros.fechaComprometidaDesde) return false
        if (filtros.fechaComprometidaHasta && fc > filtros.fechaComprometidaHasta) return false
      }

      // Fecha límite (filtra por fecha real de entrega de la estimación)
      if (filtros.fechaLimiteDesde || filtros.fechaLimiteHasta) {
        const fl = req.fecha_real_entrega_estimacion ? req.fecha_real_entrega_estimacion.slice(0, 10) : null
        if (!fl) return false
        if (filtros.fechaLimiteDesde && fl < filtros.fechaLimiteDesde) return false
        if (filtros.fechaLimiteHasta && fl > filtros.fechaLimiteHasta) return false
      }

      // Estado de entrega: case-insensitive
      if (filtros.estadoEntrega) {
        const match = (req.entregas ?? []).some(
          (en) => (en.estado ?? '').toLowerCase() === filtros.estadoEntrega.toLowerCase()
        )
        if (!match) return false
      }

      // ANS Estimación
      if (filtros.ansEstimacion) {
        const v = (req.ans_acta ?? '').trim().toUpperCase().replace(/[_-]+/g, ' ')
        if (v !== filtros.ansEstimacion) return false
      }

      // Categoría (resuelto por nombre)
      if (filtros.categoria) {
        const nombreCat = req.categoria_id ? (categoriaPorId.get(String(req.categoria_id)) ?? String(req.categoria_id)) : ''
        if (nombreCat !== filtros.categoria) return false
      }

      // Tipificación del requerimiento
      if (filtros.tipificacion && req.tipificacion !== filtros.tipificacion) return false

      // Tipo de costo (solicitud)
      if (filtros.tipoCosto && req.solicitud?.tipo_costo !== filtros.tipoCosto) return false

      return true
    })
  }, [datos, filtros, squadPorId, categoriaPorId])

  return {
    filtros,
    setFiltros,
    mostrarFiltros,
    setMostrarFiltros,
    hayFiltrosActivos,
    datosFiltrados,
    squadsDisponibles,
    lideresDisponibles,
    categoriasDisponibles,
    tipificacionesDisponibles,
    tiposCostoDisponibles,
  }
}
