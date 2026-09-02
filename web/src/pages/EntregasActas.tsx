import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import * as XLSX from 'xlsx'
import client from '../api/client'
import { useLista } from '../api/hooks'
import { useAuth } from '../context/AuthContext'
import {
  ENTREGAS_ACTAS_CONFIG_CLAVES,
  ENTREGAS_ACTAS_COLUMNAS,
  ENTREGAS_ACTAS_FILTROS,
  leerCamposActivos,
} from '../constantes'
import type { Aplicacion, Categoria, Configuracion as ConfigItem, Persona, Requerimiento, Squad } from '../types'

const MESES_NOMBRES: Record<string, string> = {
  ene: 'Enero', feb: 'Febrero', mar: 'Marzo', abr: 'Abril', may: 'Mayo', jun: 'Junio',
  jul: 'Julio', ago: 'Agosto', sep: 'Septiembre', oct: 'Octubre', nov: 'Noviembre', dic: 'Diciembre',
  jan: 'Enero', apr: 'Abril', aug: 'Agosto', dec: 'Diciembre',
}

/**
 * Normaliza `mes_aprobacion` al formato canónico "Enero", "Febrero"...
 * Defensivo: si el dato ya viene normalizado del back, lo retorna tal cual.
 * Si viene en cualquier otro formato (MAYÚS, con año, abreviado) lo convierte.
 */
function normalizarMes(raw: string): string {
  const s = raw.trim()
  // Quitar dígitos y caracteres no alfabéticos, quedarse con la parte de letras
  const soloLetras = s.replace(/[^A-Za-z\u00C0-\u024F]/g, ' ').trim().split(/\s+/)[0] ?? ''
  if (!soloLetras) return s
  // Normalizar tildes y pasar a minúsculas para comparar
  const norm = soloLetras.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const clave = norm.slice(0, 3)
  const nombreCompleto = MESES_NOMBRES[clave]
  if (nombreCompleto) return nombreCompleto
  // Si no reconoce, devuelve primera letra mayúscula del valor original
  return soloLetras.charAt(0).toUpperCase() + soloLetras.slice(1).toLowerCase()
}

interface FilaEntrega {
  reqId: string
  codigoReq: string
  sc: string
  squad: string
  nombreActa: string
  entregaNum: number
  horas: number | null
  porcentaje: number | null
  fechaComprometida: string | null
  fechaReal: string | null
  estado: string | null
  ansEntrega: string | null
  mesAprobacion: string | null
  ltEpm: string
  actaTrabajo: string
  // Entrega (adicionales)
  seLevantoAnsEntrega: boolean | null
  observacionesAnsEntrega: string | null
  fechaCargue: string | null
  fechaAprobacion: string | null
  fechaEjecucion: string | null
  observaciones: string | null
  observacionesHitss: string | null
  tipificacionEntrega: string | null
  garantia: boolean
  numeroGarantia: number | null
  facturacionEstado: string | null
  facturacionMes: string | null
  facturacionFechaAprobacion: string | null
  facturacionValor: number | null
  // Requerimiento (adicionales)
  reqEstado: string
  totalHorasEstimadas: number | null
  fechaRealEntregaEstimacion: string | null
  ansEstimacion: string | null
  seLevantoAnsReq: boolean | null
  observacionesAnsReq: string | null
  fechaSolicitudActa: string | null
  fechaLimite: string | null
  ansActa: string | null
  motivoCierre: string | null
  seguimiento: string | null
  seguimientoEpm: string | null
  tipificacionReq: string | null
  montoPactado: number | null
  cantidadEntregas: number
  categoria: string
  developers: string
  fechaInicio: string | null
  fechaFin: string | null
  // Solicitud (adicionales)
  tipoCosto: string | null
  tecnologia: string | null
  solicitudEstado: string | null
  fechaSolicitud: string | null
  ltHitss: string
  scrum: string
  anioTarifa: number | null
}

