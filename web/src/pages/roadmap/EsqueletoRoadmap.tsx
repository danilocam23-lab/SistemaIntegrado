// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

/** Estado "cargando": KPI y filas esqueleto mientras llegan requerimientos y personas. */
export function EsqueletoRoadmap() {
  return (
    <div role="status" aria-label="Cargando roadmap" className="animate-pulse motion-reduce:animate-none">
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="kpi h-[88px]" />)}
      </div>
      <div className="tarjeta tarjeta-pad grid gap-3">
        {[50, 100, 85, 65, 90].map((ancho, i) => (
          <div key={i} className="h-5 rounded bg-slate-100" style={{ width: `${ancho}%` }} />
        ))}
      </div>
      <span className="sr-only">Cargando…</span>
    </div>
  )
}
