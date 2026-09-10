import Modal from '../../components/Modal'
import { Chip, TablaScroll } from '../../components/ui/primitivos'
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
        <table className="tabla">
          <thead>
            <tr>
              <th>Estado</th>
              <th>Desde</th>
              <th>Hasta</th>
              <th>Duración</th>
              <th>Situación</th>
            </tr>
          </thead>
          <tbody>
            {segmentos.map((seg, i) => (
              <tr key={i} className="align-top">
                <td className="font-semibold">{seg.estado ?? '—'}</td>
                <td className="whitespace-nowrap">{fmtFechaCo(seg.desde)}</td>
                <td className="whitespace-nowrap">{seg.en_curso ? '—' : fmtFechaCo(seg.hasta)}</td>
                <td className="whitespace-nowrap">{fmtDuracion(seg.duracion_segundos)}</td>
                <td>
                  {seg.en_curso ? (
                    <Chip tono="exito">En curso</Chip>
                  ) : (
                    <span className="text-xs text-slate-400">Finalizado</span>
                  )}
                </td>
              </tr>
            ))}
            {segmentos.length === 0 && (
              <tr><td colSpan={5} className="text-slate-400">Sin historial disponible.</td></tr>
            )}
          </tbody>
        </table>
        </TablaScroll>
      )}
    </Modal>
  )
}
