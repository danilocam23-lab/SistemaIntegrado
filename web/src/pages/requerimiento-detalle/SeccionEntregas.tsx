import type { ReactNode } from 'react'
import type { Entrega } from '../../types'
import { Campo, Chip, Selector } from '../../components/ui/primitivos'

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

/** Par label/valor compacto de una mini-tarjeta de entrega — mismo patrón que
 * `CampoTarjeta` en `TarjetaRequerimiento.tsx` (móvil de Requerimientos). */
function CampoEntrega({ label, ancho = 1, children }: { label: string; ancho?: 1 | 2; children: ReactNode }) {
  return (
    <div className={ancho === 2 ? 'col-span-2' : undefined}>
      <p className="etiqueta-sup mb-0.5">{label}</p>
      <div className="text-sm text-slate-800">{children}</div>
    </div>
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {entregas.map((en) => {
          const porcentaje = en.horas != null && totalHorasEstimadas
            ? ((Number(en.horas) * 100) / Number(totalHorasEstimadas)).toFixed(1)
            : '—'
          return (
            <div key={en.numero} className="rounded-lg border border-slate-200 p-3">
              {/* Cabecera destacada: N°, Estado (Chip) y %Avance (barra de progreso) */}
              <div className="mb-2 flex items-start justify-between gap-2">
                <span className="text-sm font-semibold text-slate-800">Entrega N° {en.numero}</span>
                {en.estado
                  ? <Chip tono={TONO_ESTADO_ENTREGA[en.estado.toUpperCase()] ?? 'neutro'}>{en.estado}</Chip>
                  : <Chip tono="neutro">—</Chip>}
              </div>
              <div className="mb-3 flex items-center gap-2">
                <span className="tabular-nums text-sm text-slate-600">{porcentaje}{porcentaje !== '—' ? '%' : ''}</span>
                {porcentaje !== '—' && (
                  <span className="inline-block h-1.5 w-full shrink-0 overflow-hidden rounded-full bg-slate-100">
                    <span
                      className="block h-full rounded-full bg-marca-600"
                      style={{ width: `${Math.min(100, Math.max(0, Number(porcentaje)))}%` }}
                    />
                  </span>
                )}
              </div>

              {/* Resto de campos como pares etiqueta/valor compactos */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <CampoEntrega label="Horas">{en.horas ?? '—'}</CampoEntrega>
                <CampoEntrega label="F. Comprometida">{en.fecha_comprometida?.slice(0, 10) ?? '—'}</CampoEntrega>
                <CampoEntrega label="F. Real">{en.fecha_recepcion?.slice(0, 10) ?? '—'}</CampoEntrega>
                <CampoEntrega label="Mes aprobación">{en.mes_aprobacion ?? '—'}</CampoEntrega>
                <CampoEntrega label="Observaciones EPM" ancho={2}>{en.observaciones ?? '—'}</CampoEntrega>
                <CampoEntrega label="Observaciones Hitss" ancho={2}>
                  {tipifEdicion[en.numero] ? (
                    <Campo
                      value={tipifEdicion[en.numero].obs}
                      onChange={(ev) => onCambiarTipif(en.numero, 'obs', ev.target.value)}
                      compacto
                      className="w-full"
                    />
                  ) : (en.observaciones_hitss ?? '—')}
                </CampoEntrega>
                <CampoEntrega label="Tipificación">
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
                </CampoEntrega>
                <CampoEntrega label="ANS">
                  {en.ans_entrega === 'CUMPLE' ? (
                    <Chip tono="exito">Cumple</Chip>
                  ) : en.ans_entrega === 'NO_CUMPLE' ? (
                    <Chip tono="error">No cumple</Chip>
                  ) : '—'}
                </CampoEntrega>
                <CampoEntrega label="Garantía">
                  {en.garantia ? <Chip tono="marca">Sí</Chip> : <Chip tono="neutro">No</Chip>}
                </CampoEntrega>
                <CampoEntrega label="N° Garantía">{en.numero_garantia ?? '—'}</CampoEntrega>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-2">
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
                {!puedeEditarReq && puedeEditarTipificacion && (
                  <>
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
                  </>
                )}
              </div>
            </div>
          )
        })}
        {entregas.length === 0 && (
          <p className="col-span-full text-sm text-slate-400">Sin entregas.</p>
        )}
      </div>

      {children}
    </div>
  )
}
