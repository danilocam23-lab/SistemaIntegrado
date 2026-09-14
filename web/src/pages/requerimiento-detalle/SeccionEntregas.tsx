import type { ReactNode } from 'react'
import type { Entrega } from '../../types'
import { Campo, Chip, Selector, TablaScroll } from '../../components/ui/primitivos'

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
  children: ReactNode
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
  children,
}: Props) {
  return (
    <div className="tarjeta tarjeta-pad">
      <h2 className="etiqueta-sup mb-1">
        Entregas ({entregas.length})
      </h2>
      <p className="mb-3 text-xs text-slate-500">
        Horas estimadas: <b>{totalHorasEstimadas ?? '—'}</b> · Asignadas en entregas:{' '}
        <b>{entregas.reduce((s, e) => s + Number(e.horas ?? 0), 0)}</b>
        {totalHorasEstimadas != null && (
          <>
            {' '}· Disponibles:{' '}
            <b>
              {Number(totalHorasEstimadas) -
                entregas.reduce((s, e) => s + Number(e.horas ?? 0), 0)}
            </b>
          </>
        )}
      </p>
      <TablaScroll>
      <table className="tabla mb-3">
        <thead>
          <tr>
            <th>N°</th><th>Horas</th>
            <th>% Avance</th><th>F. Comprometida</th>
            <th>F. Real</th><th>Estado</th><th>Mes aprobación</th>
            <th>Observaciones EPM</th><th>Observaciones Hitss</th>
            <th>Tipificación</th>
            <th>ANS</th><th>Garantía</th><th>N° Garantía</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {entregas.map((en) => {
            const porcentaje = en.horas != null && totalHorasEstimadas
              ? ((Number(en.horas) * 100) / Number(totalHorasEstimadas)).toFixed(1)
              : '—'
            return (
              <tr key={en.numero}>
                <td>{en.numero}</td>
                <td>{en.horas ?? '—'}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums">{porcentaje}{porcentaje !== '—' ? '%' : ''}</span>
                    {porcentaje !== '—' && (
                      <span className="inline-block h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-slate-100">
                        <span
                          className="block h-full rounded-full bg-marca-600"
                          style={{ width: `${Math.min(100, Math.max(0, Number(porcentaje)))}%` }}
                        />
                      </span>
                    )}
                  </div>
                </td>
                <td>{en.fecha_comprometida?.slice(0, 10) ?? '—'}</td>
                <td>{en.fecha_recepcion?.slice(0, 10) ?? '—'}</td>
                <td>
                  {en.estado
                    ? <Chip tono={TONO_ESTADO_ENTREGA[en.estado.toUpperCase()] ?? 'neutro'}>{en.estado}</Chip>
                    : '—'}
                </td>
                <td>{en.mes_aprobacion ?? '—'}</td>
                <td>{en.observaciones ?? '—'}</td>
                <td>
                  {tipifEdicion[en.numero] ? (
                    <Campo
                      value={tipifEdicion[en.numero].obs}
                      onChange={(ev) => onCambiarTipif(en.numero, 'obs', ev.target.value)}
                      compacto
                      className="w-full"
                    />
                  ) : (en.observaciones_hitss ?? '—')}
                </td>
                <td>
                  {tipifEdicion[en.numero] ? (
                    <Selector
                      value={tipifEdicion[en.numero].tip}
                      onChange={(ev) => onCambiarTipif(en.numero, 'tip', ev.target.value)}
                      compacto
                    >
                      <option value="">— Seleccionar —</option>
                      <option value="HITSS">Hitss</option>
                      <option value="EPM">EPM</option>
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
                <td>{en.garantia ? <Chip tono="marca">Sí</Chip> : <Chip tono="neutro">No</Chip>}</td>
                <td>{en.numero_garantia ?? '—'}</td>
                <td>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onVerHistorialEntrega(en.numero)}
                      className="enlace-accion enlace-accion-sutil"
                    >
                      Historial
                    </button>
                    {puedeEditarReq && (
                      <>
                        <button
                          type="button"
                          onClick={() => onEditarEntrega(en)}
                          className="enlace-accion"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => onEliminarEntrega(en.numero)}
                          className="enlace-accion enlace-accion-peligro"
                        >
                          Eliminar
                        </button>
                      </>
                    )}
                  </div>
                  {!puedeEditarReq && puedeEditarTipificacion && (
                    <div className="flex gap-2">
                      {tipifEdicion[en.numero] ? (
                        <>
                          <button
                            type="button"
                            disabled={guardandoTipif.has(en.numero)}
                            onClick={() => onGuardarTipif(en.numero)}
                            className="enlace-accion disabled:opacity-50"
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            onClick={() => onCancelarTipif(en.numero)}
                            className="enlace-accion enlace-accion-sutil"
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onIniciarEdicionTipif(en)}
                          className="enlace-accion"
                        >
                          Editar Hitss
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
          {entregas.length === 0 && (
            <tr><td colSpan={13} className="text-slate-400">Sin entregas.</td></tr>
          )}
        </tbody>
      </table>
      </TablaScroll>
      {children}
    </div>
  )
}
