// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import type { Requerimiento } from '../../types'

/** Solo el reloj se convierte a Colombia; las fechas de los registros no se desplazan. */
export function anoActualColombia(instante = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric',
  }).format(instante)
}

/** Calendario ISO válido, incluida la hora si existe; sin fallback a otras fechas. */
export function anoSolicitudActa(fecha: string | null | undefined): string | null {
  if (!fecha) return null
  const partes = /^(\d{4})-(\d{2})-(\d{2})(?:[T ]([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d+)?)?(?:[zZ]|[+-](?:[01]\d|2[0-3]):?[0-5]\d)?)?$/.exec(fecha)
  if (!partes) return null
  const ano = Number(partes[1]), mes = Number(partes[2]), dia = Number(partes[3])
  const bisiesto = ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0)
  const dias = [31, bisiesto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return ano > 0 && mes >= 1 && mes <= 12 && dia >= 1 && dia <= dias[mes - 1]
    ? partes[1] : null
}

/** Vacío significa todos, incluidos registros sin fecha o sin referencia al requerimiento. */
export function pasaAnoSolicitudActa(
  requerimiento: Pick<Requerimiento, 'fecha_solicitud_acta'> | null | undefined,
  anos: ReadonlySet<string>,
): boolean {
  if (anos.size === 0) return true
  const ano = anoSolicitudActa(requerimiento?.fecha_solicitud_acta)
  return ano !== null && anos.has(ano)
}
