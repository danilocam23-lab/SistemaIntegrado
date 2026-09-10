import { useEffect, useState } from 'react'
import client from '../api/client'
import { mensajeError, useLista } from '../api/hooks'
import { useAuth } from '../context/AuthContext'
import { Boton, Chip, EncabezadoPagina, Icono, TablaScroll } from '../components/ui'

interface Persona {
  id: string
  nombre: string
  email?: string
  activo: boolean
}

interface TestResp {
  ok: boolean
  proyectos?: number
  error?: string
}

interface CampoRequerido {
  ref: string
  name: string
  type: string
  default_value: string | number | null
  source: 'standard' | 'discovered'
}

interface AzdoConfigResp {
  scope: string
  org_url: string
  pat_guardado: boolean
  default_project: string
  sync_interval: string
  squad_id: string | null
  usuario_id: string | null
  learned_fields: Record<string, Record<string, unknown>> | null
}

const WIT_LABELS: Record<string, string> = {
  feature: 'Feature',
  userStory: 'User Story / PBI',
  task: 'Task',
}

const frecuenciaLabel: Record<string, string> = {
  manual: 'Manual',
  hourly: 'Cada hora',
  daily: 'Diario',
}

const typeColors: Record<string, string> = {
  string: 'bg-blue-100 text-blue-700',
  html: 'bg-purple-100 text-purple-700',
  dateTime: 'bg-amber-100 text-amber-700',
  double: 'bg-emerald-100 text-emerald-700',
  integer: 'bg-emerald-100 text-emerald-700',
  picklist: 'bg-pink-100 text-pink-700',
}

