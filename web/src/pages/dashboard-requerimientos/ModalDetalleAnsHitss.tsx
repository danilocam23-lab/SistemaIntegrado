// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Modal from '../../components/Modal'
import { Aviso, Chip, TablaScroll } from '../../components/ui'
import Paginacion from '../detalle-ans/Paginacion'
import { normalizarAns as etiquetaAns, tonoAns } from '../detalle-ans/utilidadesAns'
import { NOTA_ATRIBUCION_EPM, clasificarAns } from './calculoAns'
import type { FilaDetalleAns } from './calculoAns'

type Categoria = 'todos' | 'cumple' | 'noCumple' | 'noCumpleEpm'

const TAMANO_PAGINA = 20

interface Props {
  abierto: boolean
  onCerrar: () => void
  /** Título del modal (p. ej. "ANS de entregas (Hitss)"). */
  titulo: string
  /** Registros del mismo universo que el KPI "(Hitss)" (con los filtros de año/mes aplicados). */
  filas: FilaDetalleAns[]
  /** Con `true` muestra la columna "N.° entrega". */
  esEntrega: boolean
}

function comparar(a: FilaDetalleAns, b: FilaDetalleAns): number {
  if (a.fecha && b.fecha) return b.fecha.localeCompare(a.fecha)
  if (a.fecha) return -1
  if (b.fecha) return 1
  return 0
}

/** Detalle de los registros detrás de una gráfica "ANS … (Hitss)", en 3 categorías. */
export function ModalDetalleAnsHitss({ abierto, onCerrar, titulo, filas, esEntrega }: Props) {
  const [categoria, setCategoria] = useState<Categoria>('todos')
  const [pagina, setPagina] = useState(1)

  useEffect(() => {
    if (!abierto) return
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [abierto, onCerrar])

  useEffect(() => {
    if (abierto) {
      setCategoria('todos')
      setPagina(1)
    }
  }, [abierto])

  const clas = useMemo(() => clasificarAns(filas), [filas])

  const pestanas: { id: Categoria; etiqueta: string; cantidad: number }[] = [
    { id: 'todos', etiqueta: 'Todos', cantidad: clas.cumple.length + clas.noCumple.length + clas.noCumpleEpm.length },
    { id: 'cumple', etiqueta: 'Cumple', cantidad: clas.cumple.length },
    { id: 'noCumple', etiqueta: 'No cumple', cantidad: clas.noCumple.length },
    { id: 'noCumpleEpm', etiqueta: 'No cumple (EPM)', cantidad: clas.noCumpleEpm.length },
  ]

  const visibles = useMemo(() => {
    const lista =
      categoria === 'cumple' ? clas.cumple
      : categoria === 'noCumple' ? clas.noCumple
      : categoria === 'noCumpleEpm' ? clas.noCumpleEpm
      : [...clas.cumple, ...clas.noCumple, ...clas.noCumpleEpm]
    return [...lista].sort(comparar)
  }, [clas, categoria])

  const totalPaginas = Math.max(1, Math.ceil(visibles.length / TAMANO_PAGINA))
  const paginaSegura = Math.min(pagina, totalPaginas)
  const filasPagina = visibles.slice((paginaSegura - 1) * TAMANO_PAGINA, paginaSegura * TAMANO_PAGINA)

  const cambiarCategoria = (c: Categoria) => {
    setCategoria(c)
    setPagina(1)
  }

  const esEpm = (f: FilaDetalleAns) => f.tipificacion === 'EPM' && tonoAns(f.ans) === 'error'

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      ancho="completo"
      titulo={titulo}
      subtitulo="Detalle de registros por categoría de ANS"
    >
      <div role="dialog" aria-label={`Detalle: ${titulo}`}>
        <div className="mb-3 flex flex-wrap items-center gap-2" aria-label="Conteos por categoría">
          <Chip tono="exito">Cumple: {clas.cumple.length}</Chip>
          <Chip tono="error">No cumple: {clas.noCumple.length}</Chip>
          <Chip tono="alerta">No cumple atribuido a EPM: {clas.noCumpleEpm.length}</Chip>
          <Chip tono="marca">Total: {filas.length}</Chip>
          <span className="text-xs text-slate-500">
            Cumple (Hitss) = {clas.cumple.length} + {clas.noCumpleEpm.length} ={' '}
            <b className="text-slate-700">{clas.cumple.length + clas.noCumpleEpm.length}</b>
          </span>
          {clas.otros > 0 && (
            <span className="text-xs text-slate-500">
              ({clas.otros} con otro valor de ANS, no listados)
            </span>
          )}
        </div>

        <Aviso tono="info" className="mb-3">{NOTA_ATRIBUCION_EPM}</Aviso>

        <div className="pestanas mb-3" role="tablist">
          {pestanas.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={categoria === p.id}
              className={`pestana ${categoria === p.id ? 'pestana-activa' : ''}`}
              onClick={() => cambiarCategoria(p.id)}
            >
              {p.etiqueta} ({p.cantidad})
            </button>
          ))}
        </div>

        {visibles.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-400">Sin registros en esta categoría.</p>
        ) : (
          <TablaScroll>
            <table className="tabla">
              <thead>
                <tr>
                  <th>REQ</th>
                  {esEntrega && <th>N.° entrega</th>}
                  <th>Nombre / acta</th>
                  <th>Estado</th>
                  <th>LT HITSS</th>
                  <th>{esEntrega ? 'Fecha recepción / comprometida' : 'Fecha solicitud acta'}</th>
                  <th>ANS real</th>
                  <th>Tipificación</th>
                </tr>
              </thead>
              <tbody>
                {filasPagina.map((f) => (
                  <tr key={f.clave}>
                    <td className="whitespace-nowrap">
                      <Link to={`/requerimientos/${f.reqId || f.codigoReq}`} className="font-medium text-marca hover:underline">
                        {f.codigoReq}
                      </Link>
                    </td>
                    {esEntrega && <td>{f.numeroEntrega ?? '—'}</td>}
                    <td className="max-w-xs truncate" title={f.nombre}>{f.nombre}</td>
                    <td>{f.estado || '—'}</td>
                    <td>{f.ltHitss}</td>
                    <td className="whitespace-nowrap">{f.fecha ? f.fecha.slice(0, 10) : '—'}</td>
                    <td>
                      <Chip tono={esEpm(f) ? 'alerta' : tonoAns(f.ans)}>
                        {esEpm(f) ? 'No cumple · EPM' : etiquetaAns(f.ans)}
                      </Chip>
                    </td>
                    <td>{f.tipificacion ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TablaScroll>
        )}

        <Paginacion
          pagina={paginaSegura}
          totalPaginas={totalPaginas}
          onCambiarPagina={setPagina}
          totalRegistros={visibles.length}
          etiqueta="registros"
        />
      </div>
    </Modal>
  )
}
