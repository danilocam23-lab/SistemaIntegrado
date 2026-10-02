// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

/**
 * Lógica pura (sin React) del Roadmap: lectura de requerimientos a fechas
 * dibujables, rango de meses, agrupación por persona/categoría y carga.
 */

import { ESTADO_ACTIVO } from '../asignaciones/tipos'
import {
  diaSiguiente, etiquetaIndiceMes, indiceMes, parseFechaLocal, primerDiaDeIndice,
} from './fechas'
import type {
  AsignacionRoadmap, CategoriaRoadmap, ColumnaMes, PersonaRoadmap, RequerimientoRoadmap, GrupoCategoria, GrupoRoadmap, HitoEntrega, PresetRango, RangoRoadmap, ReqRoadmap, TonoHito,
} from './tipos'

export const SIN_ASIGNAR_ID = '__sin_asignar__'
export const TODOS_ID = '__todos__'
const PLANO_ID = '__plano__'
/** Literal de `ESTADOS_ENTREGA` / `ESTADOS_REQUERIMIENTO` (constantes.ts). */
const ESTADO_ENTREGA_CARGADA = 'ENTREGA CARGADA'
const SIN_CATEGORIA_ID = '__sin_cat__'
/** Gris de categoría desconocida (más oscuro que el anterior para que el texto blanco se lea). */
export const COLOR_SIN_CATEGORIA = '#64748b'

/** Estados en los que el requerimiento ya no se espera entregar: nunca cuenta como vencido. */
function esNoVigente(estado: string): boolean {
  const e = estado.toUpperCase()
  return (
    // Entrega ya cargada: el compromiso se cumplió, no está vencido aunque aún falte la aprobación.
    e === ESTADO_ENTREGA_CARGADA ||
    e.includes('CANCELADO') || e.includes('REEMPLAZADO') || e.includes('SUSPENDIDO') || e.includes('DEVUELTO')
    // Cerrados: no existen hoy en ESTADOS_REQUERIMIENTO, pero se cubren por si se añaden.
    || e.includes('FACTURAD') || e.includes('FINALIZAD') || e.includes('CERRAD') || e.includes('COMPLETAD')
    || e.includes('TERMINAD')
  )
}

function tonoDeEntrega(estado: string | null, aprobacion: string | null, fecha: Date, hoy: Date): TonoHito {
  if (estado === 'APROBADA' || aprobacion) return 'ok'
  // Cargada (pendiente de aprobación): no cuenta como vencida; queda como pendiente.
  if (estado === ESTADO_ENTREGA_CARGADA) return 'pend'
  return fecha.getTime() < hoy.getTime() ? 'bad' : 'pend'
}

export interface BaseRoadmap {
  dibujables: ReqRoadmap[]
  /** Requerimientos sin fecha de solicitud del acta ni de inicio: no se pueden dibujar. */
  sinFecha: RequerimientoRoadmap[]
  /** Primer y último mes (índice) con alguna fecha; `null` si no hay ninguna. */
  primerIndice: number | null
  ultimoIndice: number | null
}

/** Lee los requerimientos a barras con hitos. Inicio = acta o inicio; fin = última entrega comprometida. */
export function construirBase(
  requerimientos: RequerimientoRoadmap[],
  categorias: Map<string, CategoriaRoadmap>,
  hoy: Date,
): BaseRoadmap {
  const dibujables: ReqRoadmap[] = []
  const sinFecha: RequerimientoRoadmap[] = []
  let primero: number | null = null
  let ultimo: number | null = null

  for (const req of requerimientos) {
    const inicio = parseFechaLocal(req.fecha_solicitud_acta) ?? parseFechaLocal(req.fecha_inicio)
    if (!inicio) {
      sinFecha.push(req)
      continue
    }
    const hitos: HitoEntrega[] = []
    let entregasSinFecha = 0
    for (const entrega of req.entregas ?? []) {
      const fecha = parseFechaLocal(entrega.fecha_comprometida)
      if (!fecha) {
        entregasSinFecha += 1
        continue
      }
      hitos.push({
        numero: entrega.numero,
        fecha,
        tono: tonoDeEntrega(entrega.estado, entrega.fecha_aprobacion, fecha, hoy),
        estado: entrega.estado,
      })
    }
    hitos.sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
    const ultimaEntrega = hitos.length > 0 ? hitos[hitos.length - 1].fecha : inicio
    const fin = ultimaEntrega.getTime() > inicio.getTime() ? ultimaEntrega : inicio
    const categoria = req.categoria_id ? categorias.get(req.categoria_id) : undefined

    dibujables.push({
      req,
      inicio,
      fin,
      hitos,
      entregasSinFecha,
      vencido: !esNoVigente(req.estado) && hitos.some((h) => h.tono === 'bad'),
      categoriaNombre: categoria?.nombre ?? 'Sin categoría',
      color: categoria?.color ?? COLOR_SIN_CATEGORIA,
    })

    const desde = indiceMes(inicio)
    const hasta = indiceMes(fin)
    // También cuentan las fechas de `fecha_fin` para el límite del rango "Todo" (igual que antes).
    const finDeclarado = parseFechaLocal(req.fecha_fin)
    const hastaTotal = finDeclarado ? Math.max(hasta, indiceMes(finDeclarado)) : hasta
    primero = primero === null ? desde : Math.min(primero, desde)
    ultimo = ultimo === null ? hastaTotal : Math.max(ultimo, hastaTotal)
  }
  return { dibujables, sinFecha, primerIndice: primero, ultimoIndice: ultimo }
}

