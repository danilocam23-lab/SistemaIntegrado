// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

/** Estado "cargando": tarjetas de rol y filas esqueleto mientras llega el directorio. */
export function EsqueletoPersonas() {
  return (
    <div role="status" aria-label="Cargando personas" className="animate-pulse motion-reduce:animate-none">
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-[78px] rounded-xl border border-slate-200 bg-white" />
        ))}
      </div>
      <div className="tarjeta tarjeta-pad grid gap-3">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-[30px] w-[30px] shrink-0 rounded-[9px] bg-slate-100" />
            <div className="h-4 flex-1 rounded bg-slate-100" />
            <div className="hidden h-4 w-24 rounded bg-slate-100 sm:block" />
          </div>
        ))}
      </div>
      <span className="sr-only">Cargando…</span>
    </div>
  )
}
