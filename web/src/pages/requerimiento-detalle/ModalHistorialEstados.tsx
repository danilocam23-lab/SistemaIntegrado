import Modal from '../../components/Modal'
import { TablaScroll } from '../../components/ui/primitivos'
import { fmtFechaCo, fmtDuracion } from '../../utilidades/fechas'
import type { SegmentoHistorial } from './useHistorialEstados'

interface Props {
  titulo: string
  abierto: boolean
  cargando: boolean
  error: string
  segmentos: SegmentoHistorial[]
  onCerrar: () => void
}

export default function ModalHistorialEstados({
  titulo,
  abierto,
  cargando,
  error,
  segmentos,
  onCerrar,
}: Props) {
  return (
    <Modal titulo={titulo} abierto={abierto} onCerrar={onCerrar}>
      {cargando && <p className="text-sm text-slate-400">Cargando…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!cargando && !error && (
        <TablaScroll>
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="py-1 pr-2">Estado</th>
              <th className="py-1 pr-2">Desde</th>
              <th className="py-1 pr-2">Hasta</th>
              <th className="py-1 pr-2">Duración</th>
              <th className="py-1">Situación</th>
            </tr>
          </thead>
          <tbody>
            {segmentos.map((seg, i) => (
              <tr key={i} className="border-t align-top">
                <td className="py-1 pr-2 font-semibold">{seg.estado ?? '—'}</td>
                <td className="py-1 pr-2 whitespace-nowrap">{fmtFechaCo(seg.desde)}</td>
                <td className="py-1 pr-2 whitespace-nowrap">{seg.en_curso ? '—' : fmtFechaCo(seg.hasta)}</td>
                <td className="py-1 pr-2 whitespace-nowrap">{fmtDuracion(seg.duracion_segundos)}</td>
                <td className="py-1">
                  {seg.en_curso ? (
                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      En curso
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">Finalizado</span>
                  )}
                </td>
              </tr>
            ))}
            {segmentos.length === 0 && (
              <tr><td colSpan={5} className="py-2 text-slate-400">Sin historial disponible.</td></tr>
            )}
          </tbody>
        </table>
        </TablaScroll>
      )}
    </Modal>
  )
}
