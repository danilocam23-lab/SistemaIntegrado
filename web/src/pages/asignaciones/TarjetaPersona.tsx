// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Campo, Chip, Icono, TablaScroll } from '../../components/ui'
import type { BacklogFuturo, Categoria } from '../../types'
import { tonoEstadoChip } from './estados'
import type { GrupoPersona, WoPersona } from './tipos'
import { TablaWoPersona } from './TablaWoPersona'
import type { useEscriturasAsignaciones } from './useEscriturasAsignaciones'

const ESTADO_BACKLOG_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROGRESO: 'En progreso',
  COMPLETADO: 'Completado',
  CANCELADO: 'Cancelado',
}

const ESTADO_BACKLOG_TONO: Record<string, 'neutro' | 'marca' | 'exito' | 'alerta' | 'error'> = {
  PENDIENTE: 'alerta',
  EN_PROGRESO: 'marca',
  COMPLETADO: 'exito',
  CANCELADO: 'neutro',
}

interface Props {
  grupo: GrupoPersona
  expandida: boolean
  onToggle: () => void
  categoriaPorId: Map<string, Categoria>
  wos: WoPersona[]
  backlogFuturo: BacklogFuturo[]
  puedeEditarAsignaciones: boolean
  escrituras: ReturnType<typeof useEscriturasAsignaciones>
}

/**
 * Tarjeta de una persona en la vista "Por Personas": cabecera con contadores
 * (asignaciones, horas de carga, backlog futuro y WO) + tabla de
 * requerimientos asignados + bloque informativo de backlog futuro + tabla de
 * WO de soporte.
 */
export function TarjetaPersona({
  grupo,
  expandida,
  onToggle,
  categoriaPorId,
  wos,
  backlogFuturo,
  puedeEditarAsignaciones,
  escrituras,
}: Props) {
  const totalHoras = grupo.reqs.reduce((s, r) => s + r.horasCarga, 0)

  return (
    <section className="tarjeta overflow-hidden">
      <div className="flex items-center justify-between gap-3 bg-marca-osc px-4 py-3 text-white">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <Icono nombre="chevron-abajo" className={`transition-transform ${expandida ? '' : '-rotate-90'}`} />
          <span className="truncate text-sm font-semibold">{grupo.persona.nombre}</span>
          <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-xs">{grupo.reqs.length} asignaciones</span>
          <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-xs">{totalHoras.toFixed(0)}h carga</span>
          {backlogFuturo.length > 0 && (
            <span className="shrink-0 rounded-full bg-red-400/30 px-2 py-0.5 text-xs">{backlogFuturo.length} backlog</span>
          )}
          {wos.length > 0 && (
            <span className="shrink-0 rounded-full bg-emerald-400/30 px-2 py-0.5 text-xs">{wos.length} WO</span>
          )}
        </button>
      </div>
      {expandida && (
        <div className="space-y-0">
          <TablaScroll plano>
            <table className="tabla">
              <thead>
                <tr>
                  <th className="text-left">Requerimiento</th>
                  <th className="text-left">Estado</th>
                  <th className="text-left">Categoría</th>
                  <th className="text-right">%</th>
                  <th className="text-right">Horas carga</th>
                </tr>
              </thead>
              <tbody>
                {grupo.reqs.map((r) => {
                  const enEdicionInline = escrituras.edicionInlineId === r.asig.id

                  return (
                    <tr key={r.asig.id}>
                      <td className="font-medium">{r.reqLabel}</td>
                      <td>
                        {r.reqEstado && (
                          <Chip tono={tonoEstadoChip(r.reqEstado)} className="px-2 py-0.5 text-[10px]">
                            {r.reqEstado}
                          </Chip>
                        )}
                      </td>
                      <td>{categoriaPorId.get(r.asig.categoria_id)?.nombre ?? '—'}</td>
                      <td className="text-right font-medium">
                        {enEdicionInline ? (
                          <Campo
                            autoFocus
                            type="number"
                            min="0"
                            max="100"
                            value={escrituras.edicionInlineValor}
                            onChange={(e) => escrituras.setEdicionInlineValor(e.target.value)}
                            onBlur={() => void escrituras.guardarEdicionInline(r.asig)}
                            onKeyDown={escrituras.onInlineKeyDown}
                            compacto
                            className="ml-auto w-20 text-right"
                          />
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <span className={r.asig.total_porcentaje === 0 ? 'text-red-500' : ''}>
                              {r.asig.total_porcentaje}%
                            </span>
                            {puedeEditarAsignaciones && (
                              <button
                                type="button"
                                onClick={() => escrituras.iniciarEdicionInline(r.asig)}
                                title="Editar %"
                                className="text-slate-400 hover:text-marca"
                              >
                                <Icono nombre="lapiz" tamano={14} />
                              </button>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="text-right font-mono">{r.horasCarga.toFixed(1)}</td>
                    </tr>
                  )
                })}
                {grupo.reqs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-sm text-slate-400">
                      Sin asignaciones reales para mostrar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TablaScroll>
          {backlogFuturo.length > 0 && (
            <div className="border-t bg-red-50/70 px-3 py-2">
              {/* Se separa del bloque de asignaciones para dejar claro que no es carga real editable. */}
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-red-700">
                Backlog futuro informativo ({backlogFuturo.length})
              </p>
              <TablaScroll plano>
                <table className="tabla">
                  <thead>
                    <tr>
                      <th className="text-left">Iniciativa</th>
                      <th className="text-left">Contexto</th>
                      <th className="text-left">Tipo de demanda</th>
                      <th className="text-left">Estado</th>
                      <th className="text-center">F. tentativa de inicio</th>
                      <th className="text-right">Horas aprox.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backlogFuturo.map((item) => (
                      <tr key={item.id} className="bg-red-50 text-red-700">
                        <td className="font-medium">{item.nombre_iniciativa}</td>
                        <td>
                          <Chip tono="error" className="px-2 py-0.5 text-[10px]">
                            Backlog futuro
                          </Chip>
                        </td>
                        <td>{item.tipo_demanda || '—'}</td>
                        <td>
                          <Chip tono={ESTADO_BACKLOG_TONO[item.estado] ?? 'neutro'} className="px-2 py-0.5 text-[10px]">
                            {ESTADO_BACKLOG_LABEL[item.estado] ?? item.estado}
                          </Chip>
                        </td>
                        <td className="text-center">{item.fecha_tentativa_inicio || '—'}</td>
                        <td className="text-right font-mono">{(item.horas_aproximadas ?? 0).toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TablaScroll>
            </div>
          )}
          <TablaWoPersona wos={wos} />
        </div>
      )}
    </section>
  )
}
