// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useCallback, useEffect, useState } from 'react'
import client from '../api/client'
import Modal from '../components/Modal'
import { AreaTexto, Aviso, Boton, Campo, EncabezadoPagina, Icono, Tarjeta, TablaScroll } from '../components/ui'

function getId(item: any): string {
  if (!item._id) return ''
  if (typeof item._id === 'string') return item._id
  if (item._id.$oid) return item._id.$oid
  return String(item._id)
}

interface GarantiaWOItem {
  _id: any
  work_order_id: string
  aplicacion_id: string
  squad: string | null
  lider: string | null
  descripcion: string | null
  fecha_creacion_wo: string | null
  estado_wo: string | null
  observaciones: string | null
  observaciones_resolucion: string | null
  creado_en: string
}

interface WOBusqueda {
  work_order_id: string
  aplicacion_id: string
  squad: string
  lider: string
  descripcion: string
  estado: string
}

interface WODetalle {
  work_order_id: string
  aplicacion_id: string
  squad: string | null
  lider: string | null
  datos: Record<string, unknown>
}

export default function SoporteGarantiasWO() {
  const [garantias, setGarantias] = useState<GarantiaWOItem[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<WOBusqueda[]>([])
  const [buscando, setBuscando] = useState(false)
  const [editandoObs, setEditandoObs] = useState<Record<string, { obs: string; res: string }>>({})
  const [detalleWo, setDetalleWo] = useState<WODetalle | null>(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [errorDetalle, setErrorDetalle] = useState('')
  const [mostrarDetalleModal, setMostrarDetalleModal] = useState(false)
  const [guardando, setGuardando] = useState<Set<string>>(new Set())

  const cargar = useCallback(async () => {
    try {
      const { data } = await client.get('/garantias-wo')
      setGarantias(Array.isArray(data) ? data : [])
    } catch { /* ignore */ }
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function buscarWO() {
    if (!busqueda.trim()) return
    setBuscando(true)
    try {
      const { data } = await client.get('/garantias-wo/buscar-wo', { params: { q: busqueda.trim() } })
      setResultados(Array.isArray(data) ? data : [])
    } catch { setResultados([]) }
    setBuscando(false)
  }

  async function agregarWO(woId: string) {
    try {
      await client.post('/garantias-wo', { work_order_id: woId })
      setResultados([])
      setBusqueda('')
      cargar()
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Error al agregar')
    }
  }

  async function verDetalleWo(woId: string) {
    setDetalleWo(null)
    setErrorDetalle('')
    setMostrarDetalleModal(true)
    setCargandoDetalle(true)
    try {
      const { data } = await client.get(`/garantias-wo/detalle-wo/${encodeURIComponent(woId)}`)
      setDetalleWo(data)
    } catch (e: any) {
      setErrorDetalle(e.response?.data?.detail || `No se pudo cargar el detalle de la WO '${woId}'`)
    }
    setCargandoDetalle(false)
  }

  async function guardarObservaciones(id: string) {
    const edicion = editandoObs[id]
    if (!edicion) return
    setGuardando((p) => new Set(p).add(id))
    try {
      await client.put(`/garantias-wo/${id}`, {
        observaciones: edicion.obs,
        observaciones_resolucion: edicion.res,
      })
      cargar()
      setEditandoObs((p) => { const n = { ...p }; delete n[id]; return n })
    } catch { /* ignore */ }
    setGuardando((p) => { const n = new Set(p); n.delete(id); return n })
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar esta garantía WO?')) return
    try {
      await client.delete(`/garantias-wo/${id}`)
      cargar()
    } catch { /* ignore */ }
  }

  function iniciarEdicion(g: GarantiaWOItem) {
    setEditandoObs((p) => ({
      ...p,
      [getId(g)]: { obs: g.observaciones ?? '', res: g.observaciones_resolucion ?? '' },
    }))
  }

  if (cargando) {
    return (
      <div className="space-y-6">
        <EncabezadoPagina
          icono={<Icono nombre="soporte" />}
          titulo="Garantías de Work Orders"
          descripcion="Gestión de WO marcadas como garantía con observaciones"
        />
        <Tarjeta>
          <p role="status" className="py-8 text-center text-sm text-slate-500">Cargando…</p>
        </Tarjeta>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        icono={<Icono nombre="soporte" />}
        titulo="Garantías de Work Orders"
        descripcion="Gestión de WO marcadas como garantía con observaciones"
      />

      {/* Buscador */}
      <Tarjeta>
        <h2 className="titulo-seccion text-sm mb-3">Agregar WO de garantía</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <Campo
              etiqueta="Buscar Work Order ID"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && buscarWO()}
              placeholder="Ej: WO-12345"
              className="w-full"
            />
          </div>
          <Boton variante="primario" onClick={buscarWO} disabled={buscando}>
            {buscando ? 'Buscando…' : 'Buscar'}
          </Boton>
        </div>

        {(resultados ?? []).length > 0 && (
          <TablaScroll className="max-h-48 overflow-y-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Work Order ID</th>
                  <th>Squad</th>
                  <th>Líder</th>
                  <th>Descripción</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(resultados ?? []).map((r) => (
                  <tr key={r.work_order_id}>
                    <td className="font-mono font-semibold">
                      <button
                        type="button"
                        onClick={() => verDetalleWo(r.work_order_id)}
                        className="enlace-accion"
                      >
                        {r.work_order_id}
                      </button>
                    </td>
                    <td>{r.squad}</td>
                    <td>{r.lider}</td>
                    <td className="max-w-xs truncate">{r.descripcion}</td>
                    <td>{r.estado}</td>
                    <td>
                      <Boton variante="exito" tamano="sm" icono={<Icono nombre="check" />} onClick={() => agregarWO(r.work_order_id)}>
                        Agregar
                      </Boton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TablaScroll>
        )}
      </Tarjeta>

      {/* Tabla de garantías */}
      <Tarjeta>
        <h2 className="titulo-seccion text-sm mb-3">
          Garantías registradas ({(garantias ?? []).length})
        </h2>
        {(garantias ?? []).length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No hay garantías registradas</p>
        ) : (
          <TablaScroll>
            <table className="tabla">
              <thead>
                <tr>
                  <th>Work Order ID</th>
                  <th>Squad</th>
                  <th>Líder</th>
                  <th>Descripción</th>
                  <th>Estado WO</th>
                  <th>Observaciones</th>
                  <th>Observaciones Resolución</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(garantias ?? []).map((g) => {
                  const edicion = editandoObs[getId(g)]
                  return (
                    <tr key={getId(g)} className="align-top">
                      <td className="font-mono font-semibold">
                        <button
                          type="button"
                          onClick={() => verDetalleWo(g.work_order_id)}
                          className="enlace-accion"
                        >
                          {g.work_order_id}
                        </button>
                      </td>
                      <td>{g.squad ?? '—'}</td>
                      <td>{g.lider ?? '—'}</td>
                      <td className="max-w-xs truncate">{g.descripcion ?? '—'}</td>
                      <td>{g.estado_wo ?? '—'}</td>
                      <td className="min-w-[180px]">
                        {edicion ? (
                          <AreaTexto
                            value={edicion.obs}
                            onChange={(e) => setEditandoObs((p) => ({ ...p, [getId(g)]: { ...p[getId(g)], obs: e.target.value } }))}
                            className="campo-sm w-full"
                            rows={2}
                          />
                        ) : (
                          <span>{g.observaciones || '—'}</span>
                        )}
                      </td>
                      <td className="min-w-[180px]">
                        {edicion ? (
                          <AreaTexto
                            value={edicion.res}
                            onChange={(e) => setEditandoObs((p) => ({ ...p, [getId(g)]: { ...p[getId(g)], res: e.target.value } }))}
                            className="campo-sm w-full"
                            rows={2}
                          />
                        ) : (
                          <span>{g.observaciones_resolucion || '—'}</span>
                        )}
                      </td>
                      <td>
                        <div className="flex flex-col gap-1">
                          {edicion ? (
                            <>
                              <Boton
                                variante="primario"
                                tamano="sm"
                                onClick={() => guardarObservaciones(getId(g))}
                                disabled={guardando.has(getId(g))}
                              >
                                {guardando.has(getId(g)) ? 'Guardando…' : 'Guardar'}
                              </Boton>
                              <Boton
                                variante="secundario"
                                tamano="sm"
                                onClick={() => setEditandoObs((p) => { const n = { ...p }; delete n[getId(g)]; return n })}
                              >
                                Cancelar
                              </Boton>
                            </>
                          ) : (
                            <>
                              <button type="button" className="enlace-accion" onClick={() => iniciarEdicion(g)}>
                                Editar
                              </button>
                              <button
                                type="button"
                                className="enlace-accion enlace-accion-peligro"
                                onClick={() => eliminar(getId(g))}
                              >
                                Eliminar
                              </button>
                            </>
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
      </Tarjeta>

      <Modal
        titulo="Detalle Work Order"
        subtitulo={detalleWo?.work_order_id ?? 'Información completa de la WO en soporte.'}
        abierto={mostrarDetalleModal}
        onCerrar={() => setMostrarDetalleModal(false)}
        ancho="xl"
      >
        {cargandoDetalle && (
          <p role="status" className="py-8 text-center text-sm text-slate-500">Cargando detalle…</p>
        )}
        {!cargandoDetalle && errorDetalle && <Aviso tono="error">{errorDetalle}</Aviso>}
        {!cargandoDetalle && !errorDetalle && detalleWo && (
          <TablaScroll>
            <table className="tabla">
              <tbody>
                <tr>
                  <td className="w-56 font-semibold text-slate-600">Squad</td>
                  <td>{detalleWo.squad ?? '—'}</td>
                </tr>
                <tr>
                  <td className="w-56 font-semibold text-slate-600">Líder</td>
                  <td>{detalleWo.lider ?? '—'}</td>
                </tr>
                {Object.entries(detalleWo.datos ?? {}).map(([clave, valor]) => (
                  <tr key={clave}>
                    <td className="w-56 align-top font-semibold text-slate-600">{clave}</td>
                    <td className="whitespace-pre-wrap break-words">
                      {valor === null || valor === undefined || valor === '' ? '—' : String(valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TablaScroll>
        )}
      </Modal>
    </div>
  )
}
