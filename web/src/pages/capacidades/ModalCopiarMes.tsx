// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useMemo, useState } from 'react'
import Modal from '../../components/Modal'
import { Aviso, Boton, Chip, Selector, TablaScroll } from '../../components/ui'
import { formatearHoras } from './base'
import { contarPlan, planificarCopiaMes } from './plan'
import { MESES_LARGO } from './tipos'
import type { FilaCapacidad, FilaPlanLote, ResultadoLote } from './tipos'

interface Props {
  abierto: boolean
  onCerrar: () => void
  anio: number
  filas: FilaCapacidad[]
  /** Mes en curso (índice) si el año visible es el actual; `-1` si no. */
  indiceMesActual: number
  guardando: boolean
  aplicarLote: (plan: FilaPlanLote[]) => Promise<ResultadoLote>
  onResultado: (titulo: string, resultado: ResultadoLote) => void
}

/**
 * "Copiar mes": copia las horas registradas de un mes de origen a otro mes para
 * todas las personas activas. Muestra primero qué se crea, qué se actualiza y qué
 * se omite; por defecto solo rellena celdas vacías.
 */
export function ModalCopiarMes({
  abierto, onCerrar, anio, filas, indiceMesActual, guardando, aplicarLote, onResultado,
}: Props) {
  const destinoInicial = indiceMesActual >= 0 ? indiceMesActual : 0
  const [desde, setDesde] = useState(Math.max(0, destinoInicial - 1))
  const [hasta, setHasta] = useState(destinoInicial)
  const [sobrescribir, setSobrescribir] = useState(false)

  const plan = useMemo(() => planificarCopiaMes(filas, desde, hasta, sobrescribir), [filas, desde, hasta, sobrescribir])
  const conteo = contarPlan(plan)
  const aplicables = conteo.crear + conteo.actualizar
  const mismoMes = desde === hasta

  async function copiar() {
    const resultado = await aplicarLote(plan)
    onResultado(`Copiar ${MESES_LARGO[desde].toLowerCase()} a ${MESES_LARGO[hasta].toLowerCase()} de ${anio}`, resultado)
    if (resultado.errores.length === 0) onCerrar()
  }

  return (
    <Modal titulo="Copiar mes" abierto={abierto} onCerrar={onCerrar} ancho="xl">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <Selector etiqueta="Desde" value={desde} onChange={(e) => setDesde(Number(e.target.value))}>
            {MESES_LARGO.map((m, i) => <option key={m} value={i}>{m} {anio}</option>)}
          </Selector>
          <Selector etiqueta="Hasta" value={hasta} onChange={(e) => setHasta(Number(e.target.value))}>
            {MESES_LARGO.map((m, i) => <option key={m} value={i}>{m} {anio}</option>)}
          </Selector>
          <div role="group" aria-label="Qué hacer con las celdas que ya tienen registro" className="flex gap-1">
            <Boton tamano="sm" variante={!sobrescribir ? 'primario' : 'secundario'} aria-pressed={!sobrescribir}
              onClick={() => setSobrescribir(false)}>Solo celdas vacías</Boton>
            <Boton tamano="sm" variante={sobrescribir ? 'primario' : 'secundario'} aria-pressed={sobrescribir}
              onClick={() => setSobrescribir(true)}>Sobrescribir</Boton>
          </div>
        </div>

        {mismoMes && <Aviso tono="alerta">El mes de origen y el de destino deben ser distintos.</Aviso>}

        <div className="max-h-72 overflow-y-auto">
          <TablaScroll plano>
            <table className="tabla">
              <thead>
                <tr>
                  <th>Persona</th>
                  <th className="text-right">{MESES_LARGO[desde].slice(0, 3)}</th>
                  <th className="text-right">{MESES_LARGO[hasta].slice(0, 3)} hoy</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {plan.map((p) => {
                  const origen = filas.find((f) => f.persona.id === p.personaId)?.celdas[desde].horas ?? null
                  return (
                    <tr key={p.personaId}>
                      <td>{p.nombre}</td>
                      <td className="text-right tabular-nums">{origen === null ? '—' : formatearHoras(origen)}</td>
                      <td className="text-right tabular-nums">{p.horasActuales === null ? '—' : formatearHoras(p.horasActuales)}</td>
                      <td>
                        {p.accion === 'crear' && <Chip tono="exito">Se crea · {formatearHoras(p.horas)}</Chip>}
                        {p.accion === 'actualizar' && <Chip tono="alerta">Se actualiza · {formatearHoras(p.horas)}</Chip>}
                        {p.accion === 'omitir' && <Chip>Se omite{p.motivo ? ` (${p.motivo})` : ''}</Chip>}
                      </td>
                    </tr>
                  )
                })}
                {plan.length === 0 && (
                  <tr><td colSpan={4} className="p-4 text-center text-slate-500">No hay personas activas para copiar.</td></tr>
                )}
              </tbody>
            </table>
          </TablaScroll>
        </div>

        <p className="text-sm text-slate-600" role="status">
          Resumen: {conteo.crear} se crean, {conteo.actualizar} se actualizan, {conteo.omitir} se omiten.
          Si alguna llamada falla, un aviso final cuenta cuántas fueron.
        </p>

        <div className="flex justify-end gap-2">
          <Boton onClick={onCerrar} disabled={guardando}>Cancelar</Boton>
          <Boton variante="primario" disabled={guardando || mismoMes || aplicables === 0} onClick={() => void copiar()}>
            {guardando ? 'Copiando…' : `Copiar ${aplicables} registro${aplicables === 1 ? '' : 's'}`}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}
