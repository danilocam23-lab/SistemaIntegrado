// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Campo } from '../../components/ui'
import type { FilaDetalleWo } from './tipos'
import { fmtNumero } from './utilidades'

interface Props {
  filas: FilaDetalleWo[]
  busqueda: string
  onBusqueda: (valor: string) => void
  onCerrar: () => void
}

export default function ModalDetalleWo({ filas, busqueda, onBusqueda, onCerrar }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="titulo-seccion">Detalle WO por mes</h2>
            <p className="mt-1 text-sm text-slate-500">WO individuales y Horas_Aprobadas por periodo seleccionado.</p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar detalle WO por mes"
          >
            ✕
          </button>
        </div>

        <div className="border-b border-slate-100 px-6 py-4">
          <Campo
            etiqueta="Buscar por WO"
            type="search"
            value={busqueda}
            onChange={(event) => onBusqueda(event.target.value)}
            placeholder="Ej: WO12345"
            className="w-full"
          />
        </div>

        <div className="max-h-[62vh] overflow-auto p-6">
          <table className="tabla">
            <thead>
              <tr>
                <th>Mes</th>
                <th>Work Order ID</th>
                <th className="text-right">Horas aprobadas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filas.map((fila) => (
                <tr key={`${fila.mes}-${fila.workOrder}`} className="hover:bg-blue-50/40">
                  <td className="px-4 py-3 font-medium text-slate-800">{fila.label}</td>
                  <td className="px-4 py-3 font-semibold text-green-700">{fila.workOrder}</td>
                  <td className="px-4 py-3 text-right font-semibold text-amber-700">{fmtNumero(fila.horasAprobadas)}h</td>
                </tr>
              ))}
              {filas.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-slate-400" colSpan={3}>
                    No se encontraron WO con esa búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-900">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3">{fmtNumero(filas.length)} WO</td>
                <td className="px-4 py-3 text-right">
                  {fmtNumero(filas.reduce((sum, fila) => sum + fila.horasAprobadas, 0))}h
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
