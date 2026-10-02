// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Kpi } from '../../components/ui'
import { formatearHoras } from './base'
import { MESES_ABREV } from './tipos'
import type { FilaCapacidad } from './tipos'

const ROJO = '#b91c1c'
const AMBAR = '#b45309'

interface Indicadores {
  totalHoras: number
  registros: number
  promedioMensual: number
  porRegistrar: number
  desdeMes: number
  vaciasMesActual: number
  sobrecarga: FilaCapacidad[]
  subutilizadas: FilaCapacidad[]
}

interface Props {
  indicadores: Indicadores
  esAnioActual: boolean
  /** `false` si la carga de Asignaciones no se pudo leer. */
  cargaDisponible: boolean
}

function nombres(filas: FilaCapacidad[], max = 2): string {
  if (filas.length === 0) return 'ninguna persona'
  const lista = filas.slice(0, max).map((f) => f.persona.nombre.split(' ').slice(0, 2).join(' '))
  const resto = filas.length - max
  return resto > 0 ? `${lista.join(' · ')} +${resto}` : lista.join(' · ')
}

/** Seis KPI de capacidad, calculados en el navegador con los datos ya cargados. */
export function KpisCapacidades({ indicadores: k, esAnioActual, cargaDisponible }: Props) {
  const desde = k.desdeMes >= 12 ? '' : MESES_ABREV[k.desdeMes].toLowerCase()
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Kpi rotulo="Capacidad del año" valor={`${formatearHoras(k.totalHoras)} h`} nota={`${k.registros} registros`} />
      <Kpi
        rotulo="Promedio mensual"
        valor={`${formatearHoras(Math.round(k.promedioMensual))} h`}
        nota="por persona con registro"
      />
      <Kpi
        rotulo={desde ? `Por registrar (${desde}–dic)` : 'Por registrar'}
        valor={k.porRegistrar}
        nota={desde ? 'celdas que usan la base sugerida' : 'año pasado: nada pendiente'}
        acento={k.porRegistrar > 0 ? AMBAR : undefined}
      />
      <Kpi
        rotulo="Vacías en el mes actual"
        valor={esAnioActual ? k.vaciasMesActual : '—'}
        nota={esAnioActual ? 'personas sin registro este mes' : 'solo aplica al año actual'}
        acento={esAnioActual && k.vaciasMesActual > 0 ? AMBAR : undefined}
      />
      <Kpi
        rotulo="En sobrecarga"
        valor={cargaDisponible ? k.sobrecarga.length : 'N/D'}
        nota={cargaDisponible ? nombres(k.sobrecarga) : 'Asignaciones no disponible'}
        acento={cargaDisponible && k.sobrecarga.length > 0 ? ROJO : undefined}
      />
      <Kpi
        rotulo="Subutilizadas"
        valor={cargaDisponible ? k.subutilizadas.length : 'N/D'}
        nota={cargaDisponible ? 'carga menor a 60 % (con asignaciones)' : 'Asignaciones no disponible'}
        acento={cargaDisponible && k.subutilizadas.length > 0 ? AMBAR : undefined}
      />
    </div>
  )
}
