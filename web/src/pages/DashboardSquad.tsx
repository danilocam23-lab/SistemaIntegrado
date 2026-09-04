import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CONSOLIDADO } from '../api/client'
import { useLista } from '../api/hooks'
import { useAplicacion } from '../context/AplicacionContext'
import client from '../api/client'
import type { Aplicacion, Capacidad, Configuracion, Festivo, Persona, Requerimiento, Squad } from '../types'
import { Boton, EncabezadoPagina, FiltroDesplegable } from '../components/ui'

// Paleta de colores premium
const PALETA = {
  azul_profundo: '#0F172A',
  azul_primario: '#2563EB',
  azul_brillante: '#3B82F6',
  morado: '#7C3AED',
  verde: '#16A34A',
  naranja: '#F59E0B',
  rojo: '#DC2626',
  gris_fondo: '#F8FAFC',
  gris_borde: '#E2E8F0',
  texto: '#0F172A',
  texto_sec: '#64748B',
}

const MESES_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

interface FilaSquad {
  squadId: string | null
  squad: string
  reqs: number
  horas: number
  entregas: number
  ansActaCumple: number
  ansActaTotal: number
  ansEntregaCumple: number
  ansEntregaTotal: number
}

interface RegistroSoporteResumen {
  id: string
  Work_Order_ID: string
  Fecha_Fin_Real: string
  Horas_Estimadas: string
  Horas_Aprobadas: string
  Horas_Reales: string
}

interface ResumenSoporteResponse {
  registros: RegistroSoporteResumen[]
}

function fmtNumero(valor: number): string {
  return valor.toLocaleString('es-CO', { maximumFractionDigits: 1 })
}

function numero(valor: string | number | null | undefined): number {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0
  const texto = (valor ?? '').trim().replace(/\s/g, '')
  if (!texto) return 0
  const normalizado = texto.includes(',')
    ? texto.replace(/\./g, '').replace(',', '.')
    : texto
  const resultado = Number(normalizado)
  return Number.isFinite(resultado) ? resultado : 0
}


function mesActual(): string {
  const hoy = new Date()
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
}

function fechaKey(fechaIso: string): string {
  return fechaIso.slice(0, 10)
}

function formatearPeriodo(periodo: string): string {
  const [anio, mes] = periodo.split('-')
  const indiceMes = Number(mes) - 1
  const etiquetaMes = MESES_LABELS[indiceMes] ?? mes
  return anio && mes ? `${etiquetaMes} ${anio}` : periodo
}

function mesDesdeFecha(valor: string | null | undefined): string | null {
  const texto = (valor ?? '').trim()
  if (!texto) return null

  const iso = texto.match(/^(\d{4})[-/](\d{1,2})/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}`

  const dmy = texto.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}`

  const fecha = new Date(texto)
  if (Number.isNaN(fecha.getTime())) return null
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
}

function mesDesdeEntrega(req: Requerimiento, entrega: Requerimiento['entregas'][number]): string | null {
  return (
    mesDesdeFecha(entrega.fecha_recepcion) ??
    mesDesdeFecha(entrega.fecha_comprometida) ??
    mesDesdeFecha(entrega.fecha_aprobacion) ??
    mesDesdeFecha(entrega.fecha_cargue) ??
    mesDesdeFecha(entrega.fecha_ejecucion) ??
    mesDesdeFecha(req.fecha_inicio) ??
    mesDesdeFecha(req.fecha_solicitud_acta) ??
    mesDesdeFecha(req.solicitud?.fecha_solicitud)
  )
}


