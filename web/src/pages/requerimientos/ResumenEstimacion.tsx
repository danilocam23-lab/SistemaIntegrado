import { Kpi, Tarjeta } from '../../components/ui'
import type { Estimacion } from '../../types'
import { formatNumber } from './utilidades'

interface ResumenEstimacionProps {
  estimacion: Estimacion
}

/** Información general de la estimación + los 4 KPIs de la cabecera del modal. */
export function ResumenEstimacion({ estimacion }: ResumenEstimacionProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-[2fr,1fr,1fr]">
      <Tarjeta className="lg:col-span-1">
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
      </Tarjeta>
      <div className="grid gap-4 md:grid-cols-2 lg:col-span-2 lg:grid-cols-4">
        <Kpi rotulo="Total tareas" valor={formatNumber(estimacion.total_filas)} acento="#0891b2" />
        <Kpi rotulo="Horas estimadas" valor={formatNumber(estimacion.total_horas_estimadas)} acento="#d97706" />
        <Kpi rotulo="Promedio (hrs)" valor={formatNumber(estimacion.total_promedio)} acento="#475569" />
        <Kpi rotulo="Total +10% (hrs)" valor={formatNumber(estimacion.total_horas_finales)} acento="#059669" />
      </div>
    </div>
  )
}
