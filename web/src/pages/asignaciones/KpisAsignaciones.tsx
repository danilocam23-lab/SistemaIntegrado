// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Kpi } from '../../components/ui'
import type { Persona } from '../../types'
import type { CargaPersona } from './carga'
import { formatearPct } from './carga'

const ROJO = '#b91c1c'
const AMBAR = '#b45309'

interface FilaPersona {
  persona: Persona
  carga: CargaPersona
}

interface Props {
  totalPersonas: number
  conCarga: number
  media: number
  capacidadBaseMedia: number
  sobrecarga: FilaPersona[]
  conHolgura: FilaPersona[]
  reqsSinAsignar: number
  azureSinPersonaHoras: number
  azureSinPersonaReqs: number
  /** `true` si falló Azure DevOps: el KPI dice "no disponible" en lugar de mostrar 0.0 h. */
  azureNoDisponible: boolean
}

function nombresCortos(filas: FilaPersona[], max = 2): string {
  if (filas.length === 0) return 'ninguna persona'
  const nombres = filas.slice(0, max).map((f) => f.persona.nombre.split(' ').slice(0, 2).join(' '))
  const resto = filas.length - max
  return resto > 0 ? `${nombres.join(' · ')} +${resto}` : nombres.join(' · ')
}

/** Seis KPI de capacidad del equipo, calculados en el navegador con los datos ya cargados. */
export function KpisAsignaciones({
  totalPersonas,
  conCarga,
  media,
  capacidadBaseMedia,
  sobrecarga,
  conHolgura,
  reqsSinAsignar,
  azureSinPersonaHoras,
  azureSinPersonaReqs,
  azureNoDisponible,
}: Props) {
  const sinCarga = totalPersonas - conCarga
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Kpi
        rotulo="Personas con carga"
        valor={`${conCarga} de ${totalPersonas}`}
        nota={sinCarga > 0 ? `${sinCarga} sin asignaciones` : 'todas con carga'}
      />
      <Kpi
        rotulo="Carga media"
        valor={`${formatearPct(media)}%`}
        nota={`sobre capacidad base ${formatearPct(capacidadBaseMedia)} h`}
      />
      <Kpi
        rotulo="En sobrecarga"
        valor={sobrecarga.length}
        nota={nombresCortos(sobrecarga)}
        acento={sobrecarga.length > 0 ? ROJO : undefined}
      />
      <Kpi rotulo="Con holgura (<70%)" valor={conHolgura.length} nota={nombresCortos(conHolgura)} />
      <Kpi
        rotulo="Req. activos sin asignar"
        valor={reqsSinAsignar}
        nota="ninguna persona a cargo"
        acento={reqsSinAsignar > 0 ? AMBAR : undefined}
      />
      <Kpi
        rotulo="Azure sin persona"
        valor={azureNoDisponible ? 'N/D' : `${azureSinPersonaHoras.toFixed(1)} h`}
        nota={
          azureNoDisponible
            ? 'Azure DevOps no disponible'
            : `trabajadas en ${azureSinPersonaReqs} requerimiento${azureSinPersonaReqs === 1 ? '' : 's'}`
        }
      />
    </div>
  )
}