/* ── Rango de meses ─────────────────────────────────────────────── */

export interface RangoPersonalizado {
  desde: number
  hasta: number
}

/** Índices (desde, hasta) de un atajo. "Todo" = 2 meses antes de hoy hasta el último mes con fecha. */
export function indicesDePreset(
  preset: PresetRango,
  hoy: Date,
  ultimoIndice: number | null,
  personalizado: RangoPersonalizado,
): RangoPersonalizado {
  const h = indiceMes(hoy)
  if (preset === '3') return { desde: h, hasta: h + 2 }
  if (preset === '6') return { desde: h - 2, hasta: h + 3 }
  if (preset === 'personalizado') return personalizado
  const desde = h - 2
  const hasta = Math.max(desde, ultimoIndice ?? desde + 13)
  return { desde, hasta: Math.min(hasta, desde + MAX_MESES_TODO - 1) }
}

/** El rango "Todo" se recorta a este máximo de meses (evita cientos de columnas por una fecha absurda). */
export const MAX_MESES_TODO = 36

/** `true` si el rango "Todo" dejó fuera meses con fechas por superar el máximo. */
export function rangoTodoRecortado(hoy: Date, ultimoIndice: number | null): boolean {
  return ultimoIndice !== null && ultimoIndice > indiceMes(hoy) - 2 + MAX_MESES_TODO - 1
}

export function construirRango(desdeIndice: number, hastaIndice: number, hoy: Date): RangoRoadmap {
  const desde = Math.min(desdeIndice, hastaIndice)
  const hasta = Math.max(desdeIndice, hastaIndice)
  const inicio = primerDiaDeIndice(desde)
  const fin = primerDiaDeIndice(hasta + 1)
  const total = fin.getTime() - inicio.getTime()
  const actual = indiceMes(hoy)
  const columnas: ColumnaMes[] = []
  for (let i = desde; i <= hasta; i++) {
    const dias = primerDiaDeIndice(i + 1).getTime() - primerDiaDeIndice(i).getTime()
    columnas.push({ indice: i, etiqueta: etiquetaIndiceMes(i), ancho: (dias / total) * 100, esActual: i === actual })
  }
  return { inicio, fin, columnas, desdeIndice: desde, hastaIndice: hasta }
}

/** Posición (0-100 %) de una fecha dentro del rango, acotada a los bordes. */
export function posicionPct(fecha: Date, rango: RangoRoadmap): number {
  const total = rango.fin.getTime() - rango.inicio.getTime()
  const valor = ((fecha.getTime() - rango.inicio.getTime()) / total) * 100
  return Math.max(0, Math.min(100, valor))
}

export function fechaEnRango(fecha: Date, rango: RangoRoadmap): boolean {
  return fecha.getTime() >= rango.inicio.getTime() && fecha.getTime() < rango.fin.getTime()
}

/** El requerimiento se solapa con el rango si su barra (inicio → fin, inclusive) lo toca. */
export function seSolapaConRango(r: ReqRoadmap, rango: RangoRoadmap): boolean {
  return r.inicio.getTime() < rango.fin.getTime() && diaSiguiente(r.fin).getTime() > rango.inicio.getTime()
}

export interface GeometriaBarra {
  izquierda: number
  ancho: number
}

export function geometriaBarra(r: ReqRoadmap, rango: RangoRoadmap): GeometriaBarra {
  const izquierda = posicionPct(r.inicio, rango)
  const derecha = posicionPct(diaSiguiente(r.fin), rango)
  return { izquierda, ancho: Math.max(derecha - izquierda, 1.4) }
}

/* ── Carga por persona ──────────────────────────────────────────── */

/**
 * Carga vigente en % por persona: misma regla que el medidor de Asignaciones y
 * Capacidades (cuenta lo asignado a requerimientos activos o sin requerimiento).
 */
export function calcularCargaPorPersona(
  asignaciones: AsignacionRoadmap[],
  requerimientos: RequerimientoRoadmap[],
): Map<string, number> {
  const activos = new Set<string>()
  for (const req of requerimientos) {
    if (req.estado === ESTADO_ACTIVO) activos.add(req.id)
  }
  const mapa = new Map<string, number>()
  for (const asig of asignaciones) {
    const reqIds = asig.proyectos.map((p) => p.requerimiento_id).filter(Boolean)
    const esActiva = reqIds.some((id) => id && activos.has(id))
    if (esActiva || reqIds.length === 0) {
      mapa.set(asig.persona_id, (mapa.get(asig.persona_id) ?? 0) + asig.total_porcentaje)
    }
  }
  return mapa
}

