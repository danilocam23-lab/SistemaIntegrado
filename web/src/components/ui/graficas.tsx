import type { ReactElement, ReactNode } from 'react'
import { ResponsiveContainer } from 'recharts'

/* ═══════════════════════════════════════════════════════════════
   MÓDULO DE GRÁFICAS DEL SISTEMA DE DISEÑO
   Colores, fábricas de props y contenedores compartidos para todas
   las gráficas Recharts de la aplicación. Se importa con ruta
   explícita: import { ContenedorGrafica } from '../components/ui/graficas'
   (NO se re-exporta desde components/ui/index.ts).
   ═══════════════════════════════════════════════════════════════ */

/* ── Colores ───────────────────────────────────────────────────── */

/**
 * Paleta semántica de gráficas. `ok` / `alerta` / `malo` SOLO codifican
 * bueno / riesgo / incumplido; nunca se usan para distinguir series entre sí.
 */
export const COLOR_GRAFICA = {
  eje: '#64748b', // slate-500  · ticks de XAxis / YAxis
  rejilla: '#e2e8f0', // slate-200  · CartesianGrid
  texto: '#0f172a', // slate-900  · LabelList y titulo de tooltip
  textoSuave: '#475569', // slate-600  · LabelList sobre barra
  serie: '#1e5fa8', // marca-600  · serie primaria
  ok: '#16a34a', // green-600  · cumple / bueno
  alerta: '#d97706', // amber-600  · riesgo / en observacion
  malo: '#dc2626', // red-600    · incumplido / cancelado
} as const

/**
 * Colores para series que solo necesitan distinguirse entre sí (no semánticas).
 * Nunca verde ni rojo: esos quedan reservados a `COLOR_GRAFICA.ok` / `.malo`.
 */
export const PALETA_SERIES = [
  '#1e5fa8', // marca-600
  '#7fb0e4', // marca-300
  '#0f3a6b', // marca-900
  '#2c72bd', // marca-500
  '#123a68', // marca-800
  '#aecdef', // marca-200
] as const

/* ── Fábricas de props (para *spread* sobre elementos de Recharts) ── */

function tickEje(tam: number) {
  return { tick: { fontSize: tam, fill: COLOR_GRAFICA.eje } }
}

/** Props para un eje de categorías (texto). */
export function ejeCategoria(tam: 10 | 11 | 12 = 11) {
  return tickEje(tam)
}

/** Props para un eje de valores numéricos (sin decimales). */
export function ejeValor(tam = 11) {
  return { ...tickEje(tam), allowDecimals: false }
}

/** Props para un eje en porcentaje fijo de 0 a 100. */
export function ejePorcentaje(tam = 11) {
  return {
    ...tickEje(tam),
    domain: [0, 100] as const,
    tickFormatter: (v: number) => `${v}%`,
  }
}

/** Props para `<CartesianGrid>`: rejilla sutil discontinua. */
export function rejilla(ejes: 'ambas' | 'horizontal' | 'vertical' = 'ambas') {
  const base = { strokeDasharray: '3 3', stroke: COLOR_GRAFICA.rejilla }
  if (ejes === 'horizontal') return { ...base, vertical: false }
  if (ejes === 'vertical') return { ...base, horizontal: false }
  return base
}

/** Props para `<Legend>`: puntos redondos y texto compacto. */
export function leyenda() {
  return { iconType: 'circle' as const, wrapperStyle: { fontSize: 11 } }
}

/** Props para `<LabelList>` sobre una barra. */
export function etiquetaBarra(position: 'top' | 'right' = 'top', tam = 10) {
  return {
    position,
    fill: COLOR_GRAFICA.texto,
    fontSize: tam,
    fontWeight: 600,
  }
}

/* ── Contenedor de gráfica ─────────────────────────────────────── */

interface PropsContenedorGrafica {
  titulo: string
  descripcion?: ReactNode
  icono?: ReactNode
  acciones?: ReactNode
  alto: number
  vacio: boolean
  children: ReactElement
}

