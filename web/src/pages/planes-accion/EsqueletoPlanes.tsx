// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

/** Estado "cargando": bloques esqueleto (KPI + filas) mientras llega la lista. */
export function EsqueletoPlanes() {
  return (
    <div role="status" aria-label="Cargando planes de acción" className="animate-pulse motion-reduce:animate-none">
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="kpi h-[88px]" />
        ))}
      </div>
      <div className="tarjeta tarjeta-pad grid gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-5 w-full rounded bg-slate-100" />
        ))}
      </div>
      <span className="sr-only">Cargando…</span>
    </div>
  )
}
