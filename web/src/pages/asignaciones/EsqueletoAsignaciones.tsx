// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

/** Estado "cargando": bloques esqueleto (KPI + filas) mientras llegan las listas base. */
export function EsqueletoAsignaciones() {
  return (
    <div role="status" aria-label="Cargando asignaciones" className="animate-pulse motion-reduce:animate-none">
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="kpi h-[88px]" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="tarjeta tarjeta-pad grid gap-3">
            <div className="h-3 w-2/5 rounded bg-slate-200" />
            <div className="h-3 w-full rounded bg-slate-100" />
            <div className="h-3 w-4/5 rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <span className="sr-only">Cargando…</span>
    </div>
  )
}
