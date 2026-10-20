// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useMemo, useState } from 'react'
import Modal from '../../components/Modal'
import { Aviso, Boton, Selector } from '../../components/ui'
import { formatearHoras } from './base'
import { contarPlan, etiquetaMes, planificarRellenoCompleto } from './plan'
import { MESES_ABREV, MESES_LARGO } from './tipos'
import type { FilaCapacidad, FilaPlanLote, ModoReemplazo, ResultadoLote } from './tipos'

interface Props {
  abierto: boolean
  onCerrar: () => void
  anio: number
  filas: FilaCapacidad[]
  /** Base sugerida de cada mes del año visible. */
  basePorMes: number[]
  /** Base que se sugería antes (prorrateo de horas_mes_default): reconoce lo no editado. */
  baseAnteriorPorMes: number[]
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
  abierto, onCerrar, anio, filas, basePorMes, baseAnteriorPorMes, indiceMesActual, guardando, aplicarLote, onResultado,
}: Props) {
  const [desdeMes, setDesdeMes] = useState(indiceMesActual >= 0 ? indiceMesActual : 0)
  const [reemplazar, setReemplazar] = useState(false)
  const [modoReemplazo, setModoReemplazo] = useState<ModoReemplazo>('sin_editar')
  const plan = useMemo(
    () => planificarRellenoCompleto(filas, desdeMes, basePorMes, reemplazar, modoReemplazo, baseAnteriorPorMes),
    [filas, desdeMes, basePorMes, reemplazar, modoReemplazo, baseAnteriorPorMes],
  )
  const editadosAMano = plan.filter((p) => p.motivo === 'editado a mano').length
  const conteo = contarPlan(plan)
  const personas = filas.filter((f) => !f.inactiva).length
  const aEscribir = conteo.crear + conteo.actualizar
  const ejemplo = plan.find((p) => p.accion === 'actualizar')

  async function rellenar() {
    const resultado = await aplicarLote(plan)
    onResultado(
      reemplazar
        ? `Rellenar ${anio} (reemplazando ${modoReemplazo === 'sin_editar' ? 'los no editados' : 'todos los registros'})`
        : `Rellenar ${anio} desde ${MESES_LARGO[desdeMes].toLowerCase()}`,
      resultado,
    )
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
          <Selector
            etiqueta="Desde el mes"
            value={reemplazar ? 0 : desdeMes}
            disabled={reemplazar}
            onChange={(e) => setDesdeMes(Number(e.target.value))}
          >
            {MESES_LARGO.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </Selector>
        </div>

        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={reemplazar}
            disabled={guardando}
            onChange={(e) => {
              setReemplazar(e.target.checked)
              if (e.target.checked) setModoReemplazo('sin_editar')
            }}
          />
          <span>
            Reemplazar registros existentes por la base sugerida
            <span className="block text-xs text-slate-500">
              Revisa todo el año desde enero y corrige los meses que difieran de la base.
            </span>
          </span>
        </label>

        {reemplazar && (
          <fieldset className="grid gap-2 pl-6 text-sm text-slate-700" disabled={guardando}>
            <legend className="sr-only">Qué registros reemplazar</legend>
            <label className="flex items-start gap-2">
              <input
                type="radio"
                name="modo-reemplazo"
                className="mt-0.5"
                checked={modoReemplazo === 'sin_editar'}
                onChange={() => setModoReemplazo('sin_editar')}
              />
              <span>Reemplazar solo los que siguen con la base anterior (recomendado)</span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="radio"
                name="modo-reemplazo"
                className="mt-0.5"
                checked={modoReemplazo === 'todos'}
                onChange={() => setModoReemplazo('todos')}
              />
              <span>Reemplazar todos (incluye los editados a mano)</span>
            </label>
          </fieldset>
        )}

        <Aviso tono="info">
          <p>
            Personas: todas las activas con rol (se excluye LT_EPM), <b>{personas}</b>.
          </p>
          <p className="mt-1">
            Horas: la base sugerida de cada mes (días hábiles según los festivos):{' '}
            {MESES_ABREV.slice(desdeMes).map((m, k) => `${m} ${formatearHoras(basePorMes[desdeMes + k])}`).join(' · ')}.
          </p>
          {!reemplazar && <p className="mt-1">Solo se crean las que faltan; nunca se pisa un registro existente.</p>}
        </Aviso>

        {reemplazar ? (
          <>
            {modoReemplazo === 'todos' && (
              <Aviso tono="alerta">
                <p>
                  Se reemplazarán <b>{conteo.actualizar}</b> registros existentes que difieren de la base sugerida.
                  Se pierden las horas editadas a mano en esos registros.
                </p>
              </Aviso>
            )}
            {ejemplo && (
              <p className="text-sm text-slate-600">
                Ejemplo: {ejemplo.nombre}, {etiquetaMes(ejemplo.mes)}:{' '}
                <b>{formatearHoras(ejemplo.horasActuales ?? 0)} → {formatearHoras(ejemplo.horas)}</b>.
              </p>
            )}
            <p className="text-sm text-slate-600" role="status">
              Crear <b>{conteo.crear}</b> · Actualizar <b>{conteo.actualizar}</b> · Omitir <b>{conteo.omitir}</b>
              {modoReemplazo === 'sin_editar' && <> (de ellos, <b>{editadosAMano}</b> editados a mano)</>}
              {' '}(el resto: sin cambios o meses no vigentes).
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-600" role="status">
            Se crearán <b>{conteo.crear}</b> registros{conteo.crear === 0 ? ': todo lo que se ve ya tiene registro.' : '.'}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Boton onClick={onCerrar} disabled={guardando}>Cancelar</Boton>
          <Boton variante="primario" disabled={guardando || aEscribir === 0} onClick={() => void rellenar()}>
            {guardando ? 'Guardando…' : reemplazar ? 'Aplicar base sugerida' : 'Crear registros'}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}