/** Alineación de encabezado por columna (las no listadas usan 'text-left'). */
const THEAD_ALIGN: Record<string, string> = {
  entregaNum: 'text-center',
  horas: 'text-right',
  porcentaje: 'text-right',
  diasTranscurridos: 'text-right',
  estado: 'text-center',
  totalHorasEstimadas: 'text-right',
  montoPactado: 'text-right',
  cantidadEntregas: 'text-center',
  anioTarifa: 'text-center',
  numeroGarantia: 'text-center',
  garantia: 'text-center',
  facturacionValor: 'text-right',
}

export default function EntregasActas() {
  const { tienePermiso } = useAuth()
  const puedeExportar = tienePermiso('entregas_actas.exportar')
  const { datos: requerimientos, error, cargando, recargar } = useLista<Requerimiento>('/requerimientos')
  const { datos: aplicaciones } = useLista<Aplicacion>('/aplicaciones')
  const { datos: personas } = useLista<Persona>('/personas')
  const { datos: categorias } = useLista<Categoria>('/categorias')
  const { datos: configuracion } = useLista<ConfigItem>('/configuracion')
  const [squadsCol, setSquadsCol] = useState<Squad[]>([])
  const [filtroTexto, setFiltroTexto] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroAns, setFiltroAns] = useState('')
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('')
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('')
  const [filtroMes, setFiltroMes] = useState('')
  const [filtroReqEstado, setFiltroReqEstado] = useState('')
  const [filtroSquad, setFiltroSquad] = useState('')
  const [filtroTipificacion, setFiltroTipificacion] = useState('')
  const [filtroGarantia, setFiltroGarantia] = useState('')

  /** Columnas, filtros y campos de exportación activados desde /configuracion
   *  (tab "Entregas de Actas" en Configuración). Por defecto, todo activo. */
  const columnasActivas = useMemo(
    () => leerCamposActivos(configuracion, ENTREGAS_ACTAS_CONFIG_CLAVES.columnas, ENTREGAS_ACTAS_COLUMNAS),
    [configuracion],
  )
  const filtrosActivos = useMemo(
    () => leerCamposActivos(configuracion, ENTREGAS_ACTAS_CONFIG_CLAVES.filtros, ENTREGAS_ACTAS_FILTROS),
    [configuracion],
  )
  const exportCamposActivos = useMemo(
    () => leerCamposActivos(configuracion, ENTREGAS_ACTAS_CONFIG_CLAVES.exportCampos, ENTREGAS_ACTAS_COLUMNAS),
    [configuracion],
  )
  const columnasVisibles = useMemo(
    () => ENTREGAS_ACTAS_COLUMNAS.filter((c) => columnasActivas.has(c.key)),
    [columnasActivas],
  )

  // Auto-refresca cuando el usuario vuelve a esta pestaña/vista
  useEffect(() => {
    const handleVisible = () => {
      if (document.visibilityState === 'visible') recargar()
    }
    document.addEventListener('visibilitychange', handleVisible)
    return () => document.removeEventListener('visibilitychange', handleVisible)
  }, [recargar])

  useEffect(() => {
    client
      .get<Squad[]>('/squads', { headers: { 'X-Aplicacion': '__todas__' } })
      .then((r) => setSquadsCol(r.data))
      .catch(() => {
        client
          .get<Squad[]>('/squads')
          .then((r) => setSquadsCol(r.data))
          .catch(() => {})
      })
  }, [])

  const squadPorId = useMemo(() => {
    const m = new Map<string, string>()
    squadsCol.forEach((s) => m.set(String(s.id), s.nombre))
    aplicaciones.forEach((a) => m.set(String(a.codigo), a.nombre))
    return m
  }, [squadsCol, aplicaciones])

  const personaPorId = useMemo(() => {
    const m = new Map<string, string>()
    personas.forEach((p) => m.set(String(p.id), p.nombre))
    return m
  }, [personas])

  const categoriaPorId = useMemo(() => {
    const m = new Map<string, string>()
    categorias.forEach((c) => m.set(String(c.id), c.nombre))
    return m
  }, [categorias])

  const filas = useMemo<FilaEntrega[]>(() => {
    const resultado: FilaEntrega[] = []
    for (const req of requerimientos) {
      const squadNombre = req.solicitud?.squad_id
        ? (squadPorId.get(String(req.solicitud.squad_id)) ?? String(req.solicitud.squad_id))
        : ''
      const ltEpmNombre = req.solicitud?.lt_epm_id
        ? (personaPorId.get(String(req.solicitud.lt_epm_id)) ?? String(req.solicitud.lt_epm_id))
        : ''
      const ltHitssNombre = req.solicitud?.lt_hitss_id
        ? (personaPorId.get(String(req.solicitud.lt_hitss_id)) ?? String(req.solicitud.lt_hitss_id))
        : ''
      const scrumNombre = req.solicitud?.scrum_id
        ? (personaPorId.get(String(req.solicitud.scrum_id)) ?? String(req.solicitud.scrum_id))
        : ''
      const categoriaNombre = req.categoria_id
        ? (categoriaPorId.get(String(req.categoria_id)) ?? String(req.categoria_id))
        : ''
      const developersNombres = (req.developers_asignados ?? [])
        .map((id) => personaPorId.get(String(id)) ?? String(id))
        .join(', ')
      for (const en of req.entregas ?? []) {
        const porcentaje =
          en.porcentaje != null
            ? en.porcentaje
            : en.horas != null && req.total_horas_estimadas
            ? Number(((Number(en.horas) * 100) / Number(req.total_horas_estimadas)).toFixed(1))
            : null
        resultado.push({
          reqId: req.id,
          codigoReq: req.codigo_req,
          sc: req.solicitud?.codigo_sc ?? '',
          squad: squadNombre,
          nombreActa: req.nombre ?? '',
          entregaNum: en.numero,
          horas: en.horas ?? null,
          porcentaje,
          fechaComprometida: en.fecha_comprometida ?? null,
          fechaReal: en.fecha_recepcion ?? null,
          estado: en.estado ?? null,
          ansEntrega: en.ans_entrega ?? null,
          mesAprobacion: en.mes_aprobacion ? normalizarMes(en.mes_aprobacion) : null,
          ltEpm: ltEpmNombre,
          actaTrabajo: req.acta_trabajo ?? '',
          seLevantoAnsEntrega: en.se_levanto_ans ?? null,
          observacionesAnsEntrega: en.observaciones_ans ?? null,
          fechaCargue: en.fecha_cargue ?? null,
          fechaAprobacion: en.fecha_aprobacion ?? null,
          fechaEjecucion: en.fecha_ejecucion ?? null,
          observaciones: en.observaciones ?? null,
          observacionesHitss: en.observaciones_hitss ?? null,
          tipificacionEntrega: en.tipificacion ?? null,
          garantia: en.garantia ?? false,
          numeroGarantia: en.numero_garantia ?? null,
          facturacionEstado: en.facturacion?.estado ?? null,
          facturacionMes: en.facturacion?.mes_facturacion ?? null,
          facturacionFechaAprobacion: en.facturacion?.fecha_aprobacion_factura ?? null,
          facturacionValor: en.facturacion?.valor_facturado ?? null,
          reqEstado: req.estado ?? '',
          totalHorasEstimadas: req.total_horas_estimadas ?? null,
          fechaRealEntregaEstimacion: req.fecha_real_entrega_estimacion ?? null,
          ansEstimacion: req.ans_estimacion ?? null,
          seLevantoAnsReq: req.se_levanto_ans ?? null,
          observacionesAnsReq: req.observaciones_ans ?? null,
          fechaSolicitudActa: req.fecha_solicitud_acta ?? null,
          fechaLimite: req.fecha_limite ?? null,
          ansActa: req.ans_acta ?? null,
          motivoCierre: req.motivo_cierre ?? null,
          seguimiento: req.seguimiento ?? null,
          seguimientoEpm: req.seguimiento_epm ?? null,
          tipificacionReq: req.tipificacion ?? null,
          montoPactado: req.monto_pactado ?? null,
          cantidadEntregas: req.cantidad_entregas ?? 0,
          categoria: categoriaNombre,
          developers: developersNombres,
          fechaInicio: req.fecha_inicio ?? null,
          fechaFin: req.fecha_fin ?? null,
          tipoCosto: req.solicitud?.tipo_costo ?? null,
          tecnologia: req.solicitud?.tecnologia ?? null,
          solicitudEstado: req.solicitud?.estado ?? null,
          fechaSolicitud: req.solicitud?.fecha_solicitud ?? null,
          ltHitss: ltHitssNombre,
          scrum: scrumNombre,
          anioTarifa: req.solicitud?.anio_tarifa ?? null,
        })
      }
    }
    return resultado
  }, [requerimientos, squadPorId, personaPorId, categoriaPorId])

  const filasFiltradas = useMemo(() => {
    return filas
      .filter((f) => {
        if (filtroEstado && (f.estado ?? '').toUpperCase() !== filtroEstado.toUpperCase()) return false
        if (filtroAns === '__SIN_ANS__' && f.ansEntrega) return false
        if (filtroAns && filtroAns !== '__SIN_ANS__' && (f.ansEntrega ?? '') !== filtroAns) return false
        if (filtroMes && (f.mesAprobacion ?? '') !== filtroMes) return false
        if (filtroReqEstado && f.reqEstado !== filtroReqEstado) return false
        if (filtroSquad && f.squad !== filtroSquad) return false
        if (filtroTipificacion && (f.tipificacionEntrega ?? f.tipificacionReq ?? '') !== filtroTipificacion) return false
        if (filtroGarantia === 'SI' && !f.garantia) return false
        if (filtroGarantia === 'NO' && f.garantia) return false
        if (filtroTexto) {
          const t = filtroTexto.toLowerCase()
          if (
            !f.codigoReq.toLowerCase().includes(t) &&
            !f.sc.toLowerCase().includes(t) &&
            !f.nombreActa.toLowerCase().includes(t) &&
            !f.actaTrabajo.toLowerCase().includes(t)
          )
            return false
        }
        if (filtroFechaDesde || filtroFechaHasta) {
          const fc = f.fechaComprometida ? f.fechaComprometida.slice(0, 10) : null
          if (!fc) return false
          if (filtroFechaDesde && fc < filtroFechaDesde) return false
          if (filtroFechaHasta && fc > filtroFechaHasta) return false
        }
        return true
      })
      .sort((a, b) => a.sc.localeCompare(b.sc, 'es', { numeric: true }))
  }, [filas, filtroTexto, filtroEstado, filtroAns, filtroMes, filtroFechaDesde, filtroFechaHasta, filtroReqEstado, filtroSquad, filtroTipificacion, filtroGarantia])

  /** Meses de aprobación únicos presentes en los datos */
  const mesesEnBD = useMemo(() => {
    const set = new Set<string>()
    for (const f of filas) {
      if (f.mesAprobacion) set.add(f.mesAprobacion)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
  }, [filas])

  /** Estados reales que tienen las entregas en la BD */
  const estadosEnBD = useMemo(() => {
    const set = new Set<string>()
    for (const f of filas) {
      if (f.estado) set.add(f.estado)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
  }, [filas])

  const ansEnBD = useMemo(() => {
    const set = new Set<string>()
    for (const f of filas) {
      if (f.ansEntrega) set.add(f.ansEntrega)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
  }, [filas])

  /** Estados de requerimiento únicos presentes en los datos */
  const reqEstadosEnBD = useMemo(() => {
    const set = new Set<string>()
    for (const f of filas) {
      if (f.reqEstado) set.add(f.reqEstado)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
  }, [filas])

  /** Squads únicos presentes en los datos */
  const squadsEnBD = useMemo(() => {
    const set = new Set<string>()
    for (const f of filas) {
      if (f.squad) set.add(f.squad)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
  }, [filas])

  /** Tipificaciones (entrega o requerimiento) únicas presentes en los datos */
  const tipificacionesEnBD = useMemo(() => {
    const set = new Set<string>()
    for (const f of filas) {
      const t = f.tipificacionEntrega ?? f.tipificacionReq
      if (t) set.add(t)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
  }, [filas])

  const estadoBadge = (estado: string | null) => {
    const s = estado ?? ''
    const cls =
      s.toUpperCase() === 'PENDIENTE' ? 'bg-amber-100 text-amber-700' :
      s.toUpperCase() === 'APROBADA' ? 'bg-green-100 text-green-700' :
      s.toUpperCase() === 'RECHAZADA' ? 'bg-red-100 text-red-700' :
      s.toUpperCase() === 'ENTREGA CARGADA' ? 'bg-blue-100 text-blue-700' :
      s.toUpperCase() === 'ENTREGA NO CARGADA' ? 'bg-orange-100 text-orange-700' :
      s.toUpperCase() === 'EN GARANTIA' ? 'bg-purple-100 text-purple-700' :
      'bg-slate-100 text-slate-600'
    return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{s || '—'}</span>
  }

  const calcularDiasTranscurridos = (fechaComprometida: string | null, fechaReal: string | null): { dias: number; esNegativo: boolean } | null => {
    if (!fechaComprometida) return null

    const hoyLocal = (() => {
      const d = new Date()
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    })()

    const fechaInicio = fechaComprometida.slice(0, 10)
    const fechaFin = fechaReal ? fechaReal.slice(0, 10) : hoyLocal

    const toUtcDate = (ymd: string) => {
      const [y, m, d] = ymd.split('-').map(Number)
      return Date.UTC(y, m - 1, d)
    }

    const diferencia = Math.floor((toUtcDate(fechaFin) - toUtcDate(fechaInicio)) / (1000 * 60 * 60 * 24))

    let esNegativo = false
    if (!fechaReal && hoyLocal > fechaInicio) {
      esNegativo = true
    } else if (fechaReal && fechaReal.slice(0, 10) > fechaInicio) {
      esNegativo = true
    }

    return { dias: Math.abs(diferencia), esNegativo }
  }

  /** Accesores simples (texto/número) por campo, reutilizados en exportación y en
   *  las celdas de la tabla que no requieren un render especial (links, badges, etc). */
  const CAMPO_ACCESOR: Record<string, (f: FilaEntrega) => string | number> = {
    codigoReq: (f) => f.codigoReq,
    sc: (f) => f.sc,
    squad: (f) => f.squad,
    nombreActa: (f) => f.nombreActa,
    actaTrabajo: (f) => f.actaTrabajo,
    ltEpm: (f) => f.ltEpm,
    entregaNum: (f) => f.entregaNum,
    horas: (f) => f.horas ?? '',
    porcentaje: (f) => f.porcentaje ?? '',
    fechaComprometida: (f) => (f.fechaComprometida ? f.fechaComprometida.slice(0, 10) : ''),
    fechaReal: (f) => (f.fechaReal ? f.fechaReal.slice(0, 10) : ''),
    estado: (f) => f.estado ?? '',
    mesAprobacion: (f) => f.mesAprobacion ?? '',
    ansEntrega: (f) => f.ansEntrega ?? '',
    seLevantoAnsEntrega: (f) => (f.seLevantoAnsEntrega == null ? '' : f.seLevantoAnsEntrega ? 'Sí' : 'No'),
    observacionesAnsEntrega: (f) => f.observacionesAnsEntrega ?? '',
    fechaCargue: (f) => (f.fechaCargue ? f.fechaCargue.slice(0, 10) : ''),
    fechaAprobacion: (f) => (f.fechaAprobacion ? f.fechaAprobacion.slice(0, 10) : ''),
    fechaEjecucion: (f) => (f.fechaEjecucion ? f.fechaEjecucion.slice(0, 10) : ''),
    observaciones: (f) => f.observaciones ?? '',
    observacionesHitss: (f) => f.observacionesHitss ?? '',
    tipificacionEntrega: (f) => f.tipificacionEntrega ?? '',
    garantia: (f) => (f.garantia ? 'Sí' : 'No'),
    numeroGarantia: (f) => f.numeroGarantia ?? '',
    facturacionEstado: (f) => f.facturacionEstado ?? '',
    facturacionMes: (f) => (f.facturacionMes ? f.facturacionMes.slice(0, 10) : ''),
    facturacionFechaAprobacion: (f) => (f.facturacionFechaAprobacion ? f.facturacionFechaAprobacion.slice(0, 10) : ''),
    facturacionValor: (f) => f.facturacionValor ?? '',
    reqEstado: (f) => f.reqEstado,
    totalHorasEstimadas: (f) => f.totalHorasEstimadas ?? '',
    fechaRealEntregaEstimacion: (f) => (f.fechaRealEntregaEstimacion ? f.fechaRealEntregaEstimacion.slice(0, 10) : ''),
    ansEstimacion: (f) => f.ansEstimacion ?? '',
    seLevantoAnsReq: (f) => (f.seLevantoAnsReq == null ? '' : f.seLevantoAnsReq ? 'Sí' : 'No'),
    observacionesAnsReq: (f) => f.observacionesAnsReq ?? '',
    fechaSolicitudActa: (f) => (f.fechaSolicitudActa ? f.fechaSolicitudActa.slice(0, 10) : ''),
    fechaLimite: (f) => (f.fechaLimite ? f.fechaLimite.slice(0, 10) : ''),
    ansActa: (f) => f.ansActa ?? '',
    motivoCierre: (f) => f.motivoCierre ?? '',
    seguimiento: (f) => f.seguimiento ?? '',
    seguimientoEpm: (f) => f.seguimientoEpm ?? '',
    tipificacionReq: (f) => f.tipificacionReq ?? '',
    montoPactado: (f) => f.montoPactado ?? '',
    cantidadEntregas: (f) => f.cantidadEntregas,
    categoria: (f) => f.categoria,
    developers: (f) => f.developers,
    fechaInicio: (f) => (f.fechaInicio ? f.fechaInicio.slice(0, 10) : ''),
    fechaFin: (f) => (f.fechaFin ? f.fechaFin.slice(0, 10) : ''),
    tipoCosto: (f) => f.tipoCosto ?? '',
    tecnologia: (f) => f.tecnologia ?? '',
    solicitudEstado: (f) => f.solicitudEstado ?? '',
    fechaSolicitud: (f) => (f.fechaSolicitud ? f.fechaSolicitud.slice(0, 10) : ''),
    ltHitss: (f) => f.ltHitss,
    scrum: (f) => f.scrum,
    anioTarifa: (f) => f.anioTarifa ?? '',
  }

  /** Valor de texto/número de un campo, usado para exportar a Excel. */
  const valorCampo = (
    key: string,
    f: FilaEntrega,
    diasInfo: { dias: number; esNegativo: boolean } | null,
  ): string | number => {
    if (key === 'diasTranscurridos') return diasInfo ? `${diasInfo.esNegativo ? '-' : '+'}${diasInfo.dias}` : ''
    return CAMPO_ACCESOR[key]?.(f) ?? ''
  }

  /** Contenido y clases de una celda de la tabla, según la columna. */
  const celdaEntrega = (
    key: string,
    f: FilaEntrega,
    diasInfo: { dias: number; esNegativo: boolean } | null,
    vencida: boolean,
  ): { className: string; content: ReactNode } => {
    switch (key) {
      case 'codigoReq':
        return {
          className: 'p-2',
          content: (
            <Link to={`/requerimientos/${f.reqId}`} className="text-marca hover:underline font-medium">
              {f.codigoReq}
            </Link>
          ),
        }
      case 'porcentaje':
        return {
          className: 'p-2 text-right',
          content:
            f.porcentaje != null ? (
              <span className="inline-flex items-center gap-1">
                <span className="w-16 overflow-hidden rounded-full bg-slate-100 h-2 inline-block align-middle">
                  <span
                    className="block h-2 rounded-full bg-marca"
                    style={{ width: `${Math.min(f.porcentaje, 100)}%` }}
                  />
                </span>
                {f.porcentaje}%
              </span>
            ) : (
              '—'
            ),
        }
      case 'fechaComprometida':
        return {
          className: `p-2 font-medium ${vencida ? 'text-red-700' : ''}`,
          content: (
            <>
              {f.fechaComprometida ? f.fechaComprometida.slice(0, 10) : '—'}
              {vencida && <span className="ml-1 text-xs">⚠</span>}
            </>
          ),
        }
      case 'diasTranscurridos':
        return {
          className: 'p-2 text-right',
          content: diasInfo ? (
            <span className={diasInfo.esNegativo ? 'text-red-600 font-semibold' : 'text-emerald-600'}>
              {diasInfo.esNegativo ? '-' : '+'}{diasInfo.dias}
            </span>
          ) : (
            '—'
          ),
        }
      case 'estado':
        return { className: 'p-2 text-center', content: estadoBadge(f.estado) }
      case 'mesAprobacion':
        return { className: 'p-2', content: f.mesAprobacion ? normalizarMes(f.mesAprobacion) : '—' }
      default: {
        const align = THEAD_ALIGN[key] ?? ''
        const valor = CAMPO_ACCESOR[key]?.(f)
        return { className: `p-2 ${align}`, content: valor != null && valor !== '' ? valor : '—' }
      }
    }
  }

  /** Exporta a Excel el listado actualmente filtrado, según los campos configurados. */
  const exportarExcel = () => {
    if (!puedeExportar) return
    const columnasExport = ENTREGAS_ACTAS_COLUMNAS.filter((c) => exportCamposActivos.has(c.key))
    const filas = filasFiltradas.map((f) => {
      const diasInfo = calcularDiasTranscurridos(f.fechaComprometida, f.fechaReal)
      const fila: Record<string, string | number> = {}
      for (const c of columnasExport) {
        fila[c.label] = valorCampo(c.key, f, diasInfo)
      }
      return fila
    })
    const hoja = XLSX.utils.json_to_sheet(filas)
    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(libro, hoja, 'Entregas de actas')
    const fecha = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(libro, `entregas_actas_${fecha}.xlsx`)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="titulo-pagina">Entregas de Actas</h1>
          <p className="mt-1 text-sm text-slate-500">
            Entregas ordenadas de la más próxima a la más lejana.
          </p>
        </div>
        {puedeExportar && (
          <button
            onClick={exportarExcel}
            disabled={filasFiltradas.length === 0}
            title="Exporta a Excel el listado con los filtros actualmente aplicados"
            className="btn btn-exito items-center gap-1"
          >
            Exportar a Excel
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="barra-filtros">
        {filtrosActivos.has('texto') && (
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Buscar</span>
          <input
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            placeholder="REQ, SC, acta o acta de trabajo…"
            className="campo w-48"
          />
        </label>
        )}
        {filtrosActivos.has('mes') && (
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Mes de aprobación</span>
            <select
              value={filtroMes}
              onChange={(e) => setFiltroMes(e.target.value)}
              className="campo w-52"
            >
              <option value="">Todos los meses</option>
              {mesesEnBD.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
        )}
        {filtrosActivos.has('estado') && (
          <label className="text-sm">
          <span className="mb-1 block text-slate-600">Estado</span>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="campo w-52"
          >
            <option value="">Todos los estados</option>
            {estadosEnBD.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        )}
        {filtrosActivos.has('ans') && (
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">ANS</span>
          <select
            value={filtroAns}
            onChange={(e) => setFiltroAns(e.target.value)}
            className="campo w-44"
          >
            <option value="">Todos</option>
            <option value="__SIN_ANS__">Sin ANS</option>
            {ansEnBD.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        )}
        {filtrosActivos.has('fechas') && (
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">F. Comprometida</span>
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={filtroFechaDesde}
              onChange={(e) => setFiltroFechaDesde(e.target.value)}
              className="campo campo-sm"
            />
            <span className="text-xs text-slate-400">–</span>
            <input
              type="date"
              value={filtroFechaHasta}
              onChange={(e) => setFiltroFechaHasta(e.target.value)}
              className="campo campo-sm"
            />
          </div>
        </label>
        )}
        {filtrosActivos.has('reqEstado') && (
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Estado del requerimiento</span>
          <select
            value={filtroReqEstado}
            onChange={(e) => setFiltroReqEstado(e.target.value)}
            className="campo w-56"
          >
            <option value="">Todos</option>
            {reqEstadosEnBD.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        )}
        {filtrosActivos.has('squad') && (
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Squad</span>
          <select
            value={filtroSquad}
            onChange={(e) => setFiltroSquad(e.target.value)}
            className="campo w-44"
          >
            <option value="">Todos</option>
            {squadsEnBD.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        )}
        {filtrosActivos.has('tipificacion') && (
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Tipificación</span>
          <select
            value={filtroTipificacion}
            onChange={(e) => setFiltroTipificacion(e.target.value)}
            className="campo w-40"
          >
            <option value="">Todas</option>
            {tipificacionesEnBD.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        )}
        {filtrosActivos.has('garantia') && (
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">En garantía</span>
          <select
            value={filtroGarantia}
            onChange={(e) => setFiltroGarantia(e.target.value)}
            className="campo w-32"
          >
            <option value="">Todas</option>
            <option value="SI">Sí</option>
            <option value="NO">No</option>
          </select>
        </label>
        )}
        {(filtroTexto || filtroEstado || filtroAns || filtroMes || filtroFechaDesde || filtroFechaHasta || filtroReqEstado || filtroSquad || filtroTipificacion || filtroGarantia) && (
          <button
            onClick={() => {
              setFiltroTexto(''); setFiltroEstado(''); setFiltroAns(''); setFiltroMes(''); setFiltroFechaDesde(''); setFiltroFechaHasta('')
              setFiltroReqEstado(''); setFiltroSquad(''); setFiltroTipificacion(''); setFiltroGarantia('')
            }}
            className="enlace-accion enlace-accion-peligro text-xs self-end pb-2"
          >
            Limpiar
          </button>
        )}
        <span className="ml-auto text-xs text-slate-400 self-end pb-2">
          {filasFiltradas.length} entregas
        </span>
      </div>

      {error && <div className="aviso aviso-error">{error}</div>}

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-marca-osc text-white">
            <tr>
              {columnasVisibles.map((c) => (
                <th key={c.key} className={`p-2 ${THEAD_ALIGN[c.key] ?? 'text-left'}`}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={columnasVisibles.length || 1} className="p-4 text-center text-slate-400">Cargando…</td>
              </tr>
            )}
            {!cargando && filasFiltradas.length === 0 && (
              <tr>
                <td colSpan={columnasVisibles.length || 1} className="p-4 text-center text-slate-400">Sin entregas.</td>
              </tr>
            )}
            {filasFiltradas.map((f, i) => {
              const diasInfo = calcularDiasTranscurridos(f.fechaComprometida, f.fechaReal)
              const vencida = diasInfo?.esNegativo ?? false
              return (
              <tr key={`${f.codigoReq}-${f.entregaNum}-${i}`}
                className={`border-t ${vencida ? '[&>td]:bg-[#fecfcf]' : '[&>td]:hover:bg-slate-50'}`}>
                {columnasVisibles.map((c) => {
                  const { className, content } = celdaEntrega(c.key, f, diasInfo, vencida)
                  return <td key={c.key} className={className}>{content}</td>
                })}
              </tr>
              )
            })}
          </tbody>
          {!cargando && filasFiltradas.length > 0 && (() => {
            const totalHoras = filasFiltradas.reduce((s, f) => s + (f.horas ?? 0), 0)
            const filasConPct = filasFiltradas.filter((f) => f.porcentaje != null)
            const promPct = filasConPct.length
              ? Number((filasConPct.reduce((s, f) => s + f.porcentaje!, 0) / filasConPct.length).toFixed(1))
              : null
            const columnasMetricas = columnasVisibles.filter((c) => c.key === 'horas' || c.key === 'porcentaje')
            const leadCount = columnasVisibles.length - columnasMetricas.length
            return (
              <tfoot>
                <tr className="border-t-2 border-marca-osc bg-slate-50 font-semibold text-slate-700">
                  {leadCount > 0 && (
                    <td className="p-2" colSpan={leadCount}>Total ({filasFiltradas.length} entregas)</td>
                  )}
                  {columnasMetricas.map((c) => (
                    <td key={c.key} className="p-2 text-right">
                      {c.key === 'horas' ? totalHoras.toLocaleString('es-CO') : (promPct != null ? `${promPct}%` : '—')}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )
          })()}
        </table>
      </div>
    </div>
  )
}