/**
 * Tarjeta estándar para una gráfica: encabezado del sistema de diseño +
 * `ResponsiveContainer`. Si `vacio` es `true` muestra un estado vacío
 * unificado en lugar del gráfico.
 */
export function ContenedorGrafica({
  titulo,
  descripcion,
  icono,
  acciones,
  alto,
  vacio,
  children,
}: PropsContenedorGrafica) {
  return (
    <div className="tarjeta min-w-0">
      <div className="tarjeta-encabezado">
        <div className="flex min-w-0 items-center gap-2">
          {icono && (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-marca-50 text-marca-700">
              {icono}
            </span>
          )}
          <div className="min-w-0">
            <h3 className="titulo-seccion truncate">{titulo}</h3>
            {descripcion && <p className="subtitulo-pagina">{descripcion}</p>}
          </div>
        </div>
        {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
      </div>
      <div className="tarjeta-pad">
        {vacio ? (
          <div
            className="flex items-center justify-center text-center text-sm text-slate-400"
            style={{ height: alto }}
          >
            Sin datos para el filtro actual
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={alto}>
            {children}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

/* ── Tooltip ───────────────────────────────────────────────────── */

interface PuntoTooltip {
  value?: number | string
  name?: number | string
  dataKey?: number | string
  color?: string
  payload?: Record<string, unknown>
}

interface PropsTooltipGrafica {
  active?: boolean
  payload?: PuntoTooltip[]
  label?: ReactNode
  /** Formatea el valor numérico de la serie. */
  formato?: (n: number) => string
  /** Sufijo añadido al valor (p. ej. `%`). Se concatena sin espacio. */
  sufijo?: string
  /**
   * Mapa `dataKey` → unidad para gráficas con varias series de distinta unidad
   * (p. ej. `{ horas: 'h', woHoras: 'h' }`). La unidad se muestra separada por
   * un espacio del valor.
   */
  unidades?: Record<string, string>
}

/**
 * Tooltip genérico del sistema: etiqueta + valor(es) formateado(s), sobre una
 * superficie clara (nunca fondo oscuro). Con una sola serie muestra el valor
 * suelto; con varias, una fila por serie. Recharts inyecta
 * `active` / `payload` / `label`.
 */
export function TooltipGrafica({
  active,
  payload,
  label,
  formato,
  sufijo,
  unidades,
}: PropsTooltipGrafica) {
  if (!active || !payload || payload.length === 0) return null

  const formatearValor = (bruto: number | string | undefined, dataKey?: number | string): string => {
    const unidad =
      unidades != null && dataKey != null && unidades[String(dataKey)] != null
        ? ` ${unidades[String(dataKey)]}`
        : ''
    const sfx = `${sufijo ?? ''}${unidad}`
    if (typeof bruto === 'number') {
      const base = formato ? formato(bruto) : bruto.toLocaleString('es-CO', { maximumFractionDigits: 1 })
      return `${base}${sfx}`
    }
    return `${bruto ?? ''}${sfx}`
  }

  const unaSerie = payload.length === 1
  const titulo = label ?? (unaSerie ? payload[0].name : undefined) ?? ''

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-panel">
      {titulo !== '' && (
        <p className="text-xs font-semibold" style={{ color: COLOR_GRAFICA.texto }}>
          {titulo}
        </p>
      )}
      {unaSerie ? (
        <p className="mt-0.5 text-sm font-bold" style={{ color: COLOR_GRAFICA.serie }}>
          {formatearValor(payload[0].value, payload[0].dataKey)}
        </p>
      ) : (
        <ul className="mt-1 space-y-0.5">
          {payload.map((fila, i) => (
            <li key={String(fila.dataKey ?? i)} className="flex items-center gap-2 text-xs">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: fila.color ?? COLOR_GRAFICA.serie }}
              />
              <span className="text-slate-600">{fila.name}</span>
              <span className="ml-auto font-semibold" style={{ color: COLOR_GRAFICA.texto }}>
                {formatearValor(fila.value, fila.dataKey)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
