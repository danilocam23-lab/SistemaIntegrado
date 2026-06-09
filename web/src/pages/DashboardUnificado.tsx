import { useEffect, useState } from 'react'
import client from '../api/client'
import { useAplicacion } from '../context/AplicacionContext'

interface FilaAplicacion {
  aplicacion: string
  nombre: string
  activa: boolean
  personas: number
  categorias: number
}
interface Consolidado {
  modo_consolidado: boolean
  total_aplicaciones: number
  aplicaciones: FilaAplicacion[]
}

export default function DashboardUnificado() {
  const { activa, modoConsolidado } = useAplicacion()
  const [data, setData] = useState<Consolidado | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!activa) return
    setError('')
    client
      .get<Consolidado>('/dashboard/consolidado')
      .then((r) => setData(r.data))
      .catch(() =>
        setError('No fue posible cargar el dashboard. Requiere rol de administración.'),
      )
  }, [activa])

  return (
    <div>
      <h1 className="text-xl font-bold text-marca-osc">Dashboard unificado</h1>
      <p className="mb-4 text-sm text-slate-500">
        {modoConsolidado
          ? 'Vista consolidada de todos los squads autorizados.'
          : 'Selecciona "★ Todos los squads" en el encabezado para la vista consolidada.'}
      </p>

      {error && (
        <div className="rounded bg-amber-50 p-3 text-sm text-amber-700">{error}</div>
      )}

      {data && (
        <>
          <p className="mb-3 text-sm text-slate-600">
            {data.total_aplicaciones} squad(s) ·{' '}
            {modoConsolidado ? 'modo consolidado' : 'modo operativo'}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.aplicaciones.map((a) => (
              <div key={a.aplicacion} className="rounded-xl border bg-white p-4">
                <div className="font-semibold text-marca-osc">{a.nombre}</div>
                <div className="mb-3 text-xs text-slate-400">
                  {a.aplicacion}
                  {a.activa ? '' : ' · inactiva'}
                </div>
                <div className="flex gap-6">
                  <div>
                    <div className="text-2xl font-bold">{a.personas}</div>
                    <div className="text-xs text-slate-500">Personas</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{a.categorias}</div>
                    <div className="text-xs text-slate-500">Categorías</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-400">
            Al portar el dominio (fases 3–5) este tablero incorpora gráficas de requerimientos
            por estado, ANS, horas, facturación y carga del equipo, por squad.
          </p>
        </>
      )}
    </div>
  )
}
