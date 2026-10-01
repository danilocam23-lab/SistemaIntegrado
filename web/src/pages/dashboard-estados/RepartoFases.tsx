// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Tarjeta } from '../../components/ui'
import { fmtNumero } from './constantes'
import type { FaseCiclo, Metrica, TotalesCiclo } from './tipos'

/** Barra apilada y leyenda con el reparto de requerimientos por fase (cantidad y horas). */
export default function RepartoFases({
  fases,
  totales,
  metrica,
}: {
  fases: FaseCiclo[]
  totales: TotalesCiclo
  metrica: Metrica
}) {
  const totalMetrica = metrica === 'horas' ? totales.horas : totales.cantidad
  const valorDe = (fase: FaseCiclo) => (metrica === 'horas' ? fase.horas : fase.cantidad)
  const conDatos = fases.filter((fase) => valorDe(fase) > 0)

  return (
    <Tarjeta padding={false} className="min-w-0">
      <div className="tarjeta-encabezado">
        <div className="min-w-0">
          <h3 className="titulo-seccion truncate">Reparto por fase</h3>
          <p className="subtitulo-pagina">Cantidad y horas de requerimientos por fase</p>
        </div>
      </div>
      <div className="tarjeta-pad" style={{ minHeight: 320 }}>
        {totalMetrica === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">Sin datos para el filtro actual</p>
        ) : (
          <>
            <div
              className="flex h-5 overflow-hidden rounded-full bg-slate-100"
              role="img"
              aria-label={`Reparto de requerimientos por fase: ${conDatos
                .map((fase) => `${fase.nombre} ${((valorDe(fase) / totalMetrica) * 100).toFixed(0)}%`)
                .join(', ')}`}
            >
              {conDatos.map((fase) => (
                <div
                  key={fase.id}
                  style={{ width: `${(valorDe(fase) / totalMetrica) * 100}%`, backgroundColor: fase.color }}
                />
              ))}
            </div>
            <ul className="mt-5 space-y-3">
              {fases.map((fase) => (
                <li key={fase.id} className="flex items-center gap-3 text-sm">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: fase.color }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{fase.nombre}</span>
                  <b className="text-slate-900">
                    {fmtNumero(fase.cantidad)} · {((fase.cantidad / (totales.cantidad || 1)) * 100).toFixed(0)}%
                  </b>
                  <span className="w-24 text-right text-xs text-slate-500">{fmtNumero(fase.horas)}h</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Tarjeta>
  )
}
