// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import type { Entrega } from '../../types'
import { TIPIFICACIONES } from '../../constantes'
import { Boton, Campo, Chip, Selector, TablaScroll } from '../../components/ui'

type TonoChip = 'neutro' | 'marca' | 'exito' | 'alerta' | 'error'

/** Mismo criterio semántico que `EntregasActas.tsx` para el estado de una
 * entrega (ver ADR-0007): aprobada = éxito, rechazada = error, cargada = marca,
 * el resto (pendiente / en espera / no cargada / en garantía) = alerta. */
const TONO_ESTADO_ENTREGA: Record<string, TonoChip> = {
  APROBADA: 'exito',
  RECHAZADA: 'error',
  'ENTREGA CARGADA': 'marca',
  PENDIENTE: 'alerta',
  'EN ESPERA DE APROBACION': 'alerta',
  'ENTREGA NO CARGADA': 'alerta',
  'EN GARANTIA': 'alerta',
}

interface Props {
  entregas: Entrega[]
  totalHorasEstimadas: number | null
  puedeEditarReq: boolean
  puedeEditarTipificacion: boolean
  tipifEdicion: Record<number, { obs: string; tip: string }>
  guardandoTipif: Set<number>
  onIniciarEdicionTipif: (en: Entrega) => void
  onCambiarTipif: (numero: number, campo: 'obs' | 'tip', valor: string) => void
  onCancelarTipif: (numero: number) => void
  onGuardarTipif: (numero: number) => void
  onVerHistorialEntrega: (numero: number) => void
  onEditarEntrega: (en: Entrega) => void
  onEliminarEntrega: (numero: number) => void
  /** Abre el modal de alta; el botón solo aparece si se pasa (permiso de edición). */
  onAgregarEntrega?: () => void
}

/** Celda de texto largo: truncada a una línea, texto completo en `title`. */
function TextoCorto({ texto }: { texto: string | null | undefined }) {
  if (!texto) return <>—</>
  return (
    <span className="block max-w-[14rem] truncate" title={texto}>
      {texto}
    </span>
  )
}

