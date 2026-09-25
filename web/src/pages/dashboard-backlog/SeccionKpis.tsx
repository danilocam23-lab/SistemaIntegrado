// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Kpi } from '../../components/ui'
import { COLOR_GRAFICA } from '../../components/ui/graficas'
import type { ResumenRiesgo } from './tipos'
import { fmtNumero } from './utilidades'

interface Props {
  kpis: { totalSquads: number; topNombre: string; topCantidad: number }
  horasEntregas: { totalHoras: number; totalEntregas: number; promedioHoras: number }
  horasWo: { totalHoras: number; totalWo: number; promedioHoras: number }
  totalHoras: number
  resumenCapacidad: { totalHoras: number; personasDisponibles: number; personasUnicas: number }
  resumenRiesgo: ResumenRiesgo
}

/** Fila de KPIs: 4 columnas en pantallas grandes (2 filas de 4), 2 en móvil. */
export default function SeccionKpis({
  kpis,
  horasEntregas,
  horasWo,
  totalHoras,
  resumenCapacidad,
  resumenRiesgo,
}: Props) {
  const acentoRiesgo =
    resumenRiesgo.criticos > 0
      ? COLOR_GRAFICA.malo
      : resumenRiesgo.enRiesgo > 0
        ? COLOR_GRAFICA.alerta
        : COLOR_GRAFICA.ok

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Kpi
        rotulo="Squads Activos"
        valor={kpis.totalSquads}
        nota="con requerimientos"
        acento={COLOR_GRAFICA.serie}
      />
      <Kpi
        rotulo="Backlog Principal"
        valor={kpis.topNombre}
        nota={`${kpis.topCantidad} requerimientos`}
        acento={COLOR_GRAFICA.serie}
      />
      <Kpi
        rotulo="Squads en riesgo"
        valor={resumenRiesgo.enRiesgo}
        nota={`${resumenRiesgo.criticos} críticos · ${resumenRiesgo.enAtencion} en atención · ${resumenRiesgo.sobrecargados} en sobrecarga`}
        acento={acentoRiesgo}
      />
      <Kpi
        rotulo="Equipo Disponible"
        valor={resumenCapacidad.personasDisponibles}
        nota={`${resumenCapacidad.personasUnicas} personas únicas • sin LT_EPM • ${fmtNumero(resumenCapacidad.totalHoras)}h capacidad`}
        acento={COLOR_GRAFICA.serie}
      />
      <Kpi
        rotulo="Horas de entregas"
        valor={`${fmtNumero(horasEntregas.totalHoras)}h`}
        nota={`Promedio: ${fmtNumero(horasEntregas.promedioHoras)}h • ${fmtNumero(horasEntregas.totalEntregas)} entregas`}
        acento={COLOR_GRAFICA.serie}
      />
      <Kpi
        rotulo="Horas aprobadas WO"
        valor={`${fmtNumero(horasWo.totalHoras)}h`}
        nota={`Promedio: ${fmtNumero(horasWo.promedioHoras)}h • ${fmtNumero(horasWo.totalWo)} WO`}
        acento={COLOR_GRAFICA.serie}
      />
      <Kpi
        rotulo="Total horas"
        valor={`${fmtNumero(totalHoras)}h`}
        nota="Horas de entregas + horas aprobadas WO"
        acento={COLOR_GRAFICA.serie}
      />
      <Kpi
        rotulo="Squads en sobrecarga"
        valor={resumenRiesgo.sobrecargados}
        nota="Horas de entregas del periodo sobre la capacidad disponible"
        acento={resumenRiesgo.sobrecargados > 0 ? COLOR_GRAFICA.alerta : COLOR_GRAFICA.ok}
      />
    </div>
  )
}
