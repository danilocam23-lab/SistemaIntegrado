// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import Modal from '../../components/Modal'
import { TablaScroll } from '../../components/ui'
import { ordenarEntregasDetalle, type FilaMesAprobacion } from './agruparPorMesAprobacion'

interface Props {
  fila: FilaMesAprobacion | null
  onCerrar: () => void
  formatoMoneda: (valor: number) => string
}

const formatoFecha = (valor: string | null) => (valor ? valor.slice(0, 10) : '—')

/** Detalle de las entregas contadas en una fila de "Entregas por mes de aprobación". */
export default function ModalEntregasMes({ fila, onCerrar, formatoMoneda }: Props) {
  useEffect(() => {
    if (!fila) return
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [fila, onCerrar])

  if (!fila) return null
  const entregas = ordenarEntregasDetalle(fila.entregas)
  const valor = (horas: number) => (fila.valorHora === null ? '—' : formatoMoneda(horas * fila.valorHora))
  return (
    <Modal abierto titulo={`Entregas — ${fila.mes} ${fila.ano}`} onCerrar={onCerrar} ancho="xl">
      <TablaScroll plano>
        <table className="tabla">
          <thead>
            <tr>
              <th>Requerimiento</th>
              <th className="text-center">N.º de entrega</th>
              <th className="text-center">Estado</th>
              <th className="text-center">Horas</th>
              <th className="text-center">F. comprometida</th>
              <th className="text-center">F. aprobación</th>
              <th className="text-center">Valor</th>
            </tr>
          </thead>
          <tbody>
            {entregas.map((e) => (
              <tr key={`${e.requerimientoId}-${e.numero}`} className="text-center tabular-nums">
                <td className="text-left">
                  <Link to={`/requerimientos/${e.requerimientoId}`} className="enlace-accion">
                    {e.codigoReq}
                  </Link>
                  {e.nombreReq && <span className="ml-2 text-slate-500">{e.nombreReq}</span>}
                </td>
                <td>{e.numero}</td>
                <td>{e.estado || '—'}</td>
                <td>{e.horas.toLocaleString('es-CO', { maximumFractionDigits: 1 })}</td>
                <td>{formatoFecha(e.fechaComprometida)}</td>
                <td>{formatoFecha(e.fechaAprobacion)}</td>
                <td>{valor(e.horas)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-marca-osc bg-slate-100 text-center font-bold tabular-nums">
              <td className="text-left">Total ({entregas.length})</td>
              <td colSpan={2} />
              <td>{fila.horas.toLocaleString('es-CO', { maximumFractionDigits: 1 })}</td>
              <td colSpan={2} />
              <td>{valor(fila.horas)}</td>
            </tr>
          </tfoot>
        </table>
      </TablaScroll>
    </Modal>
  )
}
