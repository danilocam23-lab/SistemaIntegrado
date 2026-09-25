// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Aviso, Icono } from '../../components/ui'
import type { FilaSquadAnalisis, ResumenRiesgo } from './tipos'

interface Props {
  filas: FilaSquadAnalisis[]
  resumen: ResumenRiesgo
}

const MAX_NOMBRES = 4

function listarNombres(nombres: string[]): string {
  if (nombres.length <= MAX_NOMBRES) return nombres.join(', ')
  return `${nombres.slice(0, MAX_NOMBRES).join(', ')} y ${nombres.length - MAX_NOMBRES} más`
}

/**
 * Banner de alertas del periodo: squads con ANS Acta o ANS Entrega bajo umbral
 * (<50% crítico, 50-74% en atención) y squads en sobrecarga de capacidad. Si
 * todo está en verde muestra un aviso de éxito; sin squads no muestra nada.
 */
export default function BannerRiesgo({ filas, resumen }: Props) {
  if (filas.length === 0) return null

  if (resumen.enRiesgo === 0) {
    return (
      <Aviso tono="exito">
        <span className="flex items-center gap-2">
          <Icono nombre="check-circulo" />
          Todos los squads cumplen los umbrales de ANS y su carga está dentro de la capacidad.
        </span>
      </Aviso>
    )
  }

  const criticos = filas.filter((fila) => fila.nivelGlobal === 'error').map((fila) => fila.squad)
  const enAtencion = filas.filter((fila) => fila.nivelGlobal === 'alerta').map((fila) => fila.squad)
  const sobrecargados = filas.filter((fila) => fila.sobrecarga).map((fila) => fila.squad)

  return (
    <Aviso tono={criticos.length > 0 ? 'error' : 'alerta'}>
      <div className="flex items-start gap-2" role="alert">
        <span className="mt-0.5 shrink-0">
          <Icono nombre="alerta" />
        </span>
        <ul className="space-y-0.5">
          {criticos.length > 0 && (
            <li>
              <strong>{criticos.length} squad(s) críticos</strong> con ANS por debajo de 50%: {listarNombres(criticos)}.
            </li>
          )}
          {enAtencion.length > 0 && (
            <li>
              <strong>{enAtencion.length} squad(s) en atención</strong> con ANS entre 50% y 74%: {listarNombres(enAtencion)}.
            </li>
          )}
          {sobrecargados.length > 0 && (
            <li>
              <strong>{sobrecargados.length} squad(s) en sobrecarga</strong>: las horas de entregas del periodo superan la capacidad disponible ({listarNombres(sobrecargados)}).
            </li>
          )}
        </ul>
      </div>
    </Aviso>
  )
}
