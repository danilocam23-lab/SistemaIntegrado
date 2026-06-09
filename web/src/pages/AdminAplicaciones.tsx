import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import type { Aplicacion } from '../types'

export default function AdminAplicaciones() {
  const { usuario } = useAuth()
  const esSuperadmin = usuario?.rol === 'superadmin'
  const [apps, setApps] = useState<Aplicacion[]>([])
  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState('')

  function cargar(): void {
    void client.get<Aplicacion[]>('/aplicaciones').then((r) => {
      const todas = r.data
      // admin_app solo ve sus propios squads
      if (esSuperadmin) {
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
      <h1 className="mb-4 text-xl font-bold text-marca-osc">Administración de squads</h1>

      {esSuperadmin && (
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
              className="rounded border px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Nombre</span>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              placeholder="Business Intelligence"
              className="rounded border px-3 py-2"
            />
          </label>
          <button className="rounded bg-marca px-4 py-2 text-white hover:bg-marca-osc">
            Crear squad
          </button>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </form>
      )}

      <table className="w-full overflow-hidden rounded-xl border bg-white text-sm">
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
                  className="text-marca hover:underline"
                >
                  {app.activa ? 'Desactivar' : 'Activar'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {esSuperadmin && (
        <p className="mt-3 text-xs text-slate-400">
          Al crear un squad se provisiona su estructura base (categorías, estados,
          configuración) sin copiar datos de negocio.
        </p>
      )}
    </div>
  )
}
