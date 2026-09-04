import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import client from '../api/client'
import { mensajeError } from '../api/hooks'
import Modal from '../components/Modal'
import { TablaScroll } from '../components/ui/primitivos'
import { useAuth } from '../context/AuthContext'

interface RegistroSoporte {
  id: string
  aplicacion_id: string
  fila_origen: number
  lider: string
  squad: string
  datos: Record<string, string>
  sincronizado_en: string | null
}

interface ListadoPaginadoResponse {
  total: number
  pagina: number
  tamanio: number
  total_paginas: number
  ultima_actualizacion: string | null
  headers: string[]
  registros: RegistroSoporte[]
}

interface ErrorValidacion {
  fila: number
  lider: string | null
  squad: string | null
  motivo: string
}

interface PreviewResponse {
  fuente_url: string
  archivo: string
  total_encontrados: number
  registros_validos: number
  registros_con_error: number
  registros_que_seran_cargados: number
  registros_que_no_seran_cargados: number
  errores: ErrorValidacion[]
}

interface SyncResponse {
  sync_id: string
  total_procesados: number
  registros_creados: number
  registros_omitidos: number
  tiempo_ejecucion_ms: number
}

function fmtFecha(fecha: string | null): string {
  if (!fecha) return '—'
  const d = new Date(fecha)
  if (Number.isNaN(d.getTime())) return fecha
  return d.toLocaleString('es-CO')
}

interface FilaProps {
  registro: RegistroSoporte
  headers: string[]
  onVerDescripcion: (desc: string) => void
  onVerTask: (datos: Record<string, string>, campos: string[], titulo: string) => void
}

const CAMPOS_TASK10 = [
  'Task ID 10',
  'Task Name 10',
  'Status Task 10',
  'Assignee Group 10',
  'Assignee 10',
  'Start Assignment Task 10',
  'End Assignment Task 10',
  'Total Hours Assigned Task 10',
  'Total Minutes Assigned Task 10',
]

const CAMPOS_TASK20 = [
  'Task ID 20',
  'Task Name 20',
  'Status Task 20',
  'Assignee Group 20',
  'Assignee 20',
  'Start Assignment Task 20',
  'End Assignment Task 20',
  'Total Hours Assigned Task 20',
  'Total Minutes Assigned Task 20',
]

const CAMPOS_TASK30 = [
  'Task ID 30',
  'Task Name 30',
  'Status Task 30',
  'Assignee Group 30',
  'Assignee 30',
  'Start Assignment Task 30',
  'End Assignment Task 30',
  'Total Hours Assigned Task 30',
  'Total Minutes Assigned Task 30',
]

