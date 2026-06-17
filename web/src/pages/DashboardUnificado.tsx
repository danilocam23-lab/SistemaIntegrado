import { useEffect, useState } from 'react'
import client from '../api/client'
import { useAplicacion } from '../context/AplicacionContext'

const COLORES_SQUAD = ['#2563eb', '#7c3aed', '#16a34a', '#f59e0b', '#dc2626', '#0891b2', '#06b6d4', '#8b5cf6']

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      {/* Header Premium */}
      <div className="sticky top-0 z-30 border-b border-slate-200/50 bg-white/80 backdrop-blur-xl shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">🌐</span>
                </div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 via-teal-800 to-slate-900 bg-clip-text text-transparent">
                  Dashboard Unificado
                </h1>
              </div>
              <p className="text-slate-600 text-sm">
                {modoConsolidado
                  ? 'Vista consolidada de todos los squads autorizados'
                  : 'Selecciona "★ Todos los squads" en el encabezado para la vista consolidada'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-700">
            ⚠️ {error}
          </div>
        )}

        {data && (
          <>
            <div className="mb-6 flex items-center gap-2 text-sm text-slate-600">
              <span className="inline-block px-4 py-2 rounded-full bg-blue-100 text-blue-700 font-semibold">
                {data.total_aplicaciones} Squad(s)
              </span>
              <span className="text-slate-400">•</span>
              <span className="inline-block px-4 py-2 rounded-full bg-slate-100 text-slate-700 font-semibold">
                {modoConsolidado ? 'Modo consolidado' : 'Modo operativo'}
              </span>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {data.aplicaciones.map((a, idx) => {
                const color = COLORES_SQUAD[idx % COLORES_SQUAD.length]
                const isInactive = !a.activa
                
                return (
                  <div
                    key={a.aplicacion}
                    className={`group relative overflow-hidden rounded-2xl border ${
                      isInactive ? 'border-slate-200 opacity-60' : 'border-slate-200 hover:border-slate-300'
                    } bg-white p-6 shadow-sm hover:shadow-lg transition-all duration-300`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-5 transition-opacity duration-300" style={{ backgroundImage: `linear-gradient(to bottom right, ${color}, transparent)` }} />

                    <div className="relative">
                      {/* Header con icono y badge */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="h-12 w-12 rounded-xl p-3 flex items-center justify-center text-lg" style={{ backgroundColor: `${color}15`, color }}>
                          🏢
                        </div>
                        {isInactive && (
                          <span className="inline-block px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
                            Inactivo
                          </span>
                        )}
                      </div>

                      {/* Nombre */}
                      <div className="mb-1">
                        <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                          {a.nombre}
                        </h3>
                        <p className="text-xs text-slate-500 font-mono">{a.aplicacion}</p>
                      </div>

                      {/* Divider */}
                      <div className="my-4 h-px bg-gradient-to-r from-slate-200 via-slate-200 to-transparent" />

                      {/* Métricas */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-slate-500 uppercase tracking-wider font-semibold mb-1">Personas</div>
                          <div className="text-3xl font-bold text-slate-900">{a.personas}</div>
                        </div>
                        <div>
                          <div className="text-sm text-slate-500 uppercase tracking-wider font-semibold mb-1">Categorías</div>
                          <div className="text-3xl font-bold text-slate-900">{a.categorias}</div>
                        </div>
                      </div>

                      {/* Footer info */}
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <p className="text-xs text-slate-400">
                          {a.activa ? '✓ Squad activo en el sistema' : 'Squad inactivo'}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-sm text-slate-600">
                <p className="font-semibold text-slate-900 mb-2">ℹ️ Próximas mejoras</p>
                <p className="text-slate-500">
                  Al portar el dominio (fases 3–5), este tablero incorporará gráficas de requerimientos por estado, ANS, horas, 
                  facturación y carga del equipo, por squad.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
