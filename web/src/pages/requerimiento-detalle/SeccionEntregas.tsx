import type { ReactNode } from 'react'
import type { Entrega } from '../../types'
import { TablaScroll } from '../../components/ui/primitivos'

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
      <table className="mb-3 w-full text-sm">
        <thead className="text-left text-slate-500">
          <tr>
            <th className="py-1">N°</th><th className="py-1">Horas</th>
            <th className="py-1">% Avance</th><th className="py-1">F. Comprometida</th>
            <th className="py-1">F. Real</th><th className="py-1">Estado</th><th className="py-1">Mes aprobación</th>
            <th className="py-1">Observaciones EPM</th><th className="py-1">Observaciones Hitss</th>
            <th className="py-1">Tipificación</th>
            <th className="py-1">ANS</th><th className="py-1">Garantía</th><th className="py-1">N° Garantía</th>
            <th className="py-1"></th>
          </tr>
        </thead>
        <tbody>
          {entregas.map((en) => {
            const porcentaje = en.horas != null && totalHorasEstimadas
              ? ((Number(en.horas) * 100) / Number(totalHorasEstimadas)).toFixed(1)
              : '—'
            const ansLabel = en.ans_entrega === 'CUMPLE' ? 'Cumple'
              : en.ans_entrega === 'NO_CUMPLE' ? 'No cumple' : '—'
            const ansColor = en.ans_entrega === 'CUMPLE' ? 'text-emerald-600'
              : en.ans_entrega === 'NO_CUMPLE' ? 'text-red-600' : ''
            return (
              <tr key={en.numero} className="border-t">
                <td className="py-1">{en.numero}</td>
                <td className="py-1">{en.horas ?? '—'}</td>
                <td className="py-1">{porcentaje}{porcentaje !== '—' ? '%' : ''}</td>
                <td className="py-1">{en.fecha_comprometida?.slice(0, 10) ?? '—'}</td>
                <td className="py-1">{en.fecha_recepcion?.slice(0, 10) ?? '—'}</td>
                <td className="py-1">{en.estado ?? '—'}</td>
                <td className="py-1">{en.mes_aprobacion ?? '—'}</td>
                <td className="py-1">{en.observaciones ?? '—'}</td>
                <td className="py-1">
                  {tipifEdicion[en.numero] ? (
                    <input
                      value={tipifEdicion[en.numero].obs}
                      onChange={(ev) => onCambiarTipif(en.numero, 'obs', ev.target.value)}
                      className="campo campo-sm w-full"
                    />
                  ) : (en.observaciones_hitss ?? '—')}
                </td>
                <td className="py-1">
                  {tipifEdicion[en.numero] ? (
                    <select
                      value={tipifEdicion[en.numero].tip}
                      onChange={(ev) => onCambiarTipif(en.numero, 'tip', ev.target.value)}
                      className="campo campo-sm"
                    >
                      <option value="">— Seleccionar —</option>
                      <option value="HITSS">Hitss</option>
                      <option value="EPM">EPM</option>
                    </select>
                  ) : (en.tipificacion ?? '—')}
                </td>
                <td className={`py-1 font-medium ${ansColor}`}>{ansLabel}</td>
                <td className="py-1">{en.garantia ? 'Sí' : 'No'}</td>
                <td className="py-1">{en.numero_garantia ?? '—'}</td>
                <td className="py-1">
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
                            className="text-marca hover:underline disabled:opacity-50"
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            onClick={() => onCancelarTipif(en.numero)}
                            className="text-slate-500 hover:underline"
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
            <tr><td colSpan={13} className="py-2 text-slate-400">Sin entregas.</td></tr>
          )}
        </tbody>
      </table>
      </TablaScroll>
      {children}
    </div>
  )
}