function contarDiasHabiles(mes: string, festivosMes: Set<string>): number {
  const [anioTxt, mesTxt] = mes.split('-')
  const anio = Number(anioTxt)
  const mesNumero = Number(mesTxt)
  if (!Number.isInteger(anio) || !Number.isInteger(mesNumero) || mesNumero < 1 || mesNumero > 12) {
    return 0
  }

  const ultimoDia = new Date(anio, mesNumero, 0).getDate()
  let total = 0
  for (let dia = 1; dia <= ultimoDia; dia += 1) {
    const fecha = new Date(anio, mesNumero - 1, dia)
    const dow = fecha.getDay()
    const key = `${anio}-${String(mesNumero).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
    if (dow !== 0 && dow !== 6 && !festivosMes.has(key)) total += 1
  }
  return total
}

export default function DashboardSquad() {
  const mesInicial = mesActual()
  const anoInicial = mesInicial.slice(0, 4)
  const mesInicialNumero = String(Number(mesInicial.slice(5, 7)))

  const { datos: reqs, cargando } = useLista<Requerimiento>('/requerimientos')
  const { datos: aplicaciones } = useLista<Aplicacion>('/aplicaciones')
  const { datos: personas, cargando: cargandoPersonas } = useLista<Persona>('/personas')
  const { datos: capacidades, cargando: cargandoCapacidades } = useLista<Capacidad>('/capacidades')
  const { datos: festivos, cargando: cargandoFestivos } = useLista<Festivo>('/festivos')
  const { datos: configuraciones, cargando: cargandoConfiguraciones } = useLista<Configuracion>('/configuracion')
  const { activa } = useAplicacion()
  const [anosCapacidadActivos, setAnosCapacidadActivos] = useState<Set<string>>(() => new Set([anoInicial]))
  const [mesesCapacidadActivos, setMesesCapacidadActivos] = useState<Set<string>>(() => new Set([mesInicialNumero]))
  const [squadsDoc, setSquadsDoc] = useState<Squad[]>([])
  const [soporteResumen, setSoporteResumen] = useState<RegistroSoporteResumen[]>([])
  const [mostrarDetalleWo, setMostrarDetalleWo] = useState(false)
  const [busquedaDetalleWo, setBusquedaDetalleWo] = useState('')
  const [mostrarDetallePersonas, setMostrarDetallePersonas] = useState(false)
  const [busquedaDetallePersonas, setBusquedaDetallePersonas] = useState('')

  useEffect(() => {
    client.get<Squad[]>('/squads', { headers: { 'X-Aplicacion': '__todas__' } })
      .then((r) => setSquadsDoc(r.data))
      .catch(() => {
        client.get<Squad[]>('/squads').then((r) => setSquadsDoc(r.data)).catch(() => {})
      })
  }, [])

  useEffect(() => {
    client
      .get<ResumenSoporteResponse>('/soporte/solicitudes-fabrica/resumen')
      .then((r) => setSoporteResumen(r.data.registros ?? []))
      .catch(() => setSoporteResumen([]))
  }, [])

  const requerimientos = useMemo(() => {
    if (!activa || activa === CONSOLIDADO) return reqs
    return reqs.filter((req) => req.aplicacion_id === activa || req.solicitud?.squad_id === activa)
  }, [reqs, activa])

  const appActiva = useMemo(() => {
    if (activa === CONSOLIDADO) return 'Todos los squads'
    return aplicaciones.find((app) => app.codigo === activa)?.nombre ?? activa
  }, [activa, aplicaciones])

  const resolverNombreSquad = useCallback((id: string | null): string => {
    if (!id) return 'Sin squad'
    const valor = String(id)
    const porDocId = squadsDoc.find((s) => String(s.id) === valor)
    if (porDocId) return porDocId.nombre
    const porDocNombre = squadsDoc.find((s) => s.nombre === valor)
    if (porDocNombre) return porDocNombre.nombre
    const porAppCodigo = aplicaciones.find((a) => a.codigo === valor)
    if (porAppCodigo) return porAppCodigo.nombre
    const porAppNombre = aplicaciones.find((a) => a.nombre === valor)
    if (porAppNombre) return porAppNombre.nombre
    return valor
  }, [aplicaciones, squadsDoc])

  const squadCodigoPorNombre = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const app of aplicaciones) mapa.set(app.nombre, app.codigo)
    for (const squad of squadsDoc) mapa.set(squad.nombre, String(squad.id))
    return mapa
  }, [aplicaciones, squadsDoc])

  const filas = useMemo<FilaSquad[]>(() => {
    const mapa = new Map<string, FilaSquad>()
    for (const req of requerimientos) {
      // aplicacion_id es el campo autoritativo de pertenencia al squad (consistente con el
      // filtro de squad activo). solicitud.squad_id puede estar desactualizado en datos legados
      // y no debe usarse para agrupar/mostrar cuando aplicacion_id está presente.
      const squadId = req.aplicacion_id || req.solicitud?.squad_id || null
      const squad = resolverNombreSquad(squadId)
      const key = squad
      const actual = mapa.get(key) ?? {
        squadId,
        squad,
        reqs: 0,
        horas: 0,
        entregas: 0,
        ansActaCumple: 0,
        ansActaTotal: 0,
        ansEntregaCumple: 0,
        ansEntregaTotal: 0,
      }
      actual.reqs += 1
      actual.horas += Number(req.total_horas_estimadas ?? 0)
      actual.entregas += req.entregas?.length ?? 0
      if (req.ans_acta) {
        actual.ansActaTotal += 1
        if (req.ans_acta === 'CUMPLE') actual.ansActaCumple += 1
      }
      for (const entrega of req.entregas ?? []) {
        if (!entrega.ans_entrega) continue
        actual.ansEntregaTotal += 1
        if (entrega.ans_entrega === 'CUMPLE') actual.ansEntregaCumple += 1
      }
      mapa.set(key, actual)
    }
    return Array.from(mapa.values()).sort((a, b) => b.reqs - a.reqs || b.horas - a.horas)
  }, [requerimientos, resolverNombreSquad])

  const horasMesDefault = useMemo(() => {
    const config = configuraciones.find((item) => item.clave === 'horas_mes_default')
    const valor = config ? Number(config.valor) : 180
    return Number.isFinite(valor) && valor > 0 ? valor : 180
  }, [configuraciones])

  const anosCapacidadDisponibles = useMemo(() => {
    const set = new Set<string>()
    for (const capacidad of capacidades) {
      if (capacidad.mes && capacidad.mes.length >= 4) set.add(capacidad.mes.slice(0, 4))
    }
    for (const registro of soporteResumen) {
      const mes = mesDesdeFecha(registro.Fecha_Fin_Real)
      if (mes) set.add(mes.slice(0, 4))
    }
    for (const req of requerimientos) {
      for (const entrega of req.entregas ?? []) {
        const mes = mesDesdeEntrega(req, entrega)
        if (mes) set.add(mes.slice(0, 4))
      }
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [capacidades, requerimientos, soporteResumen])

  const periodosCapacidadSeleccionados = useMemo(() => {
    const anos = anosCapacidadActivos.size > 0
      ? Array.from(anosCapacidadActivos)
      : (anosCapacidadDisponibles.length > 0 ? anosCapacidadDisponibles : [anoInicial])
    const meses = mesesCapacidadActivos.size > 0
      ? Array.from(mesesCapacidadActivos)
      : ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
    const periodos = anos.flatMap((ano) => meses.map((mes) => `${ano}-${mes.padStart(2, '0')}`))
    return Array.from(new Set(periodos)).sort()
  }, [anosCapacidadActivos, anosCapacidadDisponibles, anoInicial, mesesCapacidadActivos])

  const festivosPorMes = useMemo(() => {
    const mapa = new Map<string, Set<string>>()
    for (const festivo of festivos) {
      const keyMes = fechaKey(festivo.fecha).slice(0, 7)
      const keyDia = fechaKey(festivo.fecha)
      if (!mapa.has(keyMes)) mapa.set(keyMes, new Set<string>())
      mapa.get(keyMes)?.add(keyDia)
    }
    return mapa
  }, [festivos])

  const capacidadPorPersonaMes = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const capacidad of capacidades) {
      if (capacidad.scope === 'persona' && capacidad.persona_id && capacidad.mes) {
        mapa.set(`${capacidad.persona_id}|${capacidad.mes}`, Number(capacidad.horas_disponibles ?? 0))
      }
    }
    return mapa
  }, [capacidades])

  const filasCapacidadSquad = useMemo(() => {
    const mapa = new Map<string, { squadId: string; squad: string; horas: number; personas: number }>()

    for (const periodo of periodosCapacidadSeleccionados) {
      const festivosMesSeleccionado = festivosPorMes.get(periodo) ?? new Set<string>()
      const diasLaborables = contarDiasHabiles(periodo, new Set())
      const diasHabiles = contarDiasHabiles(periodo, festivosMesSeleccionado)
      const factorMes = diasLaborables > 0 ? diasHabiles / diasLaborables : 1
      const horasDefaultMes = horasMesDefault * factorMes

      for (const persona of personas) {
        if (!persona.activo || persona.rol_operativo === 'LT_EPM') continue
        const squadsNormalizados = (persona.squads ?? []).map((squad) => squadCodigoPorNombre.get(squad) ?? squad)
        const squadActivaNombre = activa && activa !== CONSOLIDADO ? resolverNombreSquad(activa) : ''
        const perteneceActiva =
          activa !== CONSOLIDADO &&
          !!activa &&
          (
            squadsNormalizados.length === 0 ||
            squadsNormalizados.includes(activa) ||
            (squadActivaNombre ? (persona.squads ?? []).includes(squadActivaNombre) : false)
          )

        const squadsPersona = activa !== CONSOLIDADO && activa
          ? (perteneceActiva ? [activa] : [])
          : squadsNormalizados

        for (const squadId of squadsPersona) {
          const squad = resolverNombreSquad(squadId)
          const capacidadPersona = capacidadPorPersonaMes.get(`${persona.id}|${periodo}`) ?? horasDefaultMes
          const actual = mapa.get(squadId) ?? { squadId, squad, horas: 0, personas: 0 }
          actual.horas += capacidadPersona
          actual.personas += 1
          mapa.set(squadId, actual)
        }
      }
    }

    return Array.from(mapa.values()).sort((a, b) => b.horas - a.horas || b.personas - a.personas)
  }, [
    activa,
    capacidadPorPersonaMes,
    festivosPorMes,
    horasMesDefault,
    personas,
    periodosCapacidadSeleccionados,
    squadCodigoPorNombre,
    resolverNombreSquad,
    squadsDoc,
  ])

  const detallePersonasCapacidad = useMemo(() => {
    const mapa = new Map<string, { personaId: string; nombre: string; squad: string; horas: number; personalizada: boolean; predeterminada: boolean }>()

    for (const periodo of periodosCapacidadSeleccionados) {
      const festivosMesSeleccionado = festivosPorMes.get(periodo) ?? new Set<string>()
      const diasLaborables = contarDiasHabiles(periodo, new Set())
      const diasHabiles = contarDiasHabiles(periodo, festivosMesSeleccionado)
      const factorMes = diasLaborables > 0 ? diasHabiles / diasLaborables : 1
      const horasDefaultMes = horasMesDefault * factorMes

      for (const persona of personas) {
        if (!persona.activo || persona.rol_operativo === 'LT_EPM') continue
        const squadsNormalizados = (persona.squads ?? []).map((squad) => squadCodigoPorNombre.get(squad) ?? squad)
        const squadActivaNombre = activa && activa !== CONSOLIDADO ? resolverNombreSquad(activa) : ''
        const perteneceActiva =
          activa !== CONSOLIDADO &&
          !!activa &&
          (
            squadsNormalizados.length === 0 ||
            squadsNormalizados.includes(activa) ||
            (squadActivaNombre ? (persona.squads ?? []).includes(squadActivaNombre) : false)
          )

        const squadsPersona = activa !== CONSOLIDADO && activa
          ? (perteneceActiva ? [activa] : [])
          : squadsNormalizados

        for (const squadId of squadsPersona) {
          const squad = resolverNombreSquad(squadId)
          const claveCapacidad = `${persona.id}|${periodo}`
          const tieneConfigPersonalizada = capacidadPorPersonaMes.has(claveCapacidad)
          const capacidadPersona = capacidadPorPersonaMes.get(claveCapacidad) ?? horasDefaultMes
          const key = `${persona.id}|${squadId}`
          const actual = mapa.get(key) ?? {
            personaId: persona.id,
            nombre: persona.nombre,
            squad,
            horas: 0,
            personalizada: false,
            predeterminada: false,
          }
          actual.horas += capacidadPersona
          if (tieneConfigPersonalizada) actual.personalizada = true
          else actual.predeterminada = true
          mapa.set(key, actual)
        }
      }
    }

    return Array.from(mapa.values()).sort((a, b) => b.horas - a.horas || a.nombre.localeCompare(b.nombre))
  }, [
    activa,
    capacidadPorPersonaMes,
    festivosPorMes,
    horasMesDefault,
    personas,
    periodosCapacidadSeleccionados,
    squadCodigoPorNombre,
    resolverNombreSquad,
    squadsDoc,
  ])

  const detallePersonasCapacidadFiltrado = useMemo(() => {
    const busqueda = busquedaDetallePersonas.trim().toLowerCase()
    if (!busqueda) return detallePersonasCapacidad
    return detallePersonasCapacidad.filter(
      (fila) => fila.nombre.toLowerCase().includes(busqueda) || fila.squad.toLowerCase().includes(busqueda),
    )
  }, [busquedaDetallePersonas, detallePersonasCapacidad])

  const resumenCapacidad = useMemo(() => {
    const totalHoras = filasCapacidadSquad.reduce((sum, fila) => sum + fila.horas, 0)
    const personasDisponibles = new Set<string>()
    periodosCapacidadSeleccionados.forEach((periodo) => {
      const festivosMesSeleccionado = festivosPorMes.get(periodo) ?? new Set<string>()
      const diasLaborables = contarDiasHabiles(periodo, new Set())
      const diasHabiles = contarDiasHabiles(periodo, festivosMesSeleccionado)
      const factorMes = diasLaborables > 0 ? diasHabiles / diasLaborables : 1
      const horasDefaultMes = horasMesDefault * factorMes

      for (const persona of personas) {
        if (!persona.activo || persona.rol_operativo === 'LT_EPM') continue
        const squadsNormalizados = (persona.squads ?? []).map((squad) => squadCodigoPorNombre.get(squad) ?? squad)
        const squadActivaNombre = activa && activa !== CONSOLIDADO ? resolverNombreSquad(activa) : ''
        const perteneceActiva =
          activa !== CONSOLIDADO &&
          !!activa &&
          (
            squadsNormalizados.length === 0 ||
            squadsNormalizados.includes(activa) ||
            (squadActivaNombre ? (persona.squads ?? []).includes(squadActivaNombre) : false)
          )
        const squadsPersona = activa !== CONSOLIDADO && activa
          ? (perteneceActiva ? [activa] : [])
          : squadsNormalizados
        if (squadsPersona.length === 0) continue

        const capacidadPersona = capacidadPorPersonaMes.get(`${persona.id}|${periodo}`) ?? horasDefaultMes
        if (capacidadPersona > 0) personasDisponibles.add(persona.id)
      }
    })
    const personasUnicas = personas.filter((persona) => persona.activo && persona.rol_operativo !== 'LT_EPM').length
    return { totalHoras, personasDisponibles: personasDisponibles.size, personasUnicas }
  }, [
    activa,
    capacidadPorPersonaMes,
    festivosPorMes,
    horasMesDefault,
    personas,
    periodosCapacidadSeleccionados,
    squadCodigoPorNombre,
    resolverNombreSquad,
    filasCapacidadSquad,
  ])

  const entregasPorMes = useMemo(() => {
    const periodos = new Set(periodosCapacidadSeleccionados)
    const mapa = new Map<string, { mes: string; label: string; entregas: number; horas: number }>()

    for (const req of requerimientos) {
      for (const entrega of req.entregas ?? []) {
        const mes = mesDesdeEntrega(req, entrega)
        if (!mes) continue
        if (!periodos.has(mes)) continue
        const actual = mapa.get(mes) ?? { mes, label: formatearPeriodo(mes), entregas: 0, horas: 0 }
        actual.entregas += 1
        actual.horas += Number(entrega.horas ?? 0)
        mapa.set(mes, actual)
      }
    }

    return Array.from(mapa.values()).sort((a, b) => a.mes.localeCompare(b.mes))
  }, [periodosCapacidadSeleccionados, requerimientos])

  const woSoportePorMes = useMemo(() => {
    const periodos = new Set(periodosCapacidadSeleccionados)
    const mapa = new Map<string, { mes: string; label: string; horasPorWo: Map<string, number> }>()

    for (const registro of soporteResumen) {
      const workOrder = registro.Work_Order_ID?.trim()
      const mes = mesDesdeFecha(registro.Fecha_Fin_Real)
      if (!workOrder || !mes) continue

      if (!periodos.has(mes)) continue
      const actual = mapa.get(mes) ?? { mes, label: formatearPeriodo(mes), horasPorWo: new Map<string, number>() }
      const horasAprobadas = numero(registro.Horas_Aprobadas)
      actual.horasPorWo.set(workOrder, Math.max(actual.horasPorWo.get(workOrder) ?? 0, horasAprobadas))
      mapa.set(mes, actual)
    }

    return Array.from(mapa.values())
      .map(({ horasPorWo, ...resto }) => ({
        ...resto,
        wo: horasPorWo.size,
        woHoras: Array.from(horasPorWo.values()).reduce((sum, horas) => sum + horas, 0),
      }))
      .sort((a, b) => a.mes.localeCompare(b.mes))
  }, [periodosCapacidadSeleccionados, soporteResumen])

  const detalleWoSoporte = useMemo(() => {
    const periodos = new Set(periodosCapacidadSeleccionados)
    const mapa = new Map<string, { mes: string; label: string; workOrder: string; horasAprobadas: number }>()

    for (const registro of soporteResumen) {
      const workOrder = registro.Work_Order_ID?.trim()
      const mes = mesDesdeFecha(registro.Fecha_Fin_Real)
      if (!workOrder || !mes) continue

      if (!periodos.has(mes)) continue

      const clave = `${mes}|${workOrder}`
      const horasAprobadas = numero(registro.Horas_Aprobadas)
      const actual = mapa.get(clave)
      mapa.set(clave, {
        mes,
        label: formatearPeriodo(mes),
        workOrder,
        horasAprobadas: Math.max(actual?.horasAprobadas ?? 0, horasAprobadas),
      })
    }

    return Array.from(mapa.values()).sort((a, b) => (
      a.mes.localeCompare(b.mes) || a.workOrder.localeCompare(b.workOrder)
    ))
  }, [periodosCapacidadSeleccionados, soporteResumen])

  const detalleWoSoporteFiltrado = useMemo(() => {
    const busqueda = busquedaDetalleWo.trim().toLowerCase()
    if (!busqueda) return detalleWoSoporte
    return detalleWoSoporte.filter((fila) => fila.workOrder.toLowerCase().includes(busqueda))
  }, [busquedaDetalleWo, detalleWoSoporte])

  const horasEntregasFiltradas = useMemo(() => {
    const totalHoras = entregasPorMes.reduce((sum, item) => sum + item.horas, 0)
    const totalEntregas = entregasPorMes.reduce((sum, item) => sum + item.entregas, 0)
    const promedioHoras = totalEntregas > 0 ? totalHoras / totalEntregas : 0
    return { totalHoras, totalEntregas, promedioHoras }
  }, [entregasPorMes])

  const horasWoFiltradas = useMemo(() => {
    const totalHoras = woSoportePorMes.reduce((sum, item) => sum + item.woHoras, 0)
    const totalWo = woSoportePorMes.reduce((sum, item) => sum + item.wo, 0)
    const promedioHoras = totalWo > 0 ? totalHoras / totalWo : 0
    return { totalHoras, totalWo, promedioHoras }
  }, [woSoportePorMes])

  const totalHorasEntregasWo = horasEntregasFiltradas.totalHoras + horasWoFiltradas.totalHoras

  const kpis = useMemo(() => {
    const top = filas[0]
    return {
      totalSquads: filas.length,
      topNombre: top?.squad ?? '—',
      topCantidad: top?.reqs ?? 0,
    }
  }, [filas, requerimientos.length])

  if (cargando || cargandoPersonas || cargandoCapacidades || cargandoFestivos || cargandoConfiguraciones) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <div className="mb-6 flex justify-center">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-600 animate-spin" />
            </div>
          </div>
          <p className="text-lg font-semibold text-slate-900">Cargando dashboard</p>
          <p className="text-sm text-slate-500 mt-2">Obteniendo datos del equipo…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header Premium */}
      <EncabezadoPagina
        icono="📊"
        titulo="Backlog"
        descripcion={`Métricas de capacidad y requerimientos en tiempo real${
          appActiva && appActiva !== CONSOLIDADO ? ` · ${appActiva}` : ' · Todos los squads'
        }`}
        acciones={
          <>
            <FiltroDesplegable
              label="Año"
              icono="📅"
              opciones={anosCapacidadDisponibles}
              activos={anosCapacidadActivos}
              setActivos={setAnosCapacidadActivos}
              valorInicial={anoInicial}
            />
            <FiltroDesplegable
              label="Mes"
              icono="🗓️"
              opciones={MESES_LABELS}
              activos={mesesCapacidadActivos}
              setActivos={setMesesCapacidadActivos}
              esMes
              valorInicial={mesInicialNumero}
              anchoPanel="240px"
            />
            <Boton
              variante="secundario"
              onClick={() => {
                setAnosCapacidadActivos(new Set([anoInicial]))
                setMesesCapacidadActivos(new Set([mesInicialNumero]))
              }}
            >
              Restablecer
            </Boton>
          </>
        }
      />

      {/* Main Content */}
      <div className="pagina">
        {/* KPI Grid - Premium Design */}
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 mb-8">
          <KpiCardPremium
            icon="📊"
            label="Squads Activos"
            value={kpis.totalSquads}
            subtext="con requerimientos"
            color="blue"
            trend={kpis.totalSquads > 0 ? '+5%' : '0%'}
          />
          <KpiCardPremium
            icon="🏆"
            label="Backlog Principal"
            value={kpis.topNombre}
            subtext={`${kpis.topCantidad} requerimientos`}
            color="purple"
          />
          <KpiCardPremium
            icon="⏱️"
            label="Horas de entregas"
            value={`${fmtNumero(horasEntregasFiltradas.totalHoras)}h`}
            subtext={`Promedio: ${fmtNumero(horasEntregasFiltradas.promedioHoras)}h • ${fmtNumero(horasEntregasFiltradas.totalEntregas)} entregas`}
            color="amber"
          />
          <KpiCardPremium
            icon="🧾"
            label="Horas aprobadas WO"
            value={`${fmtNumero(horasWoFiltradas.totalHoras)}h`}
            subtext={`Promedio: ${fmtNumero(horasWoFiltradas.promedioHoras)}h • ${fmtNumero(horasWoFiltradas.totalWo)} WO`}
            color="blue"
          />
          <KpiCardPremium
            icon="Σ"
            label="Total horas"
            value={`${fmtNumero(totalHorasEntregasWo)}h`}
            subtext="Horas de entregas + horas aprobadas WO"
            color="purple"
          />
          <KpiCardPremium
            icon="👥"
            label="Equipo Disponible"
            value={resumenCapacidad.personasDisponibles}
            subtext={`${resumenCapacidad.personasUnicas} personas únicas • sin LT_EPM • ${fmtNumero(resumenCapacidad.totalHoras)}h capacidad`}
            color="green"
          />
        </div>

        {/* Charts Section */}
        <div className="space-y-6">
          <ChartCardPremium titulo="Entregas por mes" descripcion="Cantidad de entregas y horas de entregas por periodo seleccionado">
            {entregasPorMes.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height={460}>
                <BarChart data={entregasPorMes} margin={{ left: 20, right: 40, top: 60, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={PALETA.gris_borde} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: PALETA.texto_sec }}
                    angle={-20}
                    textAnchor="end"
                    height={60}
                    interval={0}
                  />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: PALETA.texto_sec }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: PALETA.texto_sec }} />
                  <Tooltip content={<TooltipPersonalizado />} />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ top: 0 }} />
                  <Bar yAxisId="left" dataKey="entregas" name="Entregas" fill="#7C3AED" radius={[8, 8, 0, 0]} barSize={16}>
                    <LabelList
                      dataKey="entregas"
                      position="top"
                      formatter={(valor: unknown) => String(Number(valor ?? 0))}
                      fill={PALETA.texto}
                      fontSize={11}
                      fontWeight={600}
                    />
                  </Bar>
                  <Bar yAxisId="right" dataKey="horas" name="Horas entregas" fill="#2563EB" radius={[8, 8, 0, 0]} barSize={16}>
                    <LabelList
                      dataKey="horas"
                      position="top"
                      formatter={(valor: unknown) => `${fmtNumero(Number(valor ?? 0))}h`}
                      fill={PALETA.texto}
                      fontSize={11}
                      fontWeight={600}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCardPremium>

          <ChartCardPremium
            titulo="WO por mes"
            descripcion="Eje X: mes · Eje Y: cantidad de WO y suma de Horas_Aprobadas"
            action={
              detalleWoSoporte.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setBusquedaDetalleWo('')
                    setMostrarDetalleWo(true)
                  }}
                  className="btn btn-secundario btn-sm"
                >
                  Ver detalle
                </button>
              ) : null
            }
          >
            {woSoportePorMes.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height={460}>
                <BarChart data={woSoportePorMes} margin={{ left: 20, right: 40, top: 60, bottom: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={PALETA.gris_borde} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: PALETA.texto_sec }}
                    angle={-20}
                    textAnchor="end"
                    height={60}
                    interval={0}
                  />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: PALETA.texto_sec }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: PALETA.texto_sec }} />
                  <Tooltip content={<TooltipPersonalizado />} />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ top: 0 }} />
                  <Bar yAxisId="left" dataKey="wo" name="Cantidad WO" fill="#16A34A" radius={[8, 8, 0, 0]} barSize={18}>
                    <LabelList
                      dataKey="wo"
                      position="top"
                      formatter={(valor: unknown) => String(Number(valor ?? 0))}
                      fill={PALETA.texto}
                      fontSize={11}
                      fontWeight={600}
                    />
                  </Bar>
                  <Bar yAxisId="right" dataKey="woHoras" name="Horas aprobadas" fill="#F59E0B" radius={[8, 8, 0, 0]} barSize={18}>
                    <LabelList
                      dataKey="woHoras"
                      position="top"
                      formatter={(valor: unknown) => `${fmtNumero(Number(valor ?? 0))}h`}
                      fill={PALETA.texto}
                      fontSize={11}
                      fontWeight={600}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCardPremium>

          <ChartCardPremium
            titulo="Capacidad por Squad"
            descripcion={`Distribución de horas disponibles · ${periodosCapacidadSeleccionados.length} periodo(s) · Festivos: ${festivosPorMes.size}`}
            action={
              detallePersonasCapacidad.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setBusquedaDetallePersonas('')
                    setMostrarDetallePersonas(true)
                  }}
                  className="btn btn-secundario btn-sm"
                >
                  Ver detalle
                </button>
              ) : null
            }
          >
            {filasCapacidadSquad.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={filasCapacidadSquad} layout="vertical" margin={{ left: 140, right: 60, top: 20, bottom: 20 }}>
                  <defs>
                    <linearGradient id="gradientBar" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#2563EB" stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={PALETA.gris_borde} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12, fill: PALETA.texto_sec }} />
                  <YAxis
                    type="category"
                    dataKey="squad"
                    width={130}
                    tick={{ fontSize: 12, fill: PALETA.texto_sec }}
                  />
                  <Tooltip content={<TooltipPersonalizado />} />
                  <Bar dataKey="horas" fill="url(#gradientBar)" radius={[0, 12, 12, 0]} barSize={32}>
                    <LabelList
                      dataKey="horas"
                      position="right"
                      formatter={(valor: unknown) => `${fmtNumero(Number(valor ?? 0))}h`}
                      fill={PALETA.texto}
                      fontSize={13}
                      fontWeight={600}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCardPremium>

          {/* Table Section */}
          <ChartCardPremium titulo="Detalle Completo por Squad" descripcion="Resumen de métricas y cumplimiento">
            {filas.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100/50">
                      <th className="px-6 py-4 text-left font-semibold text-slate-900">Squad</th>
                      <th className="px-6 py-4 text-center font-semibold text-slate-900">Reqs</th>
                      <th className="px-6 py-4 text-center font-semibold text-slate-900">Horas</th>
                      <th className="px-6 py-4 text-center font-semibold text-slate-900">Entregas</th>
                      <th className="px-6 py-4 text-center font-semibold text-slate-900">ANS Acta</th>
                      <th className="px-6 py-4 text-center font-semibold text-slate-900">ANS Entrega</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filas.map((fila) => (
                      <tr
                        key={fila.squad}
                        className="hover:bg-blue-50/40 transition-colors duration-200 group"
                      >
                        <td className="px-6 py-4 font-semibold text-slate-900 group-hover:text-blue-700">{fila.squad}</td>
                        <td className="px-6 py-4 text-center">
                          <Badge variant="blue" value={fila.reqs} />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Badge variant="amber" value={`${fmtNumero(fila.horas)}h`} />
                        </td>
                        <td className="px-6 py-4 text-center text-slate-700 font-medium">{fmtNumero(fila.entregas)}</td>
                        <td className="px-6 py-4 text-center">
                          <ProgressBadge percentage={Math.round((fila.ansActaCumple / (fila.ansActaTotal || 1)) * 100)} />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <ProgressBadge percentage={Math.round((fila.ansEntregaCumple / (fila.ansEntregaTotal || 1)) * 100)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ChartCardPremium>
        </div>
      </div>

      {mostrarDetalleWo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="titulo-seccion">Detalle WO por mes</h2>
                <p className="mt-1 text-sm text-slate-500">WO individuales y Horas_Aprobadas por periodo seleccionado.</p>
              </div>
              <button
                type="button"
                onClick={() => setMostrarDetalleWo(false)}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Cerrar detalle WO por mes"
              >
                ✕
              </button>
            </div>

            <div className="border-b border-slate-100 px-6 py-4">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="buscar-wo-detalle">
                Buscar por WO
              </label>
              <input
                id="buscar-wo-detalle"
                type="search"
                value={busquedaDetalleWo}
                onChange={(event) => setBusquedaDetalleWo(event.target.value)}
                placeholder="Ej: WO12345"
                className="campo mt-2 w-full"
              />
            </div>

            <div className="max-h-[62vh] overflow-auto p-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-left font-semibold text-slate-900">Mes</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-900">Work Order ID</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-900">Horas aprobadas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detalleWoSoporteFiltrado.map((fila) => (
                    <tr key={`${fila.mes}-${fila.workOrder}`} className="hover:bg-blue-50/40">
                      <td className="px-4 py-3 font-medium text-slate-800">{fila.label}</td>
                      <td className="px-4 py-3 font-semibold text-green-700">{fila.workOrder}</td>
                      <td className="px-4 py-3 text-right font-semibold text-amber-700">{fmtNumero(fila.horasAprobadas)}h</td>
                    </tr>
                  ))}
                  {detalleWoSoporteFiltrado.length === 0 && (
                    <tr>
                      <td className="px-4 py-8 text-center text-sm text-slate-400" colSpan={3}>
                        No se encontraron WO con esa búsqueda.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-900">
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3">{fmtNumero(detalleWoSoporteFiltrado.length)} WO</td>
                    <td className="px-4 py-3 text-right">
                      {fmtNumero(detalleWoSoporteFiltrado.reduce((sum, fila) => sum + fila.horasAprobadas, 0))}h
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {mostrarDetallePersonas && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="titulo-seccion">Detalle capacidad por persona</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Horas configuradas por persona y squad · {periodosCapacidadSeleccionados.length} periodo(s) seleccionados.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMostrarDetallePersonas(false)}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Cerrar detalle de capacidad por persona"
              >
                ✕
              </button>
            </div>

            <div className="border-b border-slate-100 px-6 py-4">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="buscar-persona-detalle">
                Buscar por persona o squad
              </label>
              <input
                id="buscar-persona-detalle"
                type="search"
                value={busquedaDetallePersonas}
                onChange={(event) => setBusquedaDetallePersonas(event.target.value)}
                placeholder="Ej: José Danilo"
                className="campo mt-2 w-full"
              />
            </div>

            <div className="max-h-[62vh] overflow-auto p-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-left font-semibold text-slate-900">Persona</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-900">Squad</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-900">Horas</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-900">Origen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detallePersonasCapacidadFiltrado.map((fila) => (
                    <tr key={`${fila.personaId}-${fila.squad}`} className="hover:bg-blue-50/40">
                      <td className="px-4 py-3 font-medium text-slate-800">{fila.nombre}</td>
                      <td className="px-4 py-3 text-slate-600">{fila.squad}</td>
                      <td className="px-4 py-3 text-right font-semibold text-amber-700">{fmtNumero(fila.horas)}h</td>
                      <td className="px-4 py-3 text-center">
                        {fila.personalizada ? (
                          <Badge variant="blue" value={fila.predeterminada ? 'Mixto' : 'Configurada'} />
                        ) : (
                          <Badge variant="green" value="Por defecto" />
                        )}
                      </td>
                    </tr>
                  ))}
                  {detallePersonasCapacidadFiltrado.length === 0 && (
                    <tr>
                      <td className="px-4 py-8 text-center text-sm text-slate-400" colSpan={4}>
                        No se encontraron personas con esa búsqueda.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-900">
                    <td className="px-4 py-3" colSpan={2}>Total</td>
                    <td className="px-4 py-3 text-right">
                      {fmtNumero(detallePersonasCapacidadFiltrado.reduce((sum, fila) => sum + fila.horas, 0))}h
                    </td>
                    <td className="px-4 py-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCardPremium({
  icon,
  label,
  value,
  subtext,
  color,
  trend,
}: {
  icon: string
  label: string
  value: string | number
  subtext?: string
  color: 'blue' | 'purple' | 'amber' | 'green'
  trend?: string
}) {
  const colors = {
    blue: {
      bg: 'from-blue-600 to-blue-700',
      light: 'bg-blue-50',
      text: 'text-blue-900',
      border: 'border-blue-200',
    },
    purple: {
      bg: 'from-purple-600 to-purple-700',
      light: 'bg-purple-50',
      text: 'text-purple-900',
      border: 'border-purple-200',
    },
    amber: {
      bg: 'from-amber-500 to-amber-600',
      light: 'bg-amber-50',
      text: 'text-amber-900',
      border: 'border-amber-200',
    },
    green: {
      bg: 'from-green-600 to-green-700',
      light: 'bg-green-50',
      text: 'text-green-900',
      border: 'border-green-200',
    },
  }

  const theme = colors[color]

  return (
    <div className="group relative min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-lg hover:border-slate-300 transition-all duration-300">
      <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-5 transition-opacity duration-300" />

      <div className="relative p-5 2xl:p-6">
        <div className="flex items-start justify-between mb-4">
          <div className={`shrink-0 text-3xl 2xl:text-4xl p-3 rounded-xl ${theme.light}`}>{icon}</div>
          {trend && (
            <div className="shrink-0 text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
              {trend}
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-1">
          <div className="text-sm font-medium text-slate-600 uppercase tracking-wider">{label}</div>
          <div className={`break-words text-2xl font-bold ${theme.text} 2xl:text-3xl`}>{value}</div>
          {subtext && <div className="mt-2 break-words text-xs text-slate-500">{subtext}</div>}
        </div>
      </div>
    </div>
  )
}

function ChartCardPremium({
  titulo,
  descripcion,
  action,
  children,
}: {
  titulo: string
  descripcion?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">{titulo}</h3>
          {descripcion && <p className="text-sm text-slate-500 mt-1">{descripcion}</p>}
        </div>
        {action}
      </div>
      <div className="relative">{children}</div>
    </div>
  )
}

function Badge({ variant, value }: { variant: 'blue' | 'amber' | 'green' | 'red'; value: string | number }) {
  const variants = {
    blue: 'bg-blue-100 text-blue-700',
    amber: 'bg-amber-100 text-amber-700',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
  }

  return (
    <span className={`inline-flex items-center px-3 py-2 rounded-lg font-semibold text-sm ${variants[variant]}`}>
      {value}
    </span>
  )
}

function ProgressBadge({ percentage }: { percentage: number }) {
  let color = 'bg-red-100 text-red-700'
  if (percentage >= 75) color = 'bg-green-100 text-green-700'
  else if (percentage >= 50) color = 'bg-amber-100 text-amber-700'

  return (
    <div className="flex items-center gap-2 justify-center">
      <span className={`inline-block px-3 py-1.5 rounded-lg font-semibold text-sm ${color}`}>
        {percentage}%
      </span>
    </div>
  )
}

function TooltipPersonalizado({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    const value = payload[0].value

    return (
      <div className="rounded-lg bg-slate-900 p-3 shadow-xl border border-slate-700">
        <p className="text-sm font-semibold text-slate-100">
          {data.squad || 'Valor'}
        </p>
        <p className="text-base font-bold text-blue-300 mt-1">
          {typeof value === 'number' ? fmtNumero(value) : value}{payload[0].dataKey === 'horas' ? 'h' : ''}
        </p>
      </div>
    )
  }
  return null
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="text-6xl mb-4 opacity-20">📭</div>
      <p className="text-slate-600 font-semibold">Sin datos disponibles</p>
      <p className="text-slate-400 text-sm mt-1">No hay información para mostrar en este período</p>
    </div>
  )
}
