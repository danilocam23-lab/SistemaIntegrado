// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Link } from 'react-router-dom'
import { Campo } from '../../components/ui'
import type { FilaDetalleEntrega } from './tipos'
import { fmtNumero } from './utilidades'

interface Props {
  squad: string
  filas: FilaDetalleEntrega[]
  busqueda: string
  onBusqueda: (valor: string) => void
  onCerrar: () => void
}

export default function ModalDetalleEntregas({ squad, filas, busqueda, onBusqueda, onCerrar }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="titulo-seccion">Entregas — {squad}</h2>
            <p className="mt-1 text-sm text-slate-500">Entregas del squad en el periodo seleccionado.</p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar detalle de entregas"
          >
            ✕
          </button>
        </div>

        <div className="border-b border-slate-100 px-6 py-4">
          <Campo
            etiqueta="Buscar por código o acta"
            type="search"
            value={busqueda}
            onChange={(event) => onBusqueda(event.target.value)}
            placeholder="Ej: REQ-001"
            className="w-full"
          />
        </div>

        <div className="max-h-[62vh] overflow-auto p-6">
          <table className="tabla">
            <thead>
              <tr>
                <th>Código Req</th>
                <th>Acta de trabajo</th>
                <th className="text-center"># Entrega</th>
                <th className="text-center">F. Comprometida</th>
                <th>Estado</th>
                <th className="text-right">Horas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filas.map((fila) => (
                <tr key={`${fila.reqId}-${fila.entregaNum}`} className="hover:bg-blue-50/40">
                  <td className="px-4 py-3 font-semibold">
                    <Link to={`/requerimientos/${fila.reqId}`} className="text-marca hover:underline font-medium">
                      {fila.codigoReq}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-800">{fila.nombreActa || '—'}</td>
                  <td className="px-4 py-3 text-center text-slate-700">{fila.entregaNum}</td>
                  <td className="px-4 py-3 text-center text-slate-700">
                    {fila.fechaComprometida ? fila.fechaComprometida.slice(0, 10) : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{fila.estado || '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-amber-700">{fmtNumero(fila.horas)}h</td>
                </tr>
              ))}
              {filas.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-slate-400" colSpan={6}>
                    No se encontraron entregas con esa búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-900">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3" colSpan={4}>{fmtNumero(filas.length)} entregas</td>
                <td className="px-4 py-3 text-right">
                  {fmtNumero(filas.reduce((sum, fila) => sum + fila.horas, 0))}h
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
