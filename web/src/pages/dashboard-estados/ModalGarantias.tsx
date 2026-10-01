// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Chip, TablaScroll } from '../../components/ui'
import { fmtNumero } from './constantes'
import type { DetalleGarantiasAbierto } from './tipos'

/** Botón verde con el número de garantías; abre el modal de detalle. */
export function BotonGarantias({ valor, onClick }: { valor: number; onClick: () => void }) {
  if (valor <= 0) return <Chip tono="exito">{valor}</Chip>

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center rounded-lg bg-green-100 px-3 py-2 text-sm font-semibold text-green-700 underline-offset-2 transition-colors hover:bg-green-200 hover:underline focus:outline-none focus:ring-2 focus:ring-green-300"
      title="Ver detalle de garantías"
    >
      {valor}
    </button>
  )
}

export default function ModalGarantias({
  detalle,
  onCerrar,
}: {
  detalle: DetalleGarantiasAbierto
  onCerrar: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="titulo-seccion">{detalle.titulo}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {fmtNumero(detalle.filas.length)} entrega(s) marcadas como garantía.
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar detalle de garantías"
          >
            ✕
          </button>
        </div>

        <div className="p-6">
          {detalle.filas.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">Sin garantías para mostrar.</p>
          ) : (
            <TablaScroll className="max-h-[70vh] overflow-y-auto">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>REQ</th>
                    <th>Nombre</th>
                    <th className="text-center">Entrega</th>
                    <th>Estado</th>
                    <th className="text-right">Horas</th>
                    <th className="text-center">Comprometida</th>
                    <th className="text-center">Recepción</th>
                    <th>Observaciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detalle.filas.map((fila) => (
                    <tr key={`${fila.reqId}-${fila.numeroEntrega}`} className="hover:bg-blue-50/40">
                      <td className="px-4 py-3 font-mono font-semibold text-blue-700">{fila.codigoReq}</td>
                      <td className="px-4 py-3 text-slate-700">{fila.nombreReq}</td>
                      <td className="px-4 py-3 text-center font-semibold text-slate-900">{fila.numeroEntrega}</td>
                      <td className="px-4 py-3 text-slate-700">{fila.estadoEntrega}</td>
                      <td className="px-4 py-3 text-right font-semibold text-amber-700">{fmtNumero(fila.horas)}h</td>
                      <td className="px-4 py-3 text-center text-slate-600">{fila.fechaComprometida?.slice(0, 10) ?? '—'}</td>
                      <td className="px-4 py-3 text-center text-slate-600">{fila.fechaRecepcion?.slice(0, 10) ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{fila.observaciones || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TablaScroll>
          )}
        </div>
      </div>
    </div>
  )
}
