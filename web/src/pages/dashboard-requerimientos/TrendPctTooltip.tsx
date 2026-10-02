// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

/** Tooltip de las gráficas de ANS en %: muestra además cantidad/total del mes. */
export function TrendPctTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const fila = payload[0]?.payload ?? {}
  // Mapea cada dataKey de %, a su campo de cantidad absoluta y su campo de total del mes.
  const RAW_KEY: Record<string, string> = {
    cumplePct: 'cumple', noCumplePct: 'noCumple',
    oportunidadPct: 'oportunidadCumple', oportunidadNoCumplePct: 'oportunidadNoCumple',
    cumplimientoPct: 'cumplimientoCumple', cumplimientoNoCumplePct: 'cumplimientoNoCumple',
    inicioPct: 'inicioCumple', inicioNoCumplePct: 'inicioNoCumple',
  }
  const TOTAL_KEY: Record<string, string> = {
    cumplePct: 'total', noCumplePct: 'total',
    oportunidadPct: 'oportunidadTotal', oportunidadNoCumplePct: 'oportunidadTotal',
    cumplimientoPct: 'cumplimientoTotal', cumplimientoNoCumplePct: 'cumplimientoTotal',
    inicioPct: 'inicioTotal', inicioNoCumplePct: 'inicioTotal',
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-panel">
      <p className="mb-1 text-xs font-semibold text-slate-900">{label}</p>
      {payload.map((entry: any) => {
        const cantidad = fila[RAW_KEY[entry.dataKey]]
        const total = fila[TOTAL_KEY[entry.dataKey]]
        const detalle = cantidad !== undefined && total !== undefined ? ` (${cantidad}/${total})` : ''
        return (
          <p key={entry.dataKey} className="text-xs" style={{ color: entry.stroke }}>
            {entry.name}: <span className="font-bold">{entry.value}%{detalle}</span>
          </p>
        )
      })}
    </div>
  )
}


