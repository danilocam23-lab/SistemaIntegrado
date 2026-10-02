// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { memo } from 'react'
import { Boton } from '../../components/ui'
import { CAMPOS_TASK10, CAMPOS_TASK20, CAMPOS_TASK30 } from './tiposSolicitudes'
import type { RegistroSoporte } from './tiposSolicitudes'

interface FilaProps {
  registro: RegistroSoporte
  headers: string[]
  onVerDescripcion: (desc: string) => void
  onVerTask: (datos: Record<string, string>, campos: string[], titulo: string) => void
}

export const FilaRegistro = memo(function FilaRegistro({ registro: r, headers, onVerDescripcion, onVerTask }: FilaProps) {
  const tieneTask10 = CAMPOS_TASK10.some((c) => r.datos?.[c])
  const tieneTask20 = CAMPOS_TASK20.some((c) => r.datos?.[c])
  const tieneTask30 = CAMPOS_TASK30.some((c) => r.datos?.[c])
  return (
    <tr>
      <td>{r.fila_origen}</td>
      <td>{r.lider}</td>
      <td>{r.squad}</td>
      <td>
        {r.datos?.['Detailed Description'] ? (
          <Boton
            variante="primario"
            tamano="sm"
            onClick={() => onVerDescripcion(r.datos['Detailed Description'])}
            title="Ver descripción completa"
          >
            Ver detalle
          </Boton>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td>
        {/* Excepcion ADR-0007 (compuerta 1): el matiz indigo/violeta/teal anterior
            era decoracion — la cabecera ya identifica cada Task y esto es una accion,
            no una insignia. No se le devuelve color. */}
        {tieneTask10 ? (
          <Boton
            variante="suave"
            tamano="sm"
            onClick={() => onVerTask(r.datos, CAMPOS_TASK10, 'Detalle Task 10')}
          >
            Ver detalle
          </Boton>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td>
        {tieneTask20 ? (
          <Boton
            variante="suave"
            tamano="sm"
            onClick={() => onVerTask(r.datos, CAMPOS_TASK20, 'Detalle Task 20')}
          >
            Ver detalle
          </Boton>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td>
        {tieneTask30 ? (
          <Boton
            variante="suave"
            tamano="sm"
            onClick={() => onVerTask(r.datos, CAMPOS_TASK30, 'Detalle Task 30')}
          >
            Ver detalle
          </Boton>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      {headers.map((h) => (
        <td key={`${r.id}-${h}`}>{r.datos?.[h] ?? ''}</td>
      ))}
    </tr>
  )
})
