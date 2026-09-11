import type { EntregasActasCampo } from '../../constantes'

/** Agrupa una lista de campos configurables por su `grupo`, en un orden fijo legible. */
export function agruparCampos(campos: EntregasActasCampo[]): { grupo: string; items: EntregasActasCampo[] }[] {
  const orden = ['Entrega', 'Requerimiento', 'Solicitud', 'Facturación']
  const mapa = new Map<string, EntregasActasCampo[]>()
  for (const c of campos) {
    if (!mapa.has(c.grupo)) mapa.set(c.grupo, [])
    mapa.get(c.grupo)?.push(c)
  }
  return orden.filter((g) => mapa.has(g)).map((g) => ({ grupo: g, items: mapa.get(g) ?? [] }))
}

/** Formatea una fecha ISO (guardada en UTC, sin sufijo de zona) en hora de Colombia. */
export function fmtFechaCo(fecha: string | null): string {
  // INVARIANTE 13: copia local; no sustituir por web/src/utilidades/fechas.ts.
  if (!fecha) return '—'
  const iso = /[zZ]|[+-]\d{2}:\d{2}$/.test(fecha) ? fecha : `${fecha}Z`
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return fecha
  return d.toLocaleString('es-CO', { timeZone: 'America/Bogota' })
}