/* ── Panel reutilizable para cada instancia Azure DevOps ── */
function PanelAzdo({ titulo, target, personas }: {
  titulo: string
  target: 'hitss' | 'epm'
  personas: Persona[]
}) {
  const { tienePermiso } = useAuth()
  const puedeEditar = tienePermiso('azure_devops.editar')
  const [orgUrl, setOrgUrl] = useState('')
  const [pat, setPat] = useState('')
  const [patGuardado, setPatGuardado] = useState(false)
  const [mostrarPat, setMostrarPat] = useState(false)
  const [proyecto, setProyecto] = useState('')
  const [frecuencia, setFrecuencia] = useState('manual')

  const [aviso, setAviso] = useState('')
  const [ok, setOk] = useState('')
  const [conexion, setConexion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [probando, setProbando] = useState(false)

  const [campos, setCampos] = useState<Record<string, CampoRequerido[]> | null>(null)
  const [descubriendo, setDescubriendo] = useState(false)

  const [scopeUsuarioId, setScopeUsuarioId] = useState<string | null>(null)

  useEffect(() => {
    cargarConfig()
  }, [scopeUsuarioId])

  function buildParams(): URLSearchParams {
    const params = new URLSearchParams()
    params.set('target', target)
    if (scopeUsuarioId) params.set('usuario_id', scopeUsuarioId)
    return params
  }

  async function cargarConfig(): Promise<void> {
    try {
      const { data } = await client.get<AzdoConfigResp>(`/azdo/config?${buildParams()}`)
      setOrgUrl(data.org_url ?? '')
      setPatGuardado(data.pat_guardado)
      setPat('')
      setProyecto(data.default_project ?? '')
      setFrecuencia(data.sync_interval ?? 'manual')
    } catch {
      // No config yet
    }
  }

  async function probar(): Promise<void> {
    setAviso('')
    setConexion('')
    setProbando(true)
    try {
      const { data } = await client.get<TestResp>(`/azdo/test?${buildParams()}`)
      setConexion(
        data.ok ? `✓ Conectado — ${data.proyectos} proyecto(s)` : `✗ Sin conexión: ${data.error}`,
      )
    } catch (err) {
      setConexion(`✗ ${mensajeError(err)}`)
    } finally {
      setProbando(false)
    }
  }

  async function guardarConfig(): Promise<void> {
    setAviso('')
    setOk('')
    if (!puedeEditar) {
      setAviso('No tienes permiso para editar la configuración de Azure DevOps.')
      return
    }
    setGuardando(true)
    try {
      await client.put('/azdo/config', {
        org_url: orgUrl,
        pat: pat || null,
        default_project: proyecto,
        sync_interval: frecuencia,
        usuario_id: scopeUsuarioId,
        target,
      })
      setOk('Configuración guardada correctamente.')
      if (pat) {
        setPatGuardado(true)
        setPat('')
      }
    } catch (err) {
      setAviso(mensajeError(err))
    } finally {
      setGuardando(false)
    }
  }

  async function descubrirCampos(): Promise<void> {
    if (!puedeEditar) {
      setAviso('No tienes permiso para descubrir campos requeridos.')
      return
    }
    setDescubriendo(true)
    setCampos(null)
    try {
      const { data } = await client.get<Record<string, CampoRequerido[]>>(
        `/azdo/campos-requeridos?${buildParams()}`,
      )
      setCampos(data)
    } catch (err) {
      setAviso(mensajeError(err))
    } finally {
      setDescubriendo(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Conexión ── */}
      <div className="tarjeta tarjeta-pad">
        <div className="mb-1 flex items-center gap-2">
          <Icono nombre="nube" className="text-xl text-marca" />
          <h2 className="titulo-seccion">{titulo}</h2>
        </div>
        <p className="mb-5 text-xs text-slate-500">
          Conecta con Azure DevOps para crear Work Items y sincronizar sprints.
        </p>

        {aviso && <div className="mb-3 rounded bg-red-50 p-2.5 text-xs text-red-700">{aviso}</div>}
        {ok && <div className="mb-3 rounded bg-emerald-50 p-2.5 text-xs text-emerald-700">{ok}</div>}

        {/* Persona */}
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-slate-700">Persona</label>
          <select
            value={scopeUsuarioId ?? ''}
            onChange={(e) => setScopeUsuarioId(e.target.value || null)}
            disabled={!puedeEditar}
            className="campo w-full"
          >
            <option value="">Ninguno (config global)</option>
            {personas.filter((p) => p.activo).map((p) => (
              <option key={p.id} value={p.id}>{p.nombre} {p.email ? `(${p.email})` : ''}</option>
            ))}
          </select>
        </div>

        {/* URL */}
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-slate-700">URL de la organización</label>
          <input
            value={orgUrl}
            onChange={(e) => setOrgUrl(e.target.value)}
            readOnly={!puedeEditar}
            placeholder="https://dev.azure.com/TuOrganizacion"
            className="campo w-full"
          />
        </div>

        {/* PAT */}
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-slate-700">Personal Access Token (PAT)</label>
          <div className="flex gap-2">
            <input
              type={mostrarPat ? 'text' : 'password'}
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              readOnly={!puedeEditar}
              placeholder={patGuardado ? '••••••••••••••••••••' : 'Ingresa tu PAT'}
              className="campo flex-1"
            />
            <Boton
              variante="secundario"
              tamano="sm"
              onClick={() => setMostrarPat(!mostrarPat)}
            >
              {mostrarPat ? 'Ocultar' : 'Mostrar'}
            </Boton>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            El PAT se almacena de forma segura y no se muestra una vez guardado.
          </p>
        </div>

        {/* Probar conexión */}
        <div className="mb-4">
          <Boton
            variante="secundario"
            tamano="sm"
            onClick={probar}
            disabled={probando}
            icono={<Icono nombre="recargar" />}
          >
            {probando ? 'Probando…' : 'Probar conexión'}
          </Boton>
          {conexion && (
            <span className={`ml-2 text-xs ${conexion.startsWith('✓') ? 'text-emerald-600' : 'text-red-600'}`}>
              {conexion}
            </span>
          )}
        </div>

        {/* Proyecto */}
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-slate-700">Proyecto por defecto</label>
          <input
            value={proyecto}
            onChange={(e) => setProyecto(e.target.value)}
            readOnly={!puedeEditar}
            placeholder="Nombre del proyecto"
            className="campo w-full"
          />
        </div>

        {/* Frecuencia */}
        <div className="mb-5">
          <label className="mb-1 block text-xs font-medium text-slate-700">Frecuencia de sincronización</label>
          <select
            value={frecuencia}
            onChange={(e) => setFrecuencia(e.target.value)}
            disabled={!puedeEditar}
            className="campo w-full"
          >
            {Object.entries(frecuenciaLabel).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>

        {/* Guardar */}
        {puedeEditar && (
          <Boton
            variante="primario"
            onClick={guardarConfig}
            disabled={guardando}
            icono={<Icono nombre="guardar" />}
          >
            {guardando ? 'Guardando…' : 'Guardar configuración'}
          </Boton>
        )}
      </div>

      {/* ── Campos Requeridos ── */}
      <div className="tarjeta tarjeta-pad">
        <div className="mb-1 flex items-center gap-2">
          <Icono nombre="portafolio" className="text-xl text-marca" />
          <h3 className="text-base font-bold text-slate-800">Campos Requeridos</h3>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Campos obligatorios del proyecto con sus tipos y valores por defecto.
        </p>

        {puedeEditar && (
          <Boton
            variante="secundario"
            tamano="sm"
            className="mb-3"
            onClick={descubrirCampos}
            disabled={descubriendo || !proyecto}
            icono={<Icono nombre="lupa" />}
          >
            {descubriendo ? 'Descubriendo…' : 'Descubrir campos'}
          </Boton>
        )}

        {!proyecto && (
          <p className="text-xs text-amber-600">⚠ Configura un proyecto primero.</p>
        )}

        {campos && Object.entries(campos).map(([witKey, fieldsList]) => (
          <div key={witKey} className="mb-5 last:mb-0">
            <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-700">
              <span className="inline-block h-2 w-2 rounded-full bg-marca" />
              {WIT_LABELS[witKey] ?? witKey}
              <span className="font-normal text-slate-400">({fieldsList.length})</span>
            </h4>
            <TablaScroll>
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Campo</th>
                    <th>Ref</th>
                    <th>Tipo</th>
                    <th>Default</th>
                    <th>Origen</th>
                  </tr>
                </thead>
                <tbody>
                  {fieldsList.map((campo) => (
                    <tr key={campo.ref}>
                      <td>{campo.name}</td>
                      <td className="font-mono">{campo.ref}</td>
                      <td>
                        <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${typeColors[campo.type] ?? 'bg-slate-100 text-slate-600'}`}>
                          {campo.type}
                        </span>
                      </td>
                      <td>{String(campo.default_value ?? '—')}</td>
                      <td>
                        {campo.source === 'discovered' ? (
                          <Chip tono="alerta">Custom</Chip>
                        ) : (
                          <Chip tono="neutro">Estándar</Chip>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TablaScroll>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Vista principal con 2 columnas ── */
export default function AzureDevOps() {
  const { datos: personas } = useLista<Persona>('/personas')
  const listaPersonas = personas ?? []

  return (
    <div>
      <EncabezadoPagina icono={<Icono nombre="nube" />} titulo="Integración Azure DevOps" />
      <div className="mx-auto max-w-7xl pt-4">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <PanelAzdo titulo="Azure DevOps — HITSS" target="hitss" personas={listaPersonas} />
          <PanelAzdo titulo="Azure DevOps — EPM" target="epm" personas={listaPersonas} />
        </div>
      </div>
    </div>
  )
}
