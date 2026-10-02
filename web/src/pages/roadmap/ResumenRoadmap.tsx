// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Aviso, Boton, Kpi } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import type { Requerimiento } from '../../types'
import { formatearPct } from '../asignaciones/carga'
import { fechaCorta } from './fechas'
import { CLASE_HITO } from './HitosEntrega'
import type { ReqRoadmap } from './tipos'
import type { ResumenRoadmap } from './useRoadmap'

const ROJO = '#b91c1c'
const AMBAR = '#b45309'

interface PropsKpis {
  resumen: ResumenRoadmap
}

/** Cuatro KPI del rango visible, calculados con los datos ya cargados. */
export function KpisRoadmap({ resumen }: PropsKpis) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
      <Kpi rotulo="Requerimientos en el rango" valor={resumen.requerimientos} nota="con fechas dibujables" />
      <Kpi
        rotulo="Personas con carga"
        valor={resumen.personasConCarga}
        nota={resumen.inactivasConReqs > 0 ? `${resumen.inactivasConReqs} inactiva(s) con requerimientos` : 'activas con requerimientos'}
      />
      <Kpi
        rotulo="Sin asignar"
        valor={resumen.sinAsignar}
        nota="requerimientos sin desarrollador"
        acento={resumen.sinAsignar > 0 ? AMBAR : undefined}
      />
      <Kpi
        rotulo="Vencidos"
        valor={resumen.vencidos.length}
        nota="con entrega comprometida pasada y sin aprobar"
        acento={resumen.vencidos.length > 0 ? ROJO : undefined}
      />
    </div>
  )
}

interface PropsAvisos {
  resumen: ResumenRoadmap
  mostrarSobrecarga: boolean
  sinFecha: Requerimiento[]
  onSeleccionarVencido: (r: ReqRoadmap) => void
}

/** Aviso de vencidos y sobrecarga, y de requerimientos que no se pueden dibujar (sin fecha de inicio). */
export function AvisosRoadmap({ resumen, mostrarSobrecarga, sinFecha, onSeleccionarVencido }: PropsAvisos) {
  const [verLista, setVerLista] = useState(false)
  const navegar = useNavigate()
  const { tienePermiso } = useAuth()
  const sobrecarga = mostrarSobrecarga ? resumen.sobrecarga : []
  const hayAlerta = resumen.vencidos.length > 0 || sobrecarga.length > 0

  return (
    <div className="mb-4 grid gap-3">
      <Aviso tono={hayAlerta ? 'alerta' : 'exito'}>
        <div role="status" className="grid gap-1">
          {!hayAlerta && <span>Sin vencidos ni sobrecarga en este rango.</span>}
          {resumen.vencidos.length > 0 && (
            <span>
              <b>{resumen.vencidos.length} requerimiento(s) vencido(s):</b>{' '}
              {resumen.vencidos.map((r, i) => (
                <span key={r.req.id}>
                  {i > 0 && ', '}
                  <button type="button" className="font-mono underline" onClick={() => onSeleccionarVencido(r)}>
                    {r.req.codigo_req}
                  </button>
                </span>
              ))}
              .
            </span>
          )}
          {sobrecarga.length > 0 && (
            <span>
              <b>Sobrecarga:</b>{' '}
              {sobrecarga.map((g) => `${g.nombre} (${formatearPct(g.carga ?? 0)} %)`).join(', ')} por encima del 100 %.
            </span>
          )}
        </div>
      </Aviso>

      {sinFecha.length > 0 && (
        <Aviso tono="alerta">
          <div className="grid gap-2">
            <span role="status" className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {sinFecha.length} requerimiento(s) no se pueden dibujar: no tienen fecha de solicitud del acta ni de inicio.
              </span>
              <Boton tamano="sm" aria-expanded={verLista} onClick={() => setVerLista((v) => !v)}>
                {verLista ? 'Ocultar lista' : 'Ver lista'}
              </Boton>
            </span>
            {verLista && (
              <ul className="grid max-h-48 gap-1 overflow-auto text-xs">
                {sinFecha.map((req) => (
                  <li key={req.id} className="flex items-center gap-2">
                    <span className="font-mono font-bold">{req.codigo_req}</span>
                    <span className="min-w-0 flex-1 truncate">{req.nombre}</span>
                    {tienePermiso('requerimientos.ver') && (
                      <Boton tamano="sm" variante="fantasma" onClick={() => navegar(`/requerimientos/${req.id}`)}>Abrir</Boton>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Aviso>
      )}
    </div>
  )
}

interface PropsLeyenda {
  categorias: { id: string; nombre: string; color: string }[]
  hoy: Date
  hayHoy: boolean
}

/** Leyenda: categorías (color estable), estados de entrega (◆) y línea «hoy». */
export function LeyendaRoadmap({ categorias, hoy, hayHoy }: PropsLeyenda) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10.5px] text-slate-500">
      {categorias.map((c) => (
        <span key={c.id} className="inline-flex items-center gap-1.5">
          <i aria-hidden="true" className="inline-block h-[9px] w-[9px] rounded-full" style={{ backgroundColor: c.color }} />
          {c.nombre}
        </span>
      ))}
      <span className="ml-auto inline-flex items-center gap-1.5">
        <i aria-hidden="true" className={`inline-block h-2 w-2 rotate-45 rounded-sm border-2 ${CLASE_HITO.ok}`} />Entrega aprobada
      </span>
      <span className="inline-flex items-center gap-1.5">
        <i aria-hidden="true" className={`inline-block h-2 w-2 rotate-45 rounded-sm border-2 ${CLASE_HITO.pend}`} />Pendiente
      </span>
      <span className="inline-flex items-center gap-1.5">
        <i aria-hidden="true" className={`inline-block h-2 w-2 rotate-45 rounded-sm border-2 ${CLASE_HITO.bad}`} />Vencida
      </span>
      <span className="inline-flex items-center gap-1.5">
        <i aria-hidden="true" className="inline-block h-[11px] w-0.5 bg-red-600" />
        Hoy ({fechaCorta(hoy)}){hayHoy ? '' : ' · fuera del rango'}
      </span>
    </div>
  )
}
