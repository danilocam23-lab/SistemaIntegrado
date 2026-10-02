// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useState } from 'react'
import { Aviso, Boton, TablaScroll } from '../../components/ui'
import Modal from '../../components/Modal'
import type { Persona } from '../../types'
import { formatearPct } from './carga'
import type { FilaReparto } from './useDerivadosAsignaciones'
import type { FalloReparto } from './useEscriturasAsignaciones'

interface Props {
  persona: Persona | null
  filas: FilaReparto[]
  onAplicar: (filas: FilaReparto[]) => Promise<FalloReparto[]>
  onCerrar: () => void
}

/**
 * Vista previa del reparto igual de las asignaciones activas de una persona
 * (antes → después, suma exactamente 100). Nada cambia hasta pulsar "Aplicar".
 */
export function ModalRedistribuir({ persona, filas, onAplicar, onCerrar }: Props) {
  const [aplicando, setAplicando] = useState(false)
  const [fallos, setFallos] = useState<FalloReparto[]>([])

  const totalNuevo = filas.reduce((s, f) => s + f.pctNuevo, 0)
  const totalActual = filas.reduce((s, f) => s + f.pctActual, 0)
  const hayCambios = filas.some((f) => f.pctNuevo !== f.pctActual)

  async function aplicar() {
    setAplicando(true)
    setFallos([])
    const resultado = await onAplicar(filas)
    setAplicando(false)
    if (resultado.length === 0) onCerrar()
    else setFallos(resultado)
  }

  const mensajePorAsig = new Map(fallos.map((f) => [f.asigId, f.mensaje]))

  return (
    <Modal
      abierto={persona !== null}
      onCerrar={onCerrar}
      titulo={`Revisar reparto${persona ? ` · ${persona.nombre}` : ''}`}
      subtitulo="Reparto igual entre sus asignaciones en requerimientos activos"
      ancho="xl"
    >
      {filas.length === 0 ? (
        <p className="text-sm text-slate-500">Esta persona no tiene asignaciones activas para repartir.</p>
      ) : (
        <div className="grid gap-3">
          <p className="text-sm text-slate-600">
            Hoy suma {formatearPct(totalActual)}%. Con el reparto igual suma {formatearPct(totalNuevo)}%. Los
            porcentajes manuales se reemplazan: revisa antes de aplicar. Nada se guarda hasta pulsar «Aplicar».
          </p>
          <TablaScroll plano>
            <table className="tabla">
              <thead>
                <tr>
                  <th className="text-left">Requerimiento</th>
                  <th className="text-right">Antes</th>
                  <th className="text-right">Después</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((fila) => (
                  <tr key={fila.asig.id}>
                    <td className="font-medium">
                      {fila.reqLabel}
                      {mensajePorAsig.has(fila.asig.id) && (
                        <span role="alert" className="mt-0.5 block text-xs font-normal text-red-600">
                          {mensajePorAsig.get(fila.asig.id)}
                        </span>
                      )}
                    </td>
                    <td className="text-right tabular-nums">{formatearPct(fila.pctActual)}%</td>
                    <td className="text-right font-semibold tabular-nums">{formatearPct(fila.pctNuevo)}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-semibold">
                <tr>
                  <td>Total</td>
                  <td className="text-right tabular-nums">{formatearPct(totalActual)}%</td>
                  <td className="text-right tabular-nums">{formatearPct(totalNuevo)}%</td>
                </tr>
              </tfoot>
            </table>
          </TablaScroll>
          {fallos.length > 0 && (
            <Aviso tono="error">
              No se pudieron guardar {fallos.length} de {filas.length} cambios. Los demás sí se aplicaron.
            </Aviso>
          )}
          <div className="flex justify-end gap-2">
            <Boton onClick={onCerrar}>Cancelar</Boton>
            <Boton variante="primario" disabled={aplicando || !hayCambios} onClick={() => void aplicar()}>
              {aplicando ? 'Aplicando…' : hayCambios ? 'Aplicar reparto' : 'Ya está repartido'}
            </Boton>
          </div>
        </div>
      )}
    </Modal>
  )
}
