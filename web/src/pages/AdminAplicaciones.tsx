import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import client from '../api/client'
import Modal from '../components/Modal'
import { useAuth } from '../context/AuthContext'
import type { Aplicacion } from '../types'
import { Boton, Campo, EncabezadoPagina, cx } from '../components/ui'

/** Interruptor visual para "Activa". Mismo patrón que `FilaUsuario.tsx`; si un
 *  tercer lugar lo necesita, vale la pena promoverlo a un `Interruptor` compartido. */
function InterruptorActivo({ activo, disabled, onClick }: { activo: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={activo ? 'Desactivar squad' : 'Activar squad'}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        activo ? 'bg-emerald-500' : 'bg-slate-300',
      )}
    >
      <span
        className={cx(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
          activo ? 'translate-x-4' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}

export default function AdminAplicaciones() {
  const { usuario, tienePermiso } = useAuth()
  const puedeCrear = tienePermiso('aplicaciones.crear')
  const puedeEditar = tienePermiso('aplicaciones.editar')
  const [apps, setApps] = useState<Aplicacion[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState('')

  function cargar(): void {
    void client.get<Aplicacion[]>('/aplicaciones').then((r) => {
      const todas = r.data
      const adminSinSquads = usuario?.rol === 'admin_app' && (usuario.aplicaciones_codigos?.length ?? 0) === 0
      // admin_app solo ve sus propios squads
      if (tienePermiso('*') || usuario?.rol === 'superadmin' || adminSinSquads) {
        setApps(todas)
      } else {
        setApps(todas.filter((a) => usuario?.aplicaciones_codigos.includes(a.codigo)))
      }
    })
  }

  useEffect(() => {
    cargar()
  }, [])

  const appsFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    if (!texto) return apps
    return apps.filter(
      (a) => a.codigo.toLowerCase().includes(texto) || a.nombre.toLowerCase().includes(texto),
    )
  }, [apps, busqueda])

  function abrirModal(): void {
    setError('')
    setModalAbierto(true)
  }

  function cerrarModal(): void {
    setModalAbierto(false)
    setError('')
  }

  async function crear(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError('')
    try {
      await client.post('/aplicaciones', { codigo, nombre, descripcion: '' })
      setCodigo('')
      setNombre('')
      setModalAbierto(false)
      cargar()
    } catch (err) {
      const detalle = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
      setError(detalle ?? 'No fue posible crear el squad')
    }
  }

  async function alternarEstado(app: Aplicacion): Promise<void> {
    await client.patch(`/aplicaciones/${app.codigo}/estado`, { activa: !app.activa })
    cargar()
  }

  return (
    <div>
      <EncabezadoPagina
        titulo="Administración de squads"
        acciones={
          <div className="flex items-center gap-2">
            <Campo
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por código o nombre…"
              compacto
              className="w-56"
            />
            {puedeCrear && (
              <Boton variante="primario" onClick={abrirModal}>
                + Nuevo squad
              </Boton>
            )}
          </div>
        }
      />

      <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
        {appsFiltradas.map((app) => (
          <div
            key={app.codigo}
            className={cx(
              'rounded-lg border border-l-4 bg-white p-3 shadow-sm',
              app.activa ? 'border-l-emerald-500' : 'border-l-slate-300',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <b className="block truncate text-sm font-semibold text-slate-800">{app.nombre}</b>
                <p className="mt-0.5 truncate font-mono text-xs text-slate-400">{app.codigo}</p>
              </div>
              <InterruptorActivo
                activo={app.activa}
                disabled={!puedeEditar}
                onClick={() => alternarEstado(app)}
              />
            </div>
          </div>
        ))}
        {appsFiltradas.length === 0 && (
          <p className="col-span-full p-4 text-center text-sm text-slate-400">
            {busqueda ? 'Ningún squad coincide con la búsqueda.' : 'No hay squads registrados.'}
          </p>
        )}
      </div>

      <Modal titulo="Nuevo squad" abierto={modalAbierto} onCerrar={cerrarModal}>
        <form onSubmit={crear} className="space-y-3">
          {error && <div className="aviso aviso-error">{error}</div>}
          <Campo
            etiqueta="Código"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            required
            placeholder="bi"
            className="w-full"
          />
          <Campo
            etiqueta="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            placeholder="Business Intelligence"
            className="w-full"
          />
          <Boton variante="primario" type="submit" bloque>
            Crear squad
          </Boton>
          <p className="text-xs text-slate-400">
            Al crear un squad se provisiona su estructura base (categorías, estados,
            configuración) sin copiar datos de negocio.
          </p>
        </form>
      </Modal>
    </div>
  )
}
