import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import client from '../api/client'
import { mensajeError } from '../api/hooks'
import Modal from '../components/Modal'
import { Boton, EncabezadoPagina, Icono, TablaScroll } from '../components/ui'
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

interface UltimaSincronizacion {
  sync_id: string
  estado: string
  archivo: string | null
  total_encontrados: number
  validos: number
  con_error: number
  cargados: number
  omitidos: number
  iniciado_en: string
  finalizado_en: string | null
  error_general: string | null
  errores: ErrorValidacion[]
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
  // El backend guarda las fechas en UTC pero las serializa sin sufijo de zona
  // horaria (p. ej. "2026-09-08T21:10:17"), así que si no trae 'Z' ni offset
  // se le agrega para que no se interprete por error como hora local del
  // navegador. Luego se formatea explícitamente en hora de Colombia.
  const iso = /[zZ]|[+-]\d{2}:\d{2}$/.test(fecha) ? fecha : `${fecha}Z`
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return fecha
  return d.toLocaleString('es-CO', { timeZone: 'America/Bogota' })
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
    <tr>
      <td>{r.fila_origen}</td>
      <td>{r.lider}</td>
      <td>{r.squad}</td>
      <td>
        {r.datos?.['Detailed Description'] ? (
          <Boton
            variante="primario"
            tamano="sm"
            onClick={() => onVerDescripcion(r.datos['Detailed Description'])}
            title="Ver descripción completa"
          >
            Ver detalle
          </Boton>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td>
        {tieneTask10 ? (
          <Boton
            variante="suave"
            tamano="sm"
            onClick={() => onVerTask(r.datos, CAMPOS_TASK10, 'Detalle Task 10')}
          >
            Ver detalle
          </Boton>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td>
        {tieneTask20 ? (
          <Boton
            variante="suave"
            tamano="sm"
            onClick={() => onVerTask(r.datos, CAMPOS_TASK20, 'Detalle Task 20')}
          >
            Ver detalle
          </Boton>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td>
        {tieneTask30 ? (
          <Boton
            variante="suave"
            tamano="sm"
            onClick={() => onVerTask(r.datos, CAMPOS_TASK30, 'Detalle Task 30')}
          >
            Ver detalle
          </Boton>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      {headers.map((h) => (
        <td key={`${r.id}-${h}`}>{r.datos?.[h] ?? ''}</td>
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
  const [ultimaSync, setUltimaSync] = useState<UltimaSincronizacion | null>(null)
  const [mostrarErroresUltimaSync, setMostrarErroresUltimaSync] = useState(false)
  const ultimaSyncIdRef = useRef<string | null>(null)

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

  const verificarUltimaSync = useCallback(async (forzarRecarga: boolean): Promise<void> => {
    try {
      const { data: resp } = await client.get<UltimaSincronizacion | null>(
        '/soporte/solicitudes-fabrica/ultima-sincronizacion',
      )
      setUltimaSync(resp)
      // Si cambió el id de la última sincronización (automática o manual desde
      // otra pantalla), refrescamos también el listado y "Última actualización".
      if (resp?.sync_id && resp.sync_id !== ultimaSyncIdRef.current) {
        const esPrimera = ultimaSyncIdRef.current === null
        ultimaSyncIdRef.current = resp.sync_id
        if (!esPrimera || forzarRecarga) {
          await cargar()
        }
      }
    } catch {
      // No es crítico si falla; simplemente no se muestra el aviso.
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void cargar(1)
    void verificarUltimaSync(false)

    // Refresca solo el estado de sincronización cada 60s (liviano) para
    // detectar si corrió el proceso automático (3x/día) o "Probar ahora"
    // desde Configuración mientras esta página sigue abierta.
    const intervalo = window.setInterval(() => {
      void verificarUltimaSync(false)
    }, 60_000)

    // Al volver a esta pestaña/ventana, refresca de inmediato.
    function onVisible(): void {
      if (document.visibilityState === 'visible') {
        void verificarUltimaSync(false)
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.clearInterval(intervalo)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [verificarUltimaSync])


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
      <EncabezadoPagina
        icono={<Icono nombre="fabrica" />}
        titulo="Soporte — Solicitudes Fábrica"
        descripcion={
          puedeActualizar
            ? 'Cargue el archivo Excel para validar y sincronizar, aplicando la regla Líder y Squad.'
            : 'Consulta de solicitudes fábrica en modo solo lectura.'
        }
        acciones={
          puedeActualizar ? (
            <>
              <input
                ref={inputArchivoRef}
                type="file"
                accept=".xlsx,.xlsm"
                className="hidden"
                onChange={(e) => onArchivoSeleccionado(e.target.files?.[0] ?? null)}
              />
              <Boton
                variante="primario"
                onClick={abrirSelectorArchivo}
                disabled={actualizando || sincronizando}
              >
                {actualizando ? 'Cargando…' : 'Actualizar (cargar Excel)'}
              </Boton>
            </>
          ) : undefined
        }
      />

      {puedeActualizar && ultimaSync && ultimaSync.con_error > 0 && (
        <div className="aviso aviso-alerta space-y-2">
          <div>
            La última carga ({ultimaSync.finalizado_en ? fmtFecha(ultimaSync.finalizado_en) : '—'})
            {ultimaSync.archivo ? ` del archivo "${ultimaSync.archivo}"` : ''} encontró{' '}
            <b>{ultimaSync.con_error}</b> registro(s) con error que no se cargaron automáticamente.
            Revíselos y cargue el archivo manualmente si hace falta corregirlos.
          </div>
          <button
            onClick={() => setMostrarErroresUltimaSync((v) => !v)}
            className="enlace-accion"
          >
            {mostrarErroresUltimaSync ? 'Ocultar detalle' : 'Ver detalle de errores'}
          </button>
          {mostrarErroresUltimaSync && (
            <TablaScroll className="max-h-56 overflow-y-auto">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Fila</th>
                    <th>Líder</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {ultimaSync.errores.map((e, i) => (
                    <tr key={`${e.fila}-${i}`}>
                      <td>{e.fila}</td>
                      <td>{e.lider ?? '—'}</td>
                      <td className="text-red-700">{e.motivo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TablaScroll>
          )}
        </div>
      )}

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
              <Boton
                variante="primario"
                tamano="sm"
                onClick={() => void descargarErroresCsv()}
              >
                Descargar errores (CSV)
              </Boton>
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
          <Boton
            variante="secundario"
            tamano="sm"
            onClick={() => irPagina(1)}
            disabled={pagina <= 1}
          >
            «
          </Boton>
          <Boton
            variante="secundario"
            tamano="sm"
            onClick={() => irPagina(pagina - 1)}
            disabled={pagina <= 1}
          >
            ‹ Anterior
          </Boton>
          <span className="text-sm font-medium text-slate-700">
            {pagina} / {data.total_paginas}
          </span>
          <Boton
            variante="secundario"
            tamano="sm"
            onClick={() => irPagina(pagina + 1)}
            disabled={pagina >= data.total_paginas}
          >
            Siguiente ›
          </Boton>
          <Boton
            variante="secundario"
            tamano="sm"
            onClick={() => irPagina(data.total_paginas)}
            disabled={pagina >= data.total_paginas}
          >
            »
          </Boton>
        </div>
      )}

      <TablaScroll className="w-full max-w-full max-h-[65vh] overflow-y-auto">
        <table className="tabla min-w-max">
          <thead className="sticky top-0 z-10">
            <tr>
              <th>Fila</th>
              <th>Líder</th>
              <th>Squad</th>
              <th>Descripción</th>
              <th>Task 10</th>
              <th>Task 20</th>
              <th>Task 30</th>
              {headers.map((h) => (
                <th key={h}>{h}</th>
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
              <TablaScroll className="max-h-56 overflow-y-auto">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Fila</th>
                      <th>Líder</th>
                      <th>Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.errores.map((e, i) => (
                      <tr key={`${e.fila}-${i}`}>
                        <td>{e.fila}</td>
                        <td>{e.lider ?? '—'}</td>
                        <td className="text-red-700">{e.motivo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TablaScroll>
            )}

            <div className="flex justify-end gap-2">
              <Boton
                variante="secundario"
                tamano="sm"
                onClick={() => setModalAbierto(false)}
                disabled={sincronizando}
              >
                Cancelar
              </Boton>
              {puedeActualizar && (
                <Boton
                  variante="primario"
                  tamano="sm"
                  onClick={() => void confirmarSincronizacion()}
                  disabled={sincronizando}
                >
                  {sincronizando ? 'Sincronizando…' : 'Confirmar'}
                </Boton>
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
          <Boton
            variante="secundario"
            tamano="sm"
            onClick={() => setDescripcionSeleccionada(null)}
          >
            Cerrar
          </Boton>
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
              <Boton
                variante="secundario"
                tamano="sm"
                onClick={() => setTaskSeleccionada(null)}
              >
                Cerrar
              </Boton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