export default function SeccionEntregas({
  entregas,
  totalHorasEstimadas,
  puedeEditarReq,
  puedeEditarTipificacion,
  tipifEdicion,
  guardandoTipif,
  onIniciarEdicionTipif,
  onCambiarTipif,
  onCancelarTipif,
  onGuardarTipif,
  onVerHistorialEntrega,
  onEditarEntrega,
  onEliminarEntrega,
  onAgregarEntrega,
}: Props) {
  const asignadas = entregas.reduce((s, e) => s + Number(e.horas ?? 0), 0)

  return (
    <div className="tarjeta tarjeta-pad">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="etiqueta-sup">
          Entregas ({entregas.length})
        </h2>
        {onAgregarEntrega && (
          <Boton variante="secundario" tamano="sm" onClick={onAgregarEntrega}>
            + Agregar entrega
          </Boton>
        )}
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Horas estimadas: <b>{totalHorasEstimadas ?? '—'}</b> · Asignadas en entregas:{' '}
        <b>{asignadas}</b>
        {totalHorasEstimadas != null && (
          <>
            {' '}· Disponibles: <b>{Number(totalHorasEstimadas) - asignadas}</b>
          </>
        )}
      </p>

      {entregas.length === 0 ? (
        <p className="text-sm text-slate-400">Sin entregas todavía</p>
      ) : (
        <TablaScroll plano>
          <table className="tabla">
            <thead>
              <tr>
                <th>N.º</th>
                <th>Estado</th>
                <th className="text-right">Horas</th>
                <th className="text-right">% Avance</th>
                <th>F. Comprometida</th>
                <th>F. Real</th>
                <th>Mes aprobación</th>
                <th>Obs. EPM</th>
                <th>Obs. Hitss</th>
                <th>Tipificación</th>
                <th>ANS</th>
                <th>Garantía</th>
                <th>N.º Garantía</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody className="[&_td]:tabular-nums">
              {entregas.map((en) => {
                const edicionTipif = tipifEdicion[en.numero]
                const guardando = guardandoTipif.has(en.numero)
                const porcentaje = en.horas != null && totalHorasEstimadas
                  ? ((Number(en.horas) * 100) / Number(totalHorasEstimadas)).toFixed(1)
                  : null
                const tonoEstado = en.estado
                  ? TONO_ESTADO_ENTREGA[en.estado.toUpperCase()] ?? 'neutro'
                  : 'neutro'
                return (
                  <tr key={en.numero}>
                    <td className="font-semibold text-slate-800">{en.numero}</td>
                    <td>
                      <Chip tono={tonoEstado}>{en.estado || '—'}</Chip>
                    </td>
                    <td className="text-right">{en.horas ?? '—'}</td>
                    <td className="text-right">{porcentaje != null ? `${porcentaje}%` : '—'}</td>
                    <td className="whitespace-nowrap">{en.fecha_comprometida?.slice(0, 10) ?? '—'}</td>
                    <td className="whitespace-nowrap">{en.fecha_recepcion?.slice(0, 10) ?? '—'}</td>
                    <td className="whitespace-nowrap">{en.mes_aprobacion ?? '—'}</td>
                    <td><TextoCorto texto={en.observaciones} /></td>
                    <td>
                      {edicionTipif ? (
                        <Campo
                          aria-label={`Observaciones Hitss de la entrega ${en.numero}`}
                          value={edicionTipif.obs}
                          onChange={(ev) => onCambiarTipif(en.numero, 'obs', ev.target.value)}
                          compacto
                          className="w-48"
                        />
                      ) : <TextoCorto texto={en.observaciones_hitss} />}
                    </td>
                    <td>
                      {edicionTipif ? (
                        <Selector
                          aria-label={`Tipificación de la entrega ${en.numero}`}
                          value={edicionTipif.tip}
                          onChange={(ev) => onCambiarTipif(en.numero, 'tip', ev.target.value)}
                          compacto
                        >
                          <option value="">— Seleccionar —</option>
                          {TIPIFICACIONES.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
                        </Selector>
                      ) : (en.tipificacion ?? '—')}
                    </td>
                    <td>
                      {en.ans_entrega === 'CUMPLE' ? (
                        <Chip tono="exito">Cumple</Chip>
                      ) : en.ans_entrega === 'NO_CUMPLE' ? (
                        <Chip tono="error">No cumple</Chip>
                      ) : '—'}
                    </td>
                    <td>
                      {en.garantia ? <Chip tono="marca">Sí</Chip> : <Chip tono="neutro">No</Chip>}
                    </td>
                    <td>{en.numero_garantia ?? '—'}</td>
                    <td>
                      <div className="flex flex-nowrap items-center gap-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onVerHistorialEntrega(en.numero)}
                          aria-label={`Ver historial de la entrega ${en.numero}`}
                          className="enlace-accion enlace-accion-sutil"
                        >
                          Historial
                        </button>
                        {puedeEditarReq && (
                          <>
                            <button
                              type="button"
                              onClick={() => onEditarEntrega(en)}
                              aria-label={`Editar la entrega ${en.numero}`}
                              className="enlace-accion"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => onEliminarEntrega(en.numero)}
                              aria-label={`Eliminar la entrega ${en.numero}`}
                              className="enlace-accion enlace-accion-peligro"
                            >
                              Eliminar
                            </button>
                          </>
                        )}
                        {!puedeEditarReq && puedeEditarTipificacion && (
                          edicionTipif ? (
                            <>
                              <button
                                type="button"
                                disabled={guardando}
                                onClick={() => onGuardarTipif(en.numero)}
                                aria-label={`Guardar tipificación de la entrega ${en.numero}`}
                                className="enlace-accion disabled:opacity-50"
                              >
                                Guardar
                              </button>
                              <button
                                type="button"
                                onClick={() => onCancelarTipif(en.numero)}
                                aria-label={`Cancelar edición de la entrega ${en.numero}`}
                                className="enlace-accion enlace-accion-sutil"
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onIniciarEdicionTipif(en)}
                              aria-label={`Editar datos Hitss de la entrega ${en.numero}`}
                              className="enlace-accion"
                            >
                              Editar Hitss
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </TablaScroll>
      )}
    </div>
  )
}
