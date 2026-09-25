// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Chip, Icono, Tarjeta, TablaScroll } from '../../components/ui'
import InsigniaAvance from './InsigniaAvance'
import type { FilaSquadAnalisis } from './tipos'
import { fmtNumero } from './utilidades'

interface Props {
  filas: FilaSquadAnalisis[]
  onVerAplicaciones: (squad: string) => void
}

/** Resalte sutil de la fila según el peor indicador (fondo + borde izquierdo). */
function claseFila(fila: FilaSquadAnalisis): string {
  if (fila.nivelGlobal === 'error') return 'border-l-4 border-l-red-500 bg-red-50/50 hover:bg-red-50'
  if (fila.nivelGlobal === 'alerta' || fila.sobrecarga) {
    return 'border-l-4 border-l-amber-500 bg-amber-50/50 hover:bg-amber-50'
  }
  return 'border-l-4 border-l-transparent hover:bg-blue-50/40'
}

function EstadoSquad({ fila }: { fila: FilaSquadAnalisis }) {
  if (fila.nivelGlobal === 'error') {
    return <Chip tono="error" title="ANS por debajo de 50%">Crítico</Chip>
  }
  if (fila.nivelGlobal === 'alerta') {
    return <Chip tono="alerta" title="ANS entre 50% y 74%">En atención</Chip>
  }
  if (fila.sobrecarga) {
    return <Chip tono="alerta" title="Las horas de entregas del periodo superan la capacidad disponible">Sobrecarga</Chip>
  }
  if (fila.nivelGlobal === 'exito') return <Chip tono="exito">Cumple</Chip>
  return <Chip tono="neutro">Sin datos</Chip>
}

const COLOR_CARGA = { normal: 'bg-marca-500', alta: 'bg-amber-500', sobrecarga: 'bg-red-500' } as const

function CargaSquad({ fila }: { fila: FilaSquadAnalisis }) {
  if (fila.capacidadHoras === null || fila.utilizacion === null) {
    return (
      <div className="text-center" title="Horas de entregas del periodo (sin capacidad configurada para compararlas)">
        <Chip tono="alerta">{`${fmtNumero(fila.horasEntregas)}h`}</Chip>
        <p className="mt-1 text-xs text-slate-400">Sin capacidad</p>
      </div>
    )
  }
  const nivel = fila.sobrecarga ? 'sobrecarga' : fila.utilizacion >= 90 ? 'alta' : 'normal'
  return (
    <div className="mx-auto w-32" title="Horas de entregas del periodo frente a la capacidad del periodo">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-800">{`${fmtNumero(fila.horasEntregas)}h`}</span>
        <span className="text-slate-500">{`de ${fmtNumero(fila.capacidadHoras)}h`}</span>
      </div>
      <div
        className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuenow={Math.min(fila.utilizacion, 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Carga del periodo de ${fila.squad}: horas de entregas al ${fila.utilizacion}% de la capacidad`}
      >
        <div
          className={`h-full rounded-full ${COLOR_CARGA[nivel]}`}
          style={{ width: `${Math.min(fila.utilizacion, 100)}%` }}
        />
      </div>
      <p className={fila.sobrecarga ? 'mt-0.5 text-xs font-semibold text-red-700' : 'mt-0.5 text-xs text-slate-500'}>
        {fila.utilizacion}% de la capacidad
      </p>
    </div>
  )
}

export default function TablaDetalleSquad({ filas, onVerAplicaciones }: Props) {
  return (
    <Tarjeta padding={false} className="min-w-0">
      <div className="tarjeta-encabezado">
        <div className="min-w-0">
          <h3 className="titulo-seccion truncate">Detalle Completo por Squad</h3>
          <p className="subtitulo-pagina">
            Resumen de métricas y cumplimiento · las filas resaltadas están en riesgo o sobrecarga
          </p>
        </div>
      </div>
      <div className="tarjeta-pad">
        {filas.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">Sin datos para el filtro actual</p>
        ) : (
          <TablaScroll>
            <table className="tabla">
              <thead>
                <tr>
                  <th>Squad</th>
                  <th className="text-center">Reqs</th>
                  <th className="text-center">Horas</th>
                  <th className="text-center" title="Horas de entregas del periodo frente a la capacidad del periodo">
                    Carga del periodo
                  </th>
                  <th className="text-center">Entregas</th>
                  <th className="text-center">ANS Acta</th>
                  <th className="text-center">ANS Entrega</th>
                  <th className="text-center">Aplicación EPM</th>
                  <th className="text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filas.map((fila) => (
                  <tr key={fila.squad} className={`group transition-colors duration-200 ${claseFila(fila)}`}>
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      <span className="flex items-center gap-2">
                        {(fila.nivelGlobal === 'error' || fila.nivelGlobal === 'alerta' || fila.sobrecarga) && (
                          <span
                            className={fila.nivelGlobal === 'error' ? 'text-red-600' : 'text-amber-600'}
                            role="img"
                            aria-label="Squad en riesgo"
                          >
                            <Icono nombre="alerta" />
                          </span>
                        )}
                        {fila.squad}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Chip tono="marca">{fila.reqs}</Chip>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Chip tono="alerta" title="Horas estimadas de los requerimientos">{`${fmtNumero(fila.horas)}h`}</Chip>
                    </td>
                    <td className="px-6 py-4">
                      <CargaSquad fila={fila} />
                    </td>
                    <td className="px-6 py-4 text-center text-slate-700 font-medium">{fmtNumero(fila.entregas)}</td>
                    <td className="px-6 py-4 text-center">
                      <InsigniaAvance porcentaje={fila.porcentajeActa} />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <InsigniaAvance porcentaje={fila.porcentajeEntrega} />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        type="button"
                        className="cursor-pointer"
                        onClick={() => onVerAplicaciones(fila.squad)}
                        aria-label={`Ver aplicaciones EPM de ${fila.squad}`}
                      >
                        <Chip tono="marca">{fila.aplicacionesEpmCount}</Chip>
                      </button>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <EstadoSquad fila={fila} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TablaScroll>
        )}
      </div>
    </Tarjeta>
  )
}
