// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useEffect, useState } from 'react'
import client from '../api/client'
import { useAplicacion } from '../context/AplicacionContext'
import { Aviso, Chip, EncabezadoPagina, Icono, Kpi, Tarjeta } from '../components/ui'

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
    <div>
      <EncabezadoPagina
        icono={<Icono nombre="globo" />}
        titulo="Dashboard Unificado"
        descripcion={
          modoConsolidado
            ? 'Vista consolidada de todos los squads autorizados'
            : 'Selecciona "★ Todos los squads" en el encabezado para la vista consolidada'
        }
      />

      {/* Main Content */}
      <div className="pagina">
        {error && (
          <Aviso tono="alerta" className="mb-6 flex items-center gap-2">
            <Icono nombre="alerta" /> {error}
          </Aviso>
        )}

        {data && (
          <>
            <div className="mb-6 flex items-center gap-2 text-sm text-slate-600">
              <Chip tono="marca">{data.total_aplicaciones} Squad(s)</Chip>
              <span className="text-slate-400">•</span>
              <Chip tono="neutro">
                {modoConsolidado ? 'Modo consolidado' : 'Modo operativo'}
              </Chip>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.aplicaciones.map((a, idx) => {
                const color = COLORES_SQUAD[idx % COLORES_SQUAD.length]

                return (
                  <Tarjeta key={a.aplicacion} className={a.activa ? undefined : 'opacity-60'}>
                    <div className="mb-3 flex items-start justify-between">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-lg"
                        style={{ backgroundColor: `${color}15`, color }}
                      >
                        <Icono nombre="edificio" />
                      </div>
                      {!a.activa && <Chip tono="neutro">Inactivo</Chip>}
                    </div>

                    <h3 className="titulo-seccion">{a.nombre}</h3>
                    <p className="font-mono text-xs text-slate-500">{a.aplicacion}</p>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <Kpi rotulo="Personas" valor={a.personas} />
                      <Kpi rotulo="Categorías" valor={a.categorias} />
                    </div>

                    <p className="mt-4 flex items-center gap-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
                      {a.activa ? (
                        <>
                          <Icono nombre="check" /> Squad activo en el sistema
                        </>
                      ) : (
                        'Squad inactivo'
                      )}
                    </p>
                  </Tarjeta>
                )
              })}
            </div>

            <Aviso tono="info" className="mt-6">
              <p className="mb-1 flex items-center gap-1.5 font-semibold">
                <Icono nombre="info" /> Próximas mejoras
              </p>
              <p>
                Al portar el dominio (fases 3–5), este tablero incorporará gráficas de requerimientos por estado, ANS, horas,
                facturación y carga del equipo, por squad.
              </p>
            </Aviso>
          </>
        )}
      </div>
    </div>
  )
}
