// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Kpi } from '../../components/ui/primitivos'
import type { Liquidacion } from '../../types'

interface Props {
  liquidacion: Liquidacion | null
}

export default function SeccionLiquidacion({ liquidacion }: Props) {
  return (
    <div className="tarjeta tarjeta-pad">
      <h2 className="etiqueta-sup mb-3">
        Liquidación
      </h2>
      {liquidacion ? (
        <div className="space-y-3">
          <Kpi rotulo="Total liquidado" valor={liquidacion.total.toLocaleString()} />
          <div className="divide-y rounded-md border">
            {liquidacion.entregas.map((le) => (
              <div key={le.numero} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="text-slate-600">Entrega {le.numero}</span>
                {le.error ? (
                  <span className="text-amber-600">{le.error}</span>
                ) : (
                  <span className="tabular-nums font-medium text-slate-800">{le.valor?.toLocaleString()}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-400">Sin datos de liquidación.</p>
      )}
    </div>
  )
}
