/** Da formato legible (ej. "2 días 3 horas 10 min") a una duración en segundos. */
export function fmtDuracion(segundos: number | null): string {
  if (segundos == null) return '—'
  if (segundos < 60) return `${segundos} seg`
  const dias = Math.floor(segundos / 86400)
  const horas = Math.floor((segundos % 86400) / 3600)
  const minutos = Math.floor((segundos % 3600) / 60)
  const partes: string[] = []
  if (dias > 0) partes.push(`${dias} día${dias === 1 ? '' : 's'}`)
  if (horas > 0) partes.push(`${horas} hora${horas === 1 ? '' : 's'}`)
  if (minutos > 0 || partes.length === 0) partes.push(`${minutos} min`)
  return partes.join(' ')
}

/** Interpreta fechas de Mongo sin sufijo de zona horaria como UTC y las
 * muestra en hora de Colombia (mismo patrón usado en SoporteSolicitudesFabrica). */
export function fmtFechaCo(fecha: string | null): string {
  if (!fecha) return '—'
  const conZona = /[zZ]|[+-]\d{2}:?\d{2}$/.test(fecha) ? fecha : `${fecha}Z`
  const d = new Date(conZona)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-CO', { timeZone: 'America/Bogota' })
}
