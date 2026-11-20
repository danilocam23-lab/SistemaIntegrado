// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Chip, Kpi } from '../../components/ui'
import type { Entrega } from '../../types'

interface Props {
  squadNombre: string
  cumpleAnsEstimacion: boolean | null
  ultimaEntrega: Entrega | null
  cantidadEntregas: number
  horasEstimadas: number | null
}

/**
 * Franja de resumen del requerimiento, siempre visible bajo el encabezado: squad, ANS de
 * estimación, ANS de la última entrega, cantidad de entregas y horas estimadas. Todos son
 * datos que ya se calculan/muestran en otras secciones; aquí solo se repiten en formato
 * de lectura rápida, sin recalcular ni traer nada nuevo del backend.
 */
export default function SeccionResumen({
  squadNombre,
  cumpleAnsEstimacion,
  ultimaEntrega,
  cantidadEntregas,
  horasEstimadas,
}: Props) {
  return (
    <section aria-label="Resumen del requerimiento" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Kpi rotulo="Squad" valor={squadNombre || '—'} />
      <Kpi
        rotulo="ANS estimación"
        valor={
          <Chip tono={cumpleAnsEstimacion === true ? 'exito' : cumpleAnsEstimacion === false ? 'error' : 'neutro'}>
            {cumpleAnsEstimacion === true ? 'Cumple' : cumpleAnsEstimacion === false ? 'No cumple' : '—'}
          </Chip>
        }
      />
      <Kpi
        rotulo="ANS entrega (última)"
        valor={
          ultimaEntrega?.ans_entrega === 'CUMPLE' ? (
            <Chip tono="exito">Cumple</Chip>
          ) : ultimaEntrega?.ans_entrega === 'NO_CUMPLE' ? (
            <Chip tono="error">No cumple</Chip>
          ) : (
            <Chip tono="neutro">—</Chip>
          )
        }
      />
      <Kpi rotulo="Entregas" valor={cantidadEntregas} />
      <Kpi rotulo="Horas estimadas" valor={horasEstimadas ?? '—'} />
    </section>
  )
}
