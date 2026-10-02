// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useNavigate } from 'react-router-dom'
import { Boton, Chip } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { AvatarPersona } from '../asignaciones/AvatarPersona'
import { formatearPct } from '../asignaciones/carga'
import { fechaCorta } from './fechas'
import { ETIQUETA_HITO } from './HitosEntrega'
import { PanelLateral } from '../asignaciones/PanelLateral'
import type { AsignacionRoadmap, CategoriaRoadmap, PersonaRoadmap, ReqRoadmap, TonoHito } from './tipos'

const TONO_CHIP: Record<TonoHito, 'exito' | 'alerta' | 'error'> = { ok: 'exito', pend: 'alerta', bad: 'error' }

interface Props {
  seleccionado: ReqRoadmap | null
  personas: PersonaRoadmap[]
  asignaciones: AsignacionRoadmap[]
  categoriasPorId: Map<string, CategoriaRoadmap>
  onCerrar: () => void
}

/** Detalle de solo lectura de un requerimiento del Roadmap, con enlaces al requerimiento y a Asignaciones. */
export function PanelDetalleRoadmap({ seleccionado, personas, asignaciones, categoriasPorId, onCerrar }: Props) {
  const navegar = useNavigate()
  const { tienePermiso } = useAuth()
  const r = seleccionado

  const asignadas = r
    ? asignaciones
      .filter((a) => a.proyectos.some((p) => p.requerimiento_id === r.req.id))
      .map((a) => ({
        id: a.id,
        persona: personas.find((p) => p.id === a.persona_id)?.nombre ?? 'Persona desconocida',
        categoria: categoriasPorId.get(a.categoria_id)?.nombre ?? 'Sin categoría',
        pct: a.total_porcentaje,
      }))
    : []

  return (
    <PanelLateral
      abierto={r !== null}
      onCerrar={onCerrar}
      titulo={r ? <span><span className="font-mono">{r.req.codigo_req}</span>{r.req.nombre ? ` · ${r.req.nombre}` : ''}</span> : ''}
      pie={r && (
        <>
          {tienePermiso('requerimientos.ver') && (
            <Boton variante="primario" onClick={() => navegar(`/requerimientos/${r.req.id}`)}>Abrir requerimiento</Boton>
          )}
          {tienePermiso('asignaciones.ver') && (
            <Boton onClick={() => navegar('/asignaciones')}>Ver en Asignaciones</Boton>
          )}
          <span className="ml-auto text-xs text-slate-500">Esc para cerrar</span>
        </>
      )}
    >
      {r && (
        <div className="grid gap-4 text-sm">
          <div className="flex flex-wrap gap-1.5">
            <Chip tono={r.vencido ? 'error' : 'marca'}>{r.vencido ? 'Vencido' : r.req.estado}</Chip>
            {r.vencido && <Chip>{r.req.estado}</Chip>}
            <Chip>{r.categoriaNombre}</Chip>
          </div>

          <section>
            <h3 className="etiqueta-sup">Fechas</h3>
            <dl className="grid gap-1 text-xs">
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Inicio (acta o inicio)</dt><dd className="font-semibold tabular-nums">{fechaCorta(r.inicio)}</dd></div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Última entrega comprometida</dt>
                <dd className="font-semibold tabular-nums">{r.hitos.length > 0 ? fechaCorta(r.fin) : 'Sin entregas comprometidas'}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h3 className="etiqueta-sup">Entregas · {r.req.entregas?.length ?? 0}</h3>
            {r.hitos.length === 0 && r.entregasSinFecha === 0 && <p className="text-xs text-slate-500">Sin entregas comprometidas.</p>}
            <ul className="grid gap-1.5">
              {r.hitos.map((h) => (
                <li key={`${h.numero}-${h.fecha.getTime()}`} className="flex items-center justify-between gap-3 text-xs">
                  <span><span aria-hidden="true">◆ </span>#{h.numero} · <span className="tabular-nums">{fechaCorta(h.fecha)}</span></span>
                  <Chip tono={TONO_CHIP[h.tono]}>{h.estado ?? ETIQUETA_HITO[h.tono]}</Chip>
                </li>
              ))}
            </ul>
            {r.entregasSinFecha > 0 && (
              <p className="mt-1.5 text-xs text-slate-500">
                {r.entregasSinFecha} entrega(s) sin fecha comprometida: no se dibujan.
              </p>
            )}
          </section>

          <section>
            <h3 className="etiqueta-sup">Asignadas · de Asignaciones</h3>
            {asignadas.length === 0 ? (
              <p className="text-xs text-slate-500">Sin asignaciones vinculadas a este requerimiento.</p>
            ) : (
              <ul className="grid gap-2">
                {asignadas.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 text-xs">
                    <AvatarPersona nombre={a.persona} pequeno />
                    <span><b>{a.persona}</b> · {a.categoria} · {formatearPct(a.pct)} %</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </PanelLateral>
  )
}
