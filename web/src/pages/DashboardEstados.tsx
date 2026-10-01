// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useMemo, useState } from 'react'
import { CONSOLIDADO } from '../api/client'
import { useLista } from '../api/hooks'
import { useAplicacion } from '../context/AplicacionContext'
import type { Aplicacion, Requerimiento } from '../types'
import { BarraFiltros, Boton, EncabezadoPagina, Icono, Kpi } from '../components/ui'
import { COLOR_GRAFICA } from '../components/ui/graficas'
import CicloVida from './dashboard-estados/CicloVida'
import GraficaEvolucion from './dashboard-estados/GraficaEvolucion'
import ModalGarantias from './dashboard-estados/ModalGarantias'
import RepartoFases from './dashboard-estados/RepartoFases'
import { FASES_REQUERIMIENTO, FASE_OTROS, fmtNumero } from './dashboard-estados/constantes'
import type { DetalleGarantiasAbierto, Metrica } from './dashboard-estados/tipos'
import { useDerivadosEstados } from './dashboard-estados/useDerivadosEstados'

const METRICAS: Array<{ valor: Metrica; etiqueta: string }> = [
  { valor: 'cantidad', etiqueta: 'Cantidad' },
  { valor: 'horas', etiqueta: 'Horas' },
]

export default function DashboardEstados() {
  const { datos: reqs, cargando } = useLista<Requerimiento>('/requerimientos')
  const { datos: aplicaciones } = useLista<Aplicacion>('/aplicaciones')
  const { activa } = useAplicacion()
  const [detalleGarantias, setDetalleGarantias] = useState<DetalleGarantiasAbierto | null>(null)
  const [fase, setFase] = useState('todas')
  const [metrica, setMetrica] = useState<Metrica>('cantidad')

  const requerimientos = useMemo(() => {
    if (!activa || activa === CONSOLIDADO) return reqs
    return reqs.filter((req) => req.aplicacion_id === activa || req.solicitud?.squad_id === activa)
  }, [reqs, activa])

  const appActiva = useMemo(() => {
    if (activa === CONSOLIDADO) return 'Todos los squads'
    return aplicaciones.find((app) => app.codigo === activa)?.nombre ?? activa
  }, [activa, aplicaciones])

  const derivados = useDerivadosEstados(requerimientos, fase)
  const { kpis } = derivados

  const opcionesFase = useMemo(() => {
    const base = [{ id: 'todas', nombre: 'Todas' }, ...FASES_REQUERIMIENTO.map((f) => ({ id: f.id, nombre: f.nombre }))]
    return derivados.hayOtros ? [...base, { id: FASE_OTROS.id, nombre: FASE_OTROS.nombre }] : base
  }, [derivados.hayOtros])

  if (cargando) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <div className="mb-6 flex justify-center">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-600 animate-spin" />
            </div>
          </div>
          <p className="text-lg font-semibold text-slate-900">Cargando dashboard</p>
          <p className="text-sm text-slate-500 mt-2">Obteniendo datos de estados…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <EncabezadoPagina
        icono={<Icono nombre="grafico-barras" />}
        titulo="Estados de Requerimientos"
        descripcion={`Análisis detallado de estados${
          appActiva && appActiva !== CONSOLIDADO ? ` · ${appActiva}` : ' · Consolidado'
        }`}
      />

      <div className="pagina">
        <BarraFiltros className="mb-6">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por fase">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-500">Fase</span>
            {opcionesFase.map((opcion) => (
              <Boton
                key={opcion.id}
                tamano="sm"
                variante={fase === opcion.id ? 'primario' : 'secundario'}
                aria-pressed={fase === opcion.id}
                onClick={() => setFase(opcion.id)}
              >
                {opcion.nombre}
              </Boton>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Ver por">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-500">Ver por</span>
            {METRICAS.map((opcion) => (
              <Boton
                key={opcion.valor}
                tamano="sm"
                variante={metrica === opcion.valor ? 'primario' : 'secundario'}
                aria-pressed={metrica === opcion.valor}
                onClick={() => setMetrica(opcion.valor)}
              >
                {opcion.etiqueta}
              </Boton>
            ))}
          </div>
        </BarraFiltros>

        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4 mb-8">
          <Kpi
            rotulo="Total de Requerimientos"
            valor={kpis.total}
            nota="en el sistema"
            acento={COLOR_GRAFICA.serie}
          />
          <Kpi
            rotulo="Requerimientos Activos"
            valor={kpis.activos}
            nota={`${kpis.total > 0 ? Math.round((kpis.activos / kpis.total) * 100) : 0}% del total`}
            acento={COLOR_GRAFICA.serie}
          />
          <Kpi
            rotulo="Horas Estimadas"
            valor={`${fmtNumero(kpis.totalHoras)}h`}
            nota={`Promedio: ${fmtNumero(kpis.total > 0 ? kpis.totalHoras / kpis.total : 0)}h`}
            acento={COLOR_GRAFICA.serie}
          />
          <Kpi
            rotulo="Total de Entregas"
            valor={fmtNumero(kpis.totalEntregas)}
            nota="proyectadas"
            acento={COLOR_GRAFICA.serie}
          />
        </div>

        <div className="space-y-6">
          <CicloVida
            titulo="Ciclo de vida del requerimiento"
            descripcion="Estados agrupados por fase: cantidad, % del total y horas"
            unidad="requerimientos"
            fases={
              fase === 'todas'
                ? derivados.cicloRequerimientos
                : derivados.cicloRequerimientos.filter((f) => f.id === fase)
            }
            totales={derivados.totalesRequerimientos}
            metrica={metrica}
          />

          <CicloVida
            titulo="Ciclo de vida de la entrega"
            descripcion="Estados de las entregas agrupados por fase, con garantías"
            unidad="entregas"
            fases={derivados.cicloEntregas}
            totales={derivados.totalesEntregas}
            metrica={metrica}
            onVerGarantias={(titulo, filas) => setDetalleGarantias({ titulo, filas })}
            detalleGarantiasTotal={derivados.detalleGarantiasTotal}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2 mt-6">
          <GraficaEvolucion datos={derivados.porMes} />
          <RepartoFases fases={derivados.repartoFases} totales={derivados.totalesReparto} metrica={metrica} />
        </div>
      </div>

      {detalleGarantias && (
        <ModalGarantias detalle={detalleGarantias} onCerrar={() => setDetalleGarantias(null)} />
      )}
    </div>
  )
}
