// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Campo, Chip } from '../../components/ui'
import type { FilaDetallePersona } from './tipos'
import { fmtNumero } from './utilidades'

interface Props {
  filas: FilaDetallePersona[]
  totalPeriodos: number
  busqueda: string
  onBusqueda: (valor: string) => void
  onCerrar: () => void
}

export default function ModalDetallePersonas({ filas, totalPeriodos, busqueda, onBusqueda, onCerrar }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="titulo-seccion">Detalle capacidad por persona</h2>
            <p className="mt-1 text-sm text-slate-500">
              Horas configuradas por persona y squad · {totalPeriodos} periodo(s) seleccionados.
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar detalle de capacidad por persona"
          >
            ✕
          </button>
        </div>

        <div className="border-b border-slate-100 px-6 py-4">
          <Campo
            etiqueta="Buscar por persona o squad"
            type="search"
            value={busqueda}
            onChange={(event) => onBusqueda(event.target.value)}
            placeholder="Ej: José Danilo"
            className="w-full"
          />
        </div>

        <div className="max-h-[62vh] overflow-auto p-6">
          <table className="tabla">
            <thead>
              <tr>
                <th>Persona</th>
                <th>Squad</th>
                <th className="text-right">Horas</th>
                <th className="text-center">Origen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filas.map((fila) => (
                <tr key={`${fila.personaId}-${fila.squad}`} className="hover:bg-blue-50/40">
                  <td className="px-4 py-3 font-medium text-slate-800">{fila.nombre}</td>
                  <td className="px-4 py-3 text-slate-600">{fila.squad}</td>
                  <td className="px-4 py-3 text-right font-semibold text-amber-700">{fmtNumero(fila.horas)}h</td>
                  <td className="px-4 py-3 text-center">
                    {fila.personalizada ? (
                      <Chip tono="marca">{fila.predeterminada ? 'Mixto' : 'Configurada'}</Chip>
                    ) : (
                      <Chip tono="exito">Por defecto</Chip>
                    )}
                  </td>
                </tr>
              ))}
              {filas.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-slate-400" colSpan={4}>
                    No se encontraron personas con esa búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-900">
                <td className="px-4 py-3" colSpan={2}>Total</td>
                <td className="px-4 py-3 text-right">
                  {fmtNumero(filas.reduce((sum, fila) => sum + fila.horas, 0))}h
                </td>
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
