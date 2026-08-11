import { useState } from 'react'
import type { FormEvent } from 'react'
import client from '../api/client'
import { mensajeError, useLista } from '../api/hooks'
import type { Aplicacion } from '../types'

const HEADER_CONSOLIDADO = { headers: { 'X-Aplicacion': '__todas__' } }

export default function AdminEndpoints() {
  const { datos: apps } = useLista<Aplicacion>('/aplicaciones')
  const [identificador, setIdentificador] = useState('')
  const [nuevaAplicacion, setNuevaAplicacion] = useState('')
  const [resultado, setResultado] = useState<unknown>(null)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [cargandoDiag, setCargandoDiag] = useState(false)
  const [cargandoReasig, setCargandoReasig] = useState(false)
  const [cargandoEntregas, setCargandoEntregas] = useState(false)
  const [apiKeyIntegracion, setApiKeyIntegracion] = useState('')
  const [aplicacionIntegracion, setAplicacionIntegracion] = useState('')

  async function ejecutarDiagnostico(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError('')
    setOk('')
    setResultado(null)
    setCargandoDiag(true)
    try {
      const id = identificador.trim()
      const { data } = await client.get(`/requerimientos/${encodeURIComponent(id)}/diagnostico`, HEADER_CONSOLIDADO)
      setResultado(data)
      setOk('Diagnóstico ejecutado correctamente.')
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setCargandoDiag(false)
    }
  }

  async function ejecutarReasignacion(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError('')
    setOk('')
    setResultado(null)
    setCargandoReasig(true)
    try {
      const id = identificador.trim()
      const app = nuevaAplicacion.trim()
      const { data } = await client.post(
        `/requerimientos/${encodeURIComponent(id)}/reasignar-aplicacion`,
        null,
        {
          ...HEADER_CONSOLIDADO,
          params: { nueva_aplicacion: app },
        },
      )
      setResultado(data)
      setOk('Reasignación aplicada correctamente.')
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setCargandoReasig(false)
    }
  }


  async function probarEntregasIntegracion(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError('')
    setOk('')
    setResultado(null)
    setCargandoEntregas(true)
    try {
      const params = aplicacionIntegracion ? { aplicacion: aplicacionIntegracion } : undefined
      const { data } = await client.get('/integracion/entregas', {
        headers: { 'X-API-Key': apiKeyIntegracion.trim() },
        params,
      })
      setResultado(data)
      const total = Array.isArray(data) ? data.length : 0
      setOk(`Endpoint de entregas ejecutado correctamente. Filas recibidas: ${total}.`)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setCargandoEntregas(false)
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-marca-osc">Administración de Endpoints</h1>
      <p className="mb-4 rounded border bg-white p-3 text-sm text-slate-700">
        Vista lista para usar los endpoints administrativos de requerimientos sin errores de autenticación
        por cabeceras faltantes. Esta pantalla siempre envía <code>X-Aplicacion: __todas__</code>.
      </p>

      <form onSubmit={ejecutarDiagnostico} className="mb-4 rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-base font-semibold text-marca-osc">Diagnóstico</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Código REQ o SC</span>
            <input
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
              placeholder="Ej: 10813 o REQ-123"
              required
              className="min-w-64 rounded border px-3 py-2"
            />
          </label>
          <button
            disabled={cargandoDiag}
            className="rounded bg-marca px-4 py-2 text-white hover:bg-marca-osc disabled:opacity-60"
          >
            {cargandoDiag ? 'Consultando...' : 'Consultar diagnóstico'}
          </button>
        </div>
      </form>

      <form onSubmit={ejecutarReasignacion} className="mb-4 rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-base font-semibold text-marca-osc">Reasignar aplicación</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Nueva aplicación</span>
            <select
              value={nuevaAplicacion}
              onChange={(e) => setNuevaAplicacion(e.target.value)}
              required
              className="min-w-64 rounded border px-3 py-2"
            >
              <option value="">Seleccione una aplicación</option>
              {apps.map((a) => (
                <option key={a.codigo} value={a.codigo}>
                  {a.nombre} ({a.codigo})
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={cargandoReasig || !identificador.trim()}
            className="rounded bg-amber-600 px-4 py-2 text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {cargandoReasig ? 'Reasignando...' : 'Reasignar'}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Usa el mismo identificador del formulario anterior (REQ o SC).
        </p>
      </form>


      <form onSubmit={probarEntregasIntegracion} className="mb-4 rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-base font-semibold text-marca-osc">Probar integracion de entregas</h2>
        <p className="mb-3 text-xs text-slate-500">
          GET /api/integracion/entregas - solo requerimientos en estado ESTIMACION APROBADA ENTREGA PENDIENTE,
          entregas Pendiente y fecha comprometida del mes actual hacia atras.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">X-API-Key</span>
            <input
              type="password"
              value={apiKeyIntegracion}
              onChange={(e) => setApiKeyIntegracion(e.target.value)}
              placeholder="Clave configurada en API_KEY"
              required
              className="min-w-72 rounded border px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Aplicacion / squad (opcional)</span>
            <select
              value={aplicacionIntegracion}
              onChange={(e) => setAplicacionIntegracion(e.target.value)}
              className="min-w-64 rounded border px-3 py-2"
            >
              <option value="">Todas</option>
              {apps.map((a) => (
                <option key={a.codigo} value={a.codigo}>
                  {a.nombre} ({a.codigo})
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={cargandoEntregas}
            className="rounded bg-marca px-4 py-2 text-white hover:bg-marca-osc disabled:opacity-60"
          >
            {cargandoEntregas ? 'Probando...' : 'Probar endpoint'}
          </button>
        </div>
        <p className="mt-2 font-mono text-xs text-slate-500">
          /api/integracion/entregas{aplicacionIntegracion ? `?aplicacion=${aplicacionIntegracion}` : ''}
        </p>
      </form>

      {ok && <div className="mb-3 rounded bg-emerald-50 p-2 text-sm text-emerald-700">{ok}</div>}
      {error && <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>}

      <div className="rounded-xl border bg-slate-900 p-4 text-sm text-slate-100">
        <div className="mb-2 font-semibold">Respuesta</div>
        <pre className="overflow-auto whitespace-pre-wrap break-words">
          {resultado ? JSON.stringify(resultado, null, 2) : 'Sin resultados todavía.'}
        </pre>
      </div>
    </div>
  )
}
