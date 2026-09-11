import type { Estimacion } from '../../types'
import { formatNumber } from './utilidades'

interface ResumenEstimacionProps {
  estimacion: Estimacion
}

/** Información general de la estimación + los 4 KPIs de la cabecera del modal. */
export function ResumenEstimacion({ estimacion }: ResumenEstimacionProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-[2fr,1fr,1fr]">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-1">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Información general</p>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-slate-400">Título</p>
            <p className="text-sm font-semibold text-slate-900">{estimacion.titulo || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Cliente</p>
            <p className="text-sm font-semibold text-slate-900">{estimacion.cliente || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Iniciativa</p>
            <p className="text-sm font-semibold text-slate-900">{estimacion.iniciativa || '—'}</p>
          </div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:col-span-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-cyan-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-600">Total tareas</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">{formatNumber(estimacion.total_filas)}</p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Horas estimadas</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">{formatNumber(estimacion.total_horas_estimadas)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Promedio (hrs)</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">{formatNumber(estimacion.total_promedio)}</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Total +10% (hrs)</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">{formatNumber(estimacion.total_horas_finales)}</p>
        </div>
      </div>
    </div>
  )
}
