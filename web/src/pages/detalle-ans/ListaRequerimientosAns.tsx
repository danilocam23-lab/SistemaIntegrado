import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import FilaAns from './FilaAns'
import Paginacion from './Paginacion'
import type { FilaRequerimiento } from './utilidadesAns'
import { TAMANO_PAGINA_ANS, calcularDiasTranscurridos, normalizarAns, tipificacionEtiqueta, tonoAns } from './utilidadesAns'

interface Props {
  filas: FilaRequerimiento[]
  puedeEditar: boolean
  guardandoCheck: Set<string>
  guardandoObs: Set<string>
  obsEdicion: Record<string, string>
  onCambiarObs: (id: string, valor: string) => void
  onGuardarCheck: (reqId: string, checked: boolean) => void
  onGuardarObs: (reqId: string) => void
}

/** Lista densa (con paginación client-side) de requerimientos con ANS
 * incumplido — reemplaza la tabla ancha de 16 columnas. Mismo patrón de
 * densidad progresiva de `SeccionEntregas.tsx` / `ListaUsuarios.tsx`. */
export default function ListaRequerimientosAns({
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

  // Vuelve a la página 1 cada vez que cambian los filtros (nueva referencia
  // del arreglo filtrado), igual que `onCambiarBusqueda` en `Usuarios.tsx`.
  useEffect(() => {
    setPagina(1)
  }, [filas])

  const totalPaginas = Math.max(1, Math.ceil(filas.length / TAMANO_PAGINA_ANS))
  const paginaSegura = Math.min(pagina, totalPaginas)
  const filasPagina = useMemo(
    () => filas.slice((paginaSegura - 1) * TAMANO_PAGINA_ANS, paginaSegura * TAMANO_PAGINA_ANS),
    [filas, paginaSegura],
  )

  const totalHorasEstimadas = useMemo(
    () => filas.reduce((total, r) => total + Number(r.horasEstimadas ?? 0), 0),
    [filas],
  )

  return (
    <div>
      {filasPagina.length === 0 ? (
        <p className="p-6 text-center text-sm text-slate-400">Sin registros.</p>
      ) : (
        filasPagina.map((r) => (
          <FilaAns
            key={r.id}
            identidad={
              <Link to={`/requerimientos/${r.id}`} className="font-medium text-marca hover:underline">
                {r.codigoReq}
              </Link>
            }
            nombre={r.nombre}
            tono={tonoAns(r.ansActa)}
            etiquetaAns={normalizarAns(r.ansActa)}
            dias={calcularDiasTranscurridos(r.fechaLimite, r.fechaRealEntregaEstimacion)}
            seLevanto={r.seLevanto}
            puedeEditar={puedeEditar}
            guardandoCheck={guardandoCheck.has(r.id)}
            onCambiarCheck={(checked) => onGuardarCheck(r.id, checked)}
            obsValor={obsEdicion[r.id] ?? r.observacionesAns}
            onCambiarObs={(valor) => onCambiarObs(r.id, valor)}
            guardandoObs={guardandoObs.has(r.id)}
            onGuardarObs={() => onGuardarObs(r.id)}
            forzarExpandido={obsEdicion[r.id] !== undefined}
            camposDetalle={[
              { etiqueta: 'SC', valor: r.sc || '—' },
              { etiqueta: 'Squad', valor: r.squad || '—' },
              { etiqueta: 'LT HITSS', valor: r.ltHitss || '—' },
              { etiqueta: 'Estado', valor: r.estado || '—' },
              { etiqueta: 'Horas estimadas', valor: r.horasEstimadas ?? '—' },
              { etiqueta: 'Fecha límite', valor: r.fechaLimite ? r.fechaLimite.slice(0, 10) : '—' },
              {
                etiqueta: 'F. Real entrega estimación',
                valor: r.fechaRealEntregaEstimacion ? r.fechaRealEntregaEstimacion.slice(0, 10) : '—',
              },
              { etiqueta: 'Seguimiento Hitss', valor: r.seguimientoHitss || '—', ancho: 2 },
              { etiqueta: 'Seguimiento EPM', valor: r.seguimientoEpm || '—', ancho: 2 },
              { etiqueta: 'Tipificación', valor: tipificacionEtiqueta(r.tipificacion) },
            ]}
          />
        ))
      )}

      <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
        Total horas estimadas ({filas.length} requerimientos): <b className="text-slate-700">{totalHorasEstimadas}</b>
      </div>

      <Paginacion
        pagina={paginaSegura}
        totalPaginas={totalPaginas}
        onCambiarPagina={setPagina}
        totalRegistros={filas.length}
        etiqueta="requerimientos"
      />
    </div>
  )
}
