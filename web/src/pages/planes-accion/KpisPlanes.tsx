// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Aviso, Boton, Kpi } from '../../components/ui'
import type { PlanConVencimiento } from './useDerivadosPlanes'

const ROJO = '#b91c1c'
const VERDE = '#047857'

interface Props {
  kpis: {
    total: number
    abiertos: number
    enProgreso: number
    vencidos: PlanConVencimiento[]
    completados: number
    validos: number
    porcentajeCompletado: number
  }
  onVerVencidos: () => void
}

/** Resumen (abiertos, en progreso, vencidos, completados) y aviso de vencidos. */
export function KpisPlanes({ kpis: k, onVerVencidos }: Props) {
  const vencidos = k.vencidos.length
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi rotulo="Abiertos" valor={k.abiertos} nota={`de ${k.total} planes`} />
        <Kpi rotulo="En progreso" valor={k.enProgreso} nota="en curso hoy" />
        <Kpi
          rotulo="Vencidos"
          valor={vencidos}
          nota="fecha pasada y sin cerrar"
          acento={vencidos > 0 ? ROJO : undefined}
        />
        <Kpi
          rotulo="Completados"
          valor={`${k.porcentajeCompletado} %`}
          nota={`${k.completados} de ${k.validos} (sin cancelados)`}
          acento={k.validos > 0 && k.porcentajeCompletado === 100 ? VERDE : undefined}
        />
      </div>

      {vencidos > 0 ? (
        <Aviso tono="error" className="mb-4">
          <span role="alert" className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 break-words">
              <strong>
                {vencidos === 1 ? '1 plan vencido' : `${vencidos} planes vencidos`}
              </strong>
              {': '}
              {k.vencidos.slice(0, 3).map((v) => `«${v.plan.titulo}»`).join(', ')}
              {vencidos > 3 ? ` y ${vencidos - 3} más` : ''}.
            </span>
            <Boton tamano="sm" onClick={onVerVencidos}>Ver vencidos</Boton>
          </span>
        </Aviso>
      ) : (
        k.abiertos > 0 && (
          <Aviso tono="exito" className="mb-4">
            <span role="status">Ningún plan abierto está vencido.</span>
          </Aviso>
        )
      )}
    </>
  )
}
