// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useMemo, useState } from 'react'
import Modal from '../../components/Modal'
import { Aviso, Boton, Selector } from '../../components/ui'
import { formatearHoras } from './base'
import { contarPlan, planificarRelleno } from './plan'
import { MESES_ABREV, MESES_LARGO } from './tipos'
import type { FilaCapacidad, FilaPlanLote, ResultadoLote } from './tipos'

interface Props {
  abierto: boolean
  onCerrar: () => void
  anio: number
  filas: FilaCapacidad[]
  /** Base sugerida de cada mes del año visible. */
  basePorMes: number[]
  /** Mes en curso (índice) si el año visible es el actual; `-1` si no. */
  indiceMesActual: number
  guardando: boolean
  aplicarLote: (plan: FilaPlanLote[]) => Promise<ResultadoLote>
  onResultado: (titulo: string, resultado: ResultadoLote) => void
}

/**
 * "Rellenar año con la base sugerida": crea los registros que faltan desde el
 * mes elegido con la base de cada mes (días hábiles según los festivos). Solo
 * crea; nunca pisa un registro existente.
 */
export function ModalRellenarAnio({
  abierto, onCerrar, anio, filas, basePorMes, indiceMesActual, guardando, aplicarLote, onResultado,
}: Props) {
  const [desdeMes, setDesdeMes] = useState(indiceMesActual >= 0 ? indiceMesActual : 0)
  const plan = useMemo(() => planificarRelleno(filas, desdeMes, basePorMes), [filas, desdeMes, basePorMes])
  const conteo = contarPlan(plan)
  const personas = filas.filter((f) => !f.inactiva).length

  async function rellenar() {
    const resultado = await aplicarLote(plan)
    onResultado(`Rellenar ${anio} desde ${MESES_LARGO[desdeMes].toLowerCase()}`, resultado)
    if (resultado.errores.length === 0) onCerrar()
  }

  return (
    <Modal titulo="Rellenar año con la base sugerida" abierto={abierto} onCerrar={onCerrar}>
      <div className="grid gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <span className="etiqueta">Año</span>
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
              {anio}
            </p>
          </div>
          <Selector etiqueta="Desde el mes" value={desdeMes} onChange={(e) => setDesdeMes(Number(e.target.value))}>
            {MESES_LARGO.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </Selector>
        </div>

        <Aviso tono="info">
          <p>
            Personas: todas las activas con rol (se excluye LT_EPM), <b>{personas}</b>.
          </p>
          <p className="mt-1">
            Horas: la base sugerida de cada mes (días hábiles según los festivos):{' '}
            {MESES_ABREV.slice(desdeMes).map((m, k) => `${m} ${formatearHoras(basePorMes[desdeMes + k])}`).join(' · ')}.
          </p>
          <p className="mt-1">Solo se crean las que faltan; nunca se pisa un registro existente.</p>
        </Aviso>

        <p className="text-sm text-slate-600" role="status">
          Se crearán <b>{conteo.crear}</b> registros{conteo.crear === 0 ? ': todo lo que se ve ya tiene registro.' : '.'}
        </p>

        <div className="flex justify-end gap-2">
          <Boton onClick={onCerrar} disabled={guardando}>Cancelar</Boton>
          <Boton variante="primario" disabled={guardando || conteo.crear === 0} onClick={() => void rellenar()}>
            {guardando ? 'Creando…' : 'Crear registros'}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}
