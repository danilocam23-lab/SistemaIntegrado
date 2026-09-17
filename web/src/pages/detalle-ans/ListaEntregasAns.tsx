import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import FilaAns from './FilaAns'
import Paginacion from './Paginacion'
import type { FilaEntrega } from './utilidadesAns'
import { TAMANO_PAGINA_ANS, calcularDiasTranscurridos, normalizarAns, tipificacionEtiqueta, tonoAns } from './utilidadesAns'

interface Props {
  filas: FilaEntrega[]
  puedeEditar: boolean
  guardandoCheck: Set<string>
  guardandoObs: Set<string>
  obsEdicion: Record<string, string>
  onCambiarObs: (id: string, valor: string) => void
  onGuardarCheck: (reqId: string, checked: boolean, entregaNumero: number) => void
  onGuardarObs: (reqId: string, entregaNumero: number) => void
}

/** Lista densa (con paginación client-side) de entregas con ANS incumplido —
 * reemplaza la tabla ancha de 17 columnas. Mismo patrón que
 * `ListaRequerimientosAns.tsx`. */
export default function ListaEntregasAns({
  filas,
  puedeEditar,
  guardandoCheck,
  guardandoObs,
  obsEdicion,
  onCambiarObs,
  onGuardarCheck,
  onGuardarObs,
}: Props) {
  const [pagina, setPagina] = useState(1)

  useEffect(() => {
    setPagina(1)
  }, [filas])

  const totalPaginas = Math.max(1, Math.ceil(filas.length / TAMANO_PAGINA_ANS))
  const paginaSegura = Math.min(pagina, totalPaginas)
  const filasPagina = useMemo(
    () => filas.slice((paginaSegura - 1) * TAMANO_PAGINA_ANS, paginaSegura * TAMANO_PAGINA_ANS),
    [filas, paginaSegura],
  )

  const totalHoras = useMemo(
    () => filas.reduce((total, e) => total + Number(e.horas ?? 0), 0),
    [filas],
  )

  return (
    <div>
      {filasPagina.length === 0 ? (
        <p className="p-6 text-center text-sm text-slate-400">Sin entregas.</p>
      ) : (
        filasPagina.map((e) => (
          <FilaAns
            key={e.id}
            identidad={
              <span className="inline-flex flex-wrap items-center gap-1.5">
                <Link to={`/requerimientos/${e.reqId}`} className="font-medium text-marca hover:underline">
                  {e.codigoReq}
                </Link>
                <span className="chip chip-neutro text-2xs">N.° {e.numero}</span>
              </span>
            }
            nombre={e.nombreReq}
            tono={tonoAns(e.ansEntrega)}
            etiquetaAns={normalizarAns(e.ansEntrega)}
            dias={calcularDiasTranscurridos(e.fechaComprometida, e.fechaReal)}
            seLevanto={e.seLevanto}
            puedeEditar={puedeEditar}
            guardandoCheck={guardandoCheck.has(e.id)}
            onCambiarCheck={(checked) => onGuardarCheck(e.reqId, checked, e.entregaNumero)}
            obsValor={obsEdicion[e.id] ?? e.observacionesAns}
            onCambiarObs={(valor) => onCambiarObs(e.id, valor)}
            guardandoObs={guardandoObs.has(e.id)}
            onGuardarObs={() => onGuardarObs(e.reqId, e.entregaNumero)}
            forzarExpandido={obsEdicion[e.id] !== undefined}
            camposDetalle={[
              { etiqueta: 'SC', valor: e.sc || '—' },
              { etiqueta: 'Squad', valor: e.squad || '—' },
              { etiqueta: 'LT HITSS', valor: e.ltHitss || '—' },
              { etiqueta: 'Estado', valor: e.estado || '—' },
              { etiqueta: 'Horas', valor: e.horas ?? '—' },
              { etiqueta: '% Avance', valor: e.porcentaje != null ? `${e.porcentaje}%` : '—' },
              { etiqueta: 'F. Comprometida', valor: e.fechaComprometida ? e.fechaComprometida.slice(0, 10) : '—' },
              { etiqueta: 'F. Real', valor: e.fechaReal ? e.fechaReal.slice(0, 10) : '—' },
              { etiqueta: 'Observaciones EPM', valor: e.observacionesEpm || '—', ancho: 2 },
              { etiqueta: 'Observaciones Hitss', valor: e.observacionesHitss || '—', ancho: 2 },
              { etiqueta: 'Tipificación', valor: tipificacionEtiqueta(e.tipificacion) },
            ]}
          />
        ))
      )}

      <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
        Total horas ({filas.length} entregas): <b className="text-slate-700">{totalHoras}</b>
      </div>

      <Paginacion
        pagina={paginaSegura}
        totalPaginas={totalPaginas}
        onCambiarPagina={setPagina}
        totalRegistros={filas.length}
        etiqueta="entregas"
      />
    </div>
  )
}
