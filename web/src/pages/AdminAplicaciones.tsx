import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import type { Aplicacion } from '../types'
import { TablaScroll } from '../components/ui/primitivos'

export default function AdminAplicaciones() {
  const { usuario, tienePermiso } = useAuth()
  const puedeCrear = tienePermiso('aplicaciones.crear')
  const puedeEditar = tienePermiso('aplicaciones.editar')
  const [apps, setApps] = useState<Aplicacion[]>([])
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

  async function crear(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError('')
    try {
      await client.post('/aplicaciones', { codigo, nombre, descripcion: '' })
      setCodigo('')
      setNombre('')
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
      <h1 className="titulo-pagina mb-4">Administración de squads</h1>

      {puedeCrear && (
        <form
          onSubmit={crear}
          className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4"
        >
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Código</span>
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              required
              placeholder="bi"
              className="campo"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Nombre</span>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              placeholder="Business Intelligence"
              className="campo"
            />
          </label>
          <button className="btn btn-primario">
            Crear squad
          </button>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </form>
      )}

      <TablaScroll>
      <table className="text-sm">
        <thead className="bg-marca-osc text-white">
          <tr>
            <th className="p-2 text-left">Código</th>
            <th className="p-2 text-left">Nombre</th>
            <th className="p-2 text-left">Estado</th>
            <th className="p-2">Acción</th>
          </tr>
        </thead>
        <tbody>
          {apps.map((app) => (
            <tr key={app.codigo} className="border-t">
              <td className="p-2 font-mono">{app.codigo}</td>
              <td className="p-2">{app.nombre}</td>
              <td className="p-2">{app.activa ? 'Activa' : 'Inactiva'}</td>
              <td className="p-2 text-center">
                <button
                  onClick={() => alternarEstado(app)}
                  disabled={!puedeEditar}
                  className="enlace-accion"
                >
                  {app.activa ? 'Desactivar' : 'Activar'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </TablaScroll>
      {puedeCrear && (
        <p className="mt-3 text-xs text-slate-400">
          Al crear un squad se provisiona su estructura base (categorías, estados,
          configuración) sin copiar datos de negocio.
        </p>
      )}
    </div>
  )
}