const FilaRegistro = memo(function FilaRegistro({ registro: r, headers, onVerDescripcion, onVerTask }: FilaProps) {
  const tieneTask10 = CAMPOS_TASK10.some((c) => r.datos?.[c])
  const tieneTask20 = CAMPOS_TASK20.some((c) => r.datos?.[c])
  const tieneTask30 = CAMPOS_TASK30.some((c) => r.datos?.[c])
  return (
    <tr className="border-t">
      <td className="p-2">{r.fila_origen}</td>
      <td className="p-2">{r.lider}</td>
      <td className="p-2">{r.squad}</td>
      <td className="p-2">
        {r.datos?.['Detailed Description'] ? (
          <button
            onClick={() => onVerDescripcion(r.datos['Detailed Description'])}
            className="btn btn-primario btn-sm"
            title="Ver descripción completa"
          >
            Ver detalle
          </button>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td className="p-2">
        {tieneTask10 ? (
          <button
            onClick={() => onVerTask(r.datos, CAMPOS_TASK10, 'Detalle Task 10')}
            className="rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700 hover:bg-indigo-100"
          >
            Ver detalle
          </button>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td className="p-2">
        {tieneTask20 ? (
          <button
            onClick={() => onVerTask(r.datos, CAMPOS_TASK20, 'Detalle Task 20')}
            className="rounded bg-violet-50 px-2 py-0.5 text-xs text-violet-700 hover:bg-violet-100"
          >
            Ver detalle
          </button>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td className="p-2">
        {tieneTask30 ? (
          <button
            onClick={() => onVerTask(r.datos, CAMPOS_TASK30, 'Detalle Task 30')}
            className="rounded bg-teal-50 px-2 py-0.5 text-xs text-teal-700 hover:bg-teal-100"
          >
            Ver detalle
          </button>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      {headers.map((h) => (
        <td key={`${r.id}-${h}`} className="p-2 text-slate-700">{r.datos?.[h] ?? ''}</td>
      ))}
    </tr>
  )
})

export default function SoporteSolicitudesFabrica() {
  const { tienePermiso } = useAuth()
  const puedeActualizar = tienePermiso('soporte.solicitudes_fabrica.actualizar')
  const [cargando, setCargando] = useState(true)
  const [actualizando, setActualizando] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [data, setData] = useState<ListadoPaginadoResponse | null>(null)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [resultadoSync, setResultadoSync] = useState<SyncResponse | null>(null)
  const [aviso, setAviso] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [archivoExcel, setArchivoExcel] = useState<File | null>(null)
  const inputArchivoRef = useRef<HTMLInputElement | null>(null)
  const [descripcionSeleccionada, setDescripcionSeleccionada] = useState<string | null>(null)
  const [taskSeleccionada, setTaskSeleccionada] = useState<{ datos: Record<string, string>; campos: string[]; titulo: string } | null>(null)
  const [filtroWorkOrderID, setFiltroWorkOrderID] = useState('')
  const [pagina, setPagina] = useState(1)
  const [tamanio] = useState(100)
  const filtroTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function cargar(pag?: number, filtro?: string): Promise<void> {
    setCargando(true)
    setAviso('')
    try {
      const p = pag ?? pagina
      const f = filtro ?? filtroWorkOrderID
      const params = new URLSearchParams({ pagina: String(p), tamanio: String(tamanio) })
      if (f) params.set('filtro_wo', f)
      const { data: resp } = await client.get<ListadoPaginadoResponse>(`/soporte/solicitudes-fabrica/pagina?${params}`)
      setData(resp)
    } catch (err) {
      setAviso(mensajeError(err))
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    void cargar(1)
  }, [])

  function onFiltroChange(valor: string): void {
    setFiltroWorkOrderID(valor)
    if (filtroTimeoutRef.current) clearTimeout(filtroTimeoutRef.current)
    filtroTimeoutRef.current = setTimeout(() => {
      setPagina(1)
      void cargar(1, valor)
    }, 400)
  }

  function irPagina(p: number): void {
    setPagina(p)
    void cargar(p)
  }

  async function previsualizar(archivo: File): Promise<void> {
    if (!puedeActualizar) {
      setAviso('No tienes permiso para actualizar solicitudes de fábrica.')
      return
    }
    setActualizando(true)
    setAviso('')
    setResultadoSync(null)
    try {
      const formData = new FormData()
      formData.append('archivo', archivo)
      const { data } = await client.post<PreviewResponse>('/soporte/solicitudes-fabrica/previsualizar', formData)
      setPreview(data)
      setModalAbierto(true)
    } catch (err) {
      setAviso(mensajeError(err))
    } finally {
      setActualizando(false)
    }
  }

  async function confirmarSincronizacion(): Promise<void> {
    if (!puedeActualizar) {
      setAviso('No tienes permiso para sincronizar solicitudes de fábrica.')
      return
    }
    if (!archivoExcel) {
      setAviso('Debe cargar el archivo Excel para sincronizar.')
      return
    }
    setSincronizando(true)
    setAviso('')
    try {
      const formData = new FormData()
      formData.append('archivo', archivoExcel)
      const { data } = await client.post<SyncResponse>('/soporte/solicitudes-fabrica/sincronizar', formData)
      setResultadoSync(data)
      setModalAbierto(false)
      setArchivoExcel(null)
      if (inputArchivoRef.current) inputArchivoRef.current.value = ''
      await cargar()
    } catch (err) {
      setAviso(mensajeError(err))
    } finally {
      setSincronizando(false)
    }
  }

  async function descargarErroresCsv(): Promise<void> {
    if (!resultadoSync?.sync_id) return
    try {
      const resp = await client.get(`/soporte/solicitudes-fabrica/sincronizaciones/${resultadoSync.sync_id}/errores.csv`, {
        responseType: 'blob',
      })
      const blob = new Blob([resp.data], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `errores_solicitudes_fabrica_${resultadoSync.sync_id}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  const COLUMNAS_OCULTAS = useMemo(() => new Set([
    'Applicant',
    'ANS_inicio_trabajo',
    'ANS_Cumplimiento',
    'ANS_Oportunida',
    'ANS_Oportunidad',
    'Etapa de Desarrollo',
    'Detailed Description',
    ...CAMPOS_TASK10,
    ...CAMPOS_TASK20,
    ...CAMPOS_TASK30,
  ]), [])

  const headers = useMemo(
    () => (data?.headers ?? []).filter((h) => !COLUMNAS_OCULTAS.has(h)),
    [data?.headers],
  )

  function abrirSelectorArchivo(): void {
    if (!puedeActualizar) return
    inputArchivoRef.current?.click()
  }

  function onArchivoSeleccionado(file: File | null): void {
    if (!puedeActualizar) return
    if (!file) return
    setArchivoExcel(file)
    void previsualizar(file)
  }

  const handleVerDescripcion = useCallback((desc: string) => {
    setDescripcionSeleccionada(desc)
  }, [])

  const handleVerTask = useCallback((datos: Record<string, string>, campos: string[], titulo: string) => {
    setTaskSeleccionada({ datos, campos, titulo })
  }, [])

  const registrosFiltrados = data?.registros ?? []

  return (
    <div className="min-w-0 w-full space-y-4 overflow-x-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="titulo-pagina">Soporte — Solicitudes Fábrica</h1>
          <p className="mt-1 text-sm text-slate-500">
            {puedeActualizar
              ? 'Cargue el archivo Excel para validar y sincronizar, aplicando la regla Líder y Squad.'
              : 'Consulta de solicitudes fábrica en modo solo lectura.'}
          </p>
        </div>
        {puedeActualizar && (
          <>
            <input
              ref={inputArchivoRef}
              type="file"
              accept=".xlsx,.xlsm"
              className="hidden"
              onChange={(e) => onArchivoSeleccionado(e.target.files?.[0] ?? null)}
            />
            <button
              onClick={abrirSelectorArchivo}
              disabled={actualizando || sincronizando}
              className="btn btn-primario shrink-0"
            >
              {actualizando ? 'Cargando…' : 'Actualizar (cargar Excel)'}
            </button>
          </>
        )}
      </div>

      {aviso && <div className="aviso aviso-error">{aviso}</div>}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded border bg-white p-3">
          <div className="text-2xl font-bold text-marca-osc">{data?.total ?? 0}</div>
          <div className="text-xs text-slate-500">Registros</div>
        </div>
        <div className="rounded border bg-white p-3 sm:col-span-2">
          <div className="text-sm font-semibold text-slate-700">Última actualización</div>
          <div className="text-sm text-slate-500">{fmtFecha(data?.ultima_actualizacion ?? null)}</div>
        </div>
      </div>

      {resultadoSync && (
        <div className="tarjeta tarjeta-pad">
          <h2 className="etiqueta-sup mb-3">Resultado de sincronización</h2>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded border p-3">
              <div className="text-2xl font-bold text-marca-osc">{resultadoSync.total_procesados}</div>
              <div className="text-xs text-slate-500">Procesados</div>
            </div>
            <div className="rounded border p-3">
              <div className="text-2xl font-bold text-emerald-700">{resultadoSync.registros_creados}</div>
              <div className="text-xs text-slate-500">Creados</div>
            </div>
            <div className="rounded border p-3">
              <div className="text-2xl font-bold text-amber-700">{resultadoSync.registros_omitidos}</div>
              <div className="text-xs text-slate-500">Omitidos</div>
            </div>
            <div className="rounded border p-3">
              <div className="text-2xl font-bold text-slate-700">{(resultadoSync.tiempo_ejecucion_ms / 1000).toFixed(2)}s</div>
              <div className="text-xs text-slate-500">Tiempo</div>
            </div>
          </div>
          {resultadoSync.registros_omitidos > 0 && (
            <div className="mt-3">
              <button
                onClick={() => void descargarErroresCsv()}
                className="btn btn-primario btn-sm"
              >
                Descargar errores (CSV)
              </button>
            </div>
          )}
        </div>
      )}

      <div className="barra-filtros">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Filtrar por Work Order ID</span>
          <input
            type="text"
            value={filtroWorkOrderID}
            onChange={(e) => onFiltroChange(e.target.value)}
            placeholder="Buscar Work Order ID…"
            className="campo w-64"
          />
        </label>
        {filtroWorkOrderID && (
          <button
            onClick={() => { setFiltroWorkOrderID(''); setPagina(1); void cargar(1, '') }}
            className="enlace-accion enlace-accion-peligro text-xs self-end pb-2"
          >
            Limpiar filtro
          </button>
        )}
        <span className="ml-auto text-xs text-slate-400 self-end pb-2">
          Página {data?.pagina ?? 1} de {data?.total_paginas ?? 1} — {data?.total ?? 0} registros totales
        </span>
      </div>

      {/* Controles de paginación */}
      {data && data.total_paginas > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => irPagina(1)}
            disabled={pagina <= 1}
            className="campo campo-sm disabled:opacity-40"
          >
            «
          </button>
          <button
            onClick={() => irPagina(pagina - 1)}
            disabled={pagina <= 1}
            className="campo campo-sm disabled:opacity-40"
          >
            ‹ Anterior
          </button>
          <span className="text-sm font-medium text-slate-700">
            {pagina} / {data.total_paginas}
          </span>
          <button
            onClick={() => irPagina(pagina + 1)}
            disabled={pagina >= data.total_paginas}
            className="campo campo-sm disabled:opacity-40"
          >
            Siguiente ›
          </button>
          <button
            onClick={() => irPagina(data.total_paginas)}
            disabled={pagina >= data.total_paginas}
            className="campo campo-sm disabled:opacity-40"
          >
            »
          </button>
        </div>
      )}

      <TablaScroll className="w-full max-w-full max-h-[65vh] overflow-y-auto">
        <table className="min-w-max text-sm">
          <thead className="sticky top-0 z-10 bg-marca-osc text-white">
            <tr>
              <th className="p-2 text-left">Fila</th>
              <th className="p-2 text-left">Líder</th>
              <th className="p-2 text-left">Squad</th>
              <th className="p-2 text-left">Descripción</th>
              <th className="p-2 text-left">Task 10</th>
              <th className="p-2 text-left">Task 20</th>
              <th className="p-2 text-left">Task 30</th>
              {headers.map((h) => (
                <th key={h} className="p-2 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={headers.length + 7} className="p-4 text-center text-slate-400">Cargando…</td>
              </tr>
            )}
            {!cargando && registrosFiltrados.length === 0 && (
              <tr>
                <td colSpan={headers.length + 7} className="p-4 text-center text-slate-400">
                  {filtroWorkOrderID ? 'No coincide con el filtro.' : 'Sin registros.'}
                </td>
              </tr>
            )}
            {!cargando && registrosFiltrados.map((r) => (
              <FilaRegistro
                key={r.id}
                registro={r}
                headers={headers}
                onVerDescripcion={handleVerDescripcion}
                onVerTask={handleVerTask}
              />
            ))}
          </tbody>
        </table>
      </TablaScroll>

      <Modal
        titulo="Validación previa — Solicitudes Fábrica"
        abierto={modalAbierto}
        onCerrar={() => {
          if (!sincronizando) setModalAbierto(false)
        }}
      >
        {!preview ? null : (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded border p-2">Total encontrados: <b>{preview.total_encontrados}</b></div>
              <div className="rounded border p-2 text-green-700">Registros válidos: <b>{preview.registros_validos}</b></div>
              <div className="rounded border p-2 text-blue-700">Serán cargados: <b>{preview.registros_que_seran_cargados}</b></div>
              <div className="rounded border p-2 text-amber-700">No serán cargados: <b>{preview.registros_que_no_seran_cargados}</b></div>
            </div>

            {(preview.errores?.length ?? 0) > 0 && (
              <div className="max-h-56 overflow-auto rounded border">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="p-2 text-left">Fila</th>
                      <th className="p-2 text-left">Líder</th>
                      <th className="p-2 text-left">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.errores.map((e, i) => (
                      <tr key={`${e.fila}-${i}`} className="border-t">
                        <td className="p-2">{e.fila}</td>
                        <td className="p-2">{e.lider ?? '—'}</td>
                        <td className="p-2 text-red-700">{e.motivo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setModalAbierto(false)}
                disabled={sincronizando}
                className="btn btn-secundario btn-sm"
              >
                Cancelar
              </button>
              {puedeActualizar && (
                <button
                  onClick={() => void confirmarSincronizacion()}
                  disabled={sincronizando}
                  className="btn btn-primario btn-sm"
                >
                  {sincronizando ? 'Sincronizando…' : 'Confirmar'}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        titulo="Detailed Description"
        abierto={descripcionSeleccionada !== null}
        onCerrar={() => setDescripcionSeleccionada(null)}
      >
        <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">
          {descripcionSeleccionada || '—'}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => setDescripcionSeleccionada(null)}
            className="btn btn-secundario btn-sm"
          >
            Cerrar
          </button>
        </div>
      </Modal>

      <Modal
        titulo={taskSeleccionada?.titulo ?? ''}
        abierto={taskSeleccionada !== null}
        onCerrar={() => setTaskSeleccionada(null)}
      >
        {taskSeleccionada && (
          <div className="space-y-3">
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              {taskSeleccionada.campos.map((campo) => (
                <div key={campo} className="rounded border bg-slate-50 p-3">
                  <dt className="mb-0.5 text-xs font-semibold text-slate-500">{campo}</dt>
                  <dd className="text-slate-800">{taskSeleccionada.datos[campo] || '—'}</dd>
                </div>
              ))}
            </dl>
            <div className="flex justify-end pt-1">
              <button
                onClick={() => setTaskSeleccionada(null)}
                className="btn btn-secundario btn-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
