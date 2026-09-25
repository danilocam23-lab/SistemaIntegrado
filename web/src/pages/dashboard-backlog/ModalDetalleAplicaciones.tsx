// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Campo } from '../../components/ui'
import type { FilaDetalleAplicacionEpm } from './tipos'
import { fmtNumero } from './utilidades'

interface Props {
  squad: string
  filas: FilaDetalleAplicacionEpm[]
  busqueda: string
  onBusqueda: (valor: string) => void
  onCerrar: () => void
}

export default function ModalDetalleAplicaciones({ squad, filas, busqueda, onBusqueda, onCerrar }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="titulo-seccion">Aplicaciones EPM — {squad}</h2>
            <p className="mt-1 text-sm text-slate-500">
              Aplicaciones EPM (prefijo del acta) y requerimientos asociados en este squad.
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar detalle de aplicaciones EPM"
          >
            ✕
          </button>
        </div>

        <div className="border-b border-slate-100 px-6 py-4">
          <Campo
            etiqueta="Buscar por aplicación EPM"
            type="search"
            value={busqueda}
            onChange={(event) => onBusqueda(event.target.value)}
            placeholder="Ej: EPM"
            className="w-full"
          />
        </div>

        <div className="max-h-[62vh] overflow-auto p-6">
          <table className="tabla">
            <thead>
              <tr>
                <th>Aplicación EPM</th>
                <th className="text-right">Requerimientos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filas.map((fila) => (
                <tr key={fila.aplicacionEpm} className="hover:bg-blue-50/40">
                  <td className="px-4 py-3 font-medium text-slate-800">{fila.aplicacionEpm}</td>
                  <td className="px-4 py-3 text-right font-semibold text-amber-700">
                    {fmtNumero(fila.cantidadRequerimientos)}
                  </td>
                </tr>
              ))}
              {filas.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-slate-400" colSpan={2}>
                    No se encontraron aplicaciones EPM con esa búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-900">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right">
                  {fmtNumero(filas.reduce((sum, fila) => sum + fila.cantidadRequerimientos, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
