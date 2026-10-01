// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Chip, Tarjeta } from '../../components/ui'
import { fmtNumero } from './constantes'
import { BotonGarantias } from './ModalGarantias'
import type { DetalleGarantia, FaseCiclo, Metrica, TotalesCiclo } from './tipos'

interface Props {
  titulo: string
  descripcion: string
  /** Sustantivo en plural para el resumen y las etiquetas ("requerimientos", "entregas"). */
  unidad: string
  fases: FaseCiclo[]
  totales: TotalesCiclo
  metrica: Metrica
  /** Si se pasa, cada estado y el total muestran el botón de garantías. */
  onVerGarantias?: (titulo: string, filas: DetalleGarantia[]) => void
  detalleGarantiasTotal?: DetalleGarantia[]
}

/** Ciclo de vida por fases: estados con cantidad, %, horas (y garantías), y total al pie. */
export default function CicloVida({
  titulo,
  descripcion,
  unidad,
  fases,
  totales,
  metrica,
  onVerGarantias,
  detalleGarantiasTotal = [],
}: Props) {
  const maximo = Math.max(
    1,
    ...fases.flatMap((fase) => fase.filas.map((fila) => (metrica === 'horas' ? fila.horas : fila.cantidad))),
  )
  const sinDatos = totales.cantidad === 0

  return (
    <Tarjeta padding={false} className="min-w-0">
      <div className="tarjeta-encabezado">
        <div className="min-w-0">
          <h3 className="titulo-seccion truncate">{titulo}</h3>
          <p className="subtitulo-pagina">{descripcion}</p>
        </div>
        <span className="font-mono text-xs text-slate-500">
          {fmtNumero(totales.cantidad)} {unidad} · {fmtNumero(totales.horas)}h
          {onVerGarantias ? ` · ${fmtNumero(totales.garantias)} garantías` : ''}
        </span>
      </div>
      <div className="tarjeta-pad">
        {sinDatos ? (
          <p className="py-10 text-center text-sm text-slate-400">Sin datos para el filtro actual</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {fases.map((fase) => (
                <section
                  key={fase.id}
                  className={`min-w-0 rounded-lg border border-t-4 border-slate-200 bg-slate-50/60 p-3 ${fase.acento}`}
                  aria-label={`Fase ${fase.nombre}`}
                >
                  <header className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{fase.nombre}</p>
                      <p className="text-2xs text-slate-500">{fase.subtitulo}</p>
                    </div>
                    <Chip tono="neutro">{fase.cantidad}</Chip>
                  </header>
                  {fase.filas.length === 0 ? (
                    <p className="py-3 text-center text-xs text-slate-400">Sin {unidad} en esta fase</p>
                  ) : (
                    <ul className="space-y-3">
                      {fase.filas.map((fila) => {
                        const valor = metrica === 'horas' ? fila.horas : fila.cantidad
                        return (
                          <li key={fila.estado}>
                            <div className="flex items-start gap-2">
                              <span
                                className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: fila.color }}
                                aria-hidden="true"
                              />
                              <span className="min-w-0 flex-1 break-words text-xs font-semibold text-slate-800">
                                {fila.estado}
                              </span>
                              <b className="text-sm text-slate-900">{fmtNumero(fila.cantidad)}</b>
                            </div>
                            <div
                              className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200"
                              role="progressbar"
                              aria-label={`${fila.estado}: ${metrica === 'horas' ? 'horas' : unidad}`}
                              aria-valuemin={0}
                              aria-valuemax={maximo}
                              aria-valuenow={valor}
                            >
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{ width: `${(valor / maximo) * 100}%`, backgroundColor: fila.color }}
                              />
                            </div>
                            <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-2xs text-slate-500">
                              <span>
                                {fila.porcentaje.toFixed(1)}% · {fmtNumero(fila.horas)}h
                              </span>
                              {onVerGarantias && (
                                <BotonGarantias
                                  valor={fila.garantias}
                                  onClick={() =>
                                    onVerGarantias(`Garantías · ${fila.estado}`, fila.garantiasDetalle)
                                  }
                                />
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t-2 border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-900">
              <span>Total</span>
              <Chip tono="marca">{fmtNumero(totales.cantidad)}</Chip>
              <span className="text-slate-700">100.0%</span>
              <Chip tono="alerta">{`${fmtNumero(totales.horas)}h`}</Chip>
              {onVerGarantias && (
                <span className="inline-flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-500">Garantías</span>
                  <BotonGarantias
                    valor={totales.garantias}
                    onClick={() => onVerGarantias('Garantías · Total', detalleGarantiasTotal)}
                  />
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </Tarjeta>
  )
}
