import { useCallback, useEffect, useState } from 'react'
import client from '../api/client'

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

export default function SoporteGarantiasWO() {
  const [garantias, setGarantias] = useState<GarantiaWOItem[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<WOBusqueda[]>([])
  const [buscando, setBuscando] = useState(false)
  const [editandoObs, setEditandoObs] = useState<Record<string, { obs: string; res: string }>>({})
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

  if (cargando) return <div className="p-8 text-center text-slate-500">Cargando…</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="titulo-pagina">Garantías de Work Orders</h1>
        <p className="text-sm text-slate-500">Gestión de WO marcadas como garantía con observaciones</p>
      </div>

      {/* Buscador */}
      <div className="tarjeta tarjeta-pad">
        <h2 className="titulo-seccion text-sm mb-3">Agregar WO de garantía</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1 text-sm">
            <span className="mb-1 block text-slate-600">Buscar Work Order ID</span>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && buscarWO()}
              placeholder="Ej: WO-12345"
              className="campo w-full"
            />
          </label>
          <button onClick={buscarWO} disabled={buscando}
            className="btn btn-primario">
            {buscando ? 'Buscando…' : 'Buscar'}
          </button>
        </div>

        {(resultados ?? []).length > 0 && (
          <div className="mt-3 max-h-48 overflow-auto rounded border">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Work Order ID</th>
                  <th className="px-3 py-2">Aplicación</th>
                  <th className="px-3 py-2">Squad</th>
                  <th className="px-3 py-2">Líder</th>
                  <th className="px-3 py-2">Descripción</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {(resultados ?? []).map((r) => (
                  <tr key={r.work_order_id} className="border-t hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono font-semibold">{r.work_order_id}</td>
                    <td className="px-3 py-2">{r.aplicacion_id}</td>
                    <td className="px-3 py-2">{r.squad}</td>
                    <td className="px-3 py-2">{r.lider}</td>
                    <td className="px-3 py-2 max-w-xs truncate">{r.descripcion}</td>
                    <td className="px-3 py-2">{r.estado}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => agregarWO(r.work_order_id)}
                        className="btn btn-exito btn-sm">
                        + Agregar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tabla de garantías */}
      <div className="tarjeta tarjeta-pad">
        <h2 className="titulo-seccion text-sm mb-3">
          Garantías registradas ({(garantias ?? []).length})
        </h2>
        {(garantias ?? []).length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No hay garantías registradas</p>
        ) : (
          <div className="overflow-auto rounded border">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Work Order ID</th>
                  <th className="px-3 py-2">Aplicación</th>
                  <th className="px-3 py-2">Squad</th>
                  <th className="px-3 py-2">Líder</th>
                  <th className="px-3 py-2">Descripción</th>
                  <th className="px-3 py-2">Estado WO</th>
                  <th className="px-3 py-2">Observaciones</th>
                  <th className="px-3 py-2">Observaciones Resolución</th>
                  <th className="px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(garantias ?? []).map((g) => {
                  const edicion = editandoObs[getId(g)]
                  return (
                    <tr key={getId(g)} className="border-t align-top">
                      <td className="px-3 py-2 font-mono font-semibold">{g.work_order_id}</td>
                      <td className="px-3 py-2">{g.aplicacion_id}</td>
                      <td className="px-3 py-2">{g.squad ?? '—'}</td>
                      <td className="px-3 py-2">{g.lider ?? '—'}</td>
                      <td className="px-3 py-2 max-w-xs truncate">{g.descripcion ?? '—'}</td>
                      <td className="px-3 py-2">{g.estado_wo ?? '—'}</td>
                      <td className="px-3 py-2 min-w-[180px]">
                        {edicion ? (
                          <textarea
                            value={edicion.obs}
                            onChange={(e) => setEditandoObs((p) => ({ ...p, [getId(g)]: { ...p[getId(g)], obs: e.target.value } }))}
                            className="campo campo-sm w-full"
                            rows={2}
                          />
                        ) : (
                          <span>{g.observaciones || '—'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 min-w-[180px]">
                        {edicion ? (
                          <textarea
                            value={edicion.res}
                            onChange={(e) => setEditandoObs((p) => ({ ...p, [getId(g)]: { ...p[getId(g)], res: e.target.value } }))}
                            className="campo campo-sm w-full"
                            rows={2}
                          />
                        ) : (
                          <span>{g.observaciones_resolucion || '—'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-1">
                          {edicion ? (
                            <>
                              <button onClick={() => guardarObservaciones(getId(g))}
                                disabled={guardando.has(getId(g))}
                                className="btn btn-primario btn-sm">
                                {guardando.has(getId(g)) ? 'Guardando…' : 'Guardar'}
                              </button>
                              <button onClick={() => setEditandoObs((p) => { const n = { ...p }; delete n[getId(g)]; return n })}
                                className="btn btn-secundario btn-sm">
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => iniciarEdicion(g)}
                                className="btn btn-primario btn-sm">
                                Editar
                              </button>
                              <button onClick={() => eliminar(getId(g))}
                                className="btn btn-peligro btn-sm">
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
          </div>
        )}
      </div>
    </div>
  )
}