/* ── Agrupación ─────────────────────────────────────────────────── */

export function idsDePersonas(req: RequerimientoRoadmap): string[] {
  const ids = new Set<string>()
  for (const id of req.developers_asignados ?? []) {
    if (id) ids.add(id)
  }
  if (req.solicitud?.lt_hitss_id) ids.add(req.solicitud.lt_hitss_id)
  return Array.from(ids)
}

function construirCategorias(
  reqs: ReqRoadmap[],
  porcentajeDe: (categoriaId: string) => number,
): GrupoCategoria[] {
  const mapa = new Map<string, GrupoCategoria>()
  for (const r of reqs) {
    const id = r.req.categoria_id ?? SIN_CATEGORIA_ID
    let grupo = mapa.get(id)
    if (!grupo) {
      grupo = {
        id, nombre: r.categoriaNombre, color: r.color,
        porcentaje: id === SIN_CATEGORIA_ID ? 0 : porcentajeDe(id), reqs: [],
      }
      mapa.set(id, grupo)
    }
    grupo.reqs.push(r)
  }
  const lista = Array.from(mapa.values())
  lista.forEach((g) => g.reqs.sort((a, b) => a.inicio.getTime() - b.inicio.getTime()))
  return lista.sort((a, b) => b.porcentaje - a.porcentaje || a.nombre.localeCompare(b.nombre, 'es'))
}

function armarGrupo(
  base: Pick<GrupoRoadmap, 'id' | 'nombre' | 'rol' | 'inactiva' | 'sinAsignar' | 'plano' | 'carga'>,
  reqs: ReqRoadmap[],
  porcentajeDe: (categoriaId: string) => number,
): GrupoRoadmap {
  return {
    ...base,
    categorias: construirCategorias(reqs, porcentajeDe),
    totalReqs: reqs.length,
    totalEntregas: reqs.reduce((suma, r) => suma + r.hitos.length, 0),
  }
}

/** Todos los requerimientos en un solo grupo, por categoría. */
export function agruparPlano(reqs: ReqRoadmap[]): GrupoRoadmap[] {
  if (reqs.length === 0) return []
  const grupo = armarGrupo(
    { id: PLANO_ID, nombre: 'Todos los requerimientos', rol: 'SIN AGRUPACIÓN', inactiva: false, sinAsignar: false, plano: true, carga: null },
    reqs,
    () => 0,
  )
  grupo.categorias.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  return [grupo]
}

/**
 * Un grupo por persona (activas primero, luego «Sin asignar» y al final las
 * inactivas, que antes desaparecían junto con sus requerimientos).
 * `cargas` es `null` cuando Asignaciones no se pudo leer (la carga queda N/D).
 */
export function agruparPorPersona(
  reqs: ReqRoadmap[],
  personas: PersonaRoadmap[],
  asignaciones: AsignacionRoadmap[],
  cargas: Map<string, number> | null,
  filtroPersona: string,
): GrupoRoadmap[] {
  const personaPorId = new Map(personas.map((p) => [p.id, p]))
  const porPersona = new Map<string, ReqRoadmap[]>()
  const agregar = (id: string, r: ReqRoadmap) => {
    const lista = porPersona.get(id)
    if (lista) lista.push(r)
    else porPersona.set(id, [r])
  }

  for (const r of reqs) {
    const conocidos = idsDePersonas(r.req).filter((id) => personaPorId.has(id))
    if (conocidos.length === 0) {
      agregar(SIN_ASIGNAR_ID, r)
      continue
    }
    conocidos.forEach((id) => agregar(id, r))
  }

  const pctAsignado = (personaId: string) => (categoriaId: string) =>
    asignaciones
      .filter((a) => a.persona_id === personaId && a.categoria_id === categoriaId)
      .reduce((suma, a) => suma + a.total_porcentaje, 0)

  const grupos: GrupoRoadmap[] = []
  for (const [id, lista] of porPersona) {
    if (filtroPersona !== TODOS_ID && id !== filtroPersona) continue
    if (id === SIN_ASIGNAR_ID) {
      grupos.push(armarGrupo(
        { id, nombre: 'Sin asignar', rol: 'SIN ASIGNAR', inactiva: false, sinAsignar: true, plano: false, carga: null },
        lista,
        () => 0,
      ))
      continue
    }
    const persona = personaPorId.get(id)
    if (!persona) continue
    grupos.push(armarGrupo(
      {
        id,
        nombre: persona.nombre,
        rol: persona.activo ? persona.rol_operativo : `${persona.rol_operativo} · inactiva`,
        inactiva: !persona.activo,
        sinAsignar: false,
        plano: false,
        carga: persona.activo && cargas ? (cargas.get(id) ?? 0) : null,
      },
      lista,
      pctAsignado(id),
    ))
  }

  const rango = (g: GrupoRoadmap) => (g.inactiva ? 2 : g.sinAsignar ? 1 : 0)
  return grupos.sort((a, b) => rango(a) - rango(b) || a.nombre.localeCompare(b.nombre, 'es'))
}
