// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useState } from 'react'
import { CONSOLIDADO } from '../api/client'
import { Boton, EncabezadoPagina, FiltroDesplegable, Icono } from '../components/ui'
import BannerRiesgo from './dashboard-backlog/BannerRiesgo'
import FiltroRangoRapido from './dashboard-backlog/FiltroRangoRapido'
import GraficaCapacidadSquad from './dashboard-backlog/GraficaCapacidadSquad'
import GraficaComparativaSquads from './dashboard-backlog/GraficaComparativaSquads'
import GraficaEntregasPorMes from './dashboard-backlog/GraficaEntregasPorMes'
import GraficaWoPorMes from './dashboard-backlog/GraficaWoPorMes'
import ModalDetalleAplicaciones from './dashboard-backlog/ModalDetalleAplicaciones'
import ModalDetallePersonas from './dashboard-backlog/ModalDetallePersonas'
import ModalDetalleWo from './dashboard-backlog/ModalDetalleWo'
import SeccionKpis from './dashboard-backlog/SeccionKpis'
import TablaDetalleSquad from './dashboard-backlog/TablaDetalleSquad'
import { useDatosBacklog } from './dashboard-backlog/useDatosBacklog'
import { useDerivadosBacklog } from './dashboard-backlog/useDerivadosBacklog'
import { useExportarExcelBacklog } from './dashboard-backlog/useExportarExcelBacklog'
import { useFiltroPeriodo } from './dashboard-backlog/useFiltroPeriodo'
import { MESES_LABELS } from './dashboard-backlog/utilidades'

/** Dashboard de Backlog (`/dashboard-backlog`): orquestador delgado; la lógica vive en `dashboard-backlog/`. */
export default function DashboardSquad() {
  const datos = useDatosBacklog()
  const filtro = useFiltroPeriodo(datos.capacidades, datos.requerimientos, datos.soporteResumen)

  const [mostrarDetalleWo, setMostrarDetalleWo] = useState(false)
  const [busquedaDetalleWo, setBusquedaDetalleWo] = useState('')
  const [mostrarDetallePersonas, setMostrarDetallePersonas] = useState(false)
  const [busquedaDetallePersonas, setBusquedaDetallePersonas] = useState('')
  const [squadDetalleAplicaciones, setSquadDetalleAplicaciones] = useState<string | null>(null)
  const [busquedaDetalleAplicaciones, setBusquedaDetalleAplicaciones] = useState('')

  const derivados = useDerivadosBacklog({
    activa: datos.activa,
    requerimientos: datos.requerimientos,
    personas: datos.personas,
    capacidades: datos.capacidades,
    festivos: datos.festivos,
    configuraciones: datos.configuraciones,
    soporteResumen: datos.soporteResumen,
    resolverNombreSquad: datos.resolverNombreSquad,
    squadCodigoPorNombre: datos.squadCodigoPorNombre,
    periodosSeleccionados: filtro.periodosSeleccionados,
    squadDetalleAplicaciones,
    busquedaDetalleWo,
    busquedaDetallePersonas,
    busquedaDetalleAplicaciones,
  })

  const { exportarExcel } = useExportarExcelBacklog(derivados.filasAnalisis)

  if (datos.cargandoTodo) {
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
          <p className="text-sm text-slate-500 mt-2">Obteniendo datos del equipo…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <EncabezadoPagina
        icono={<Icono nombre="grafico-barras" />}
        titulo="Backlog"
        descripcion={`Métricas de capacidad y requerimientos en tiempo real${
          datos.appActiva && datos.appActiva !== CONSOLIDADO ? ` · ${datos.appActiva}` : ' · Todos los squads'
        }`}
        acciones={
          <>
            <FiltroRangoRapido activo={filtro.presetActivo} onSeleccionar={filtro.aplicarPreset} />
            <FiltroDesplegable
              label="Año"
              icono={<Icono nombre="calendario" />}
              opciones={filtro.anosDisponibles}
              activos={filtro.anosActivos}
              setActivos={filtro.setAnosActivos}
              valorInicial={filtro.anoInicial}
            />
            <FiltroDesplegable
              label="Mes"
              icono={<Icono nombre="calendario" />}
              opciones={MESES_LABELS}
              activos={filtro.mesesActivos}
              setActivos={filtro.setMesesActivos}
              esMes
              valorInicial={filtro.mesInicialNumero}
              anchoPanel="240px"
            />
            <Boton variante="secundario" onClick={filtro.restablecer}>
              Restablecer
            </Boton>
            <Boton
              variante="primario"
              icono={<Icono nombre="documento" />}
              onClick={exportarExcel}
              disabled={derivados.filasAnalisis.length === 0}
            >
              Exportar
            </Boton>
          </>
        }
      />

      <div className="pagina space-y-4">
        <BannerRiesgo filas={derivados.filasAnalisis} resumen={derivados.resumenRiesgo} />

        <SeccionKpis
          kpis={derivados.kpis}
          horasEntregas={derivados.horasEntregasFiltradas}
          horasWo={derivados.horasWoFiltradas}
          totalHoras={derivados.totalHorasEntregasWo}
          resumenCapacidad={derivados.resumenCapacidad}
          resumenRiesgo={derivados.resumenRiesgo}
        />

        {/* Bento: entregas y WO lado a lado (2+2); comparativa ANS y capacidad (2+2);
            tabla de detalle a ancho completo. */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className="min-w-0 lg:col-span-2">
            <GraficaEntregasPorMes datos={derivados.entregasPorMes} />
          </div>
          <div className="min-w-0 lg:col-span-2">
            <GraficaWoPorMes
              datos={derivados.woSoportePorMes}
              hayDetalle={derivados.detalleWoSoporte.length > 0}
              onVerDetalle={() => {
                setBusquedaDetalleWo('')
                setMostrarDetalleWo(true)
              }}
            />
          </div>
          <div className="min-w-0 lg:col-span-2">
            <GraficaComparativaSquads filas={derivados.filasAnalisis} />
          </div>
          <div className="min-w-0 lg:col-span-2">
            <GraficaCapacidadSquad
              datos={derivados.filasCapacidadSquad}
              totalPeriodos={filtro.periodosSeleccionados.length}
              totalFestivosMes={derivados.festivosPorMes.size}
              hayDetalle={derivados.detallePersonasCapacidad.length > 0}
              onVerDetalle={() => {
                setBusquedaDetallePersonas('')
                setMostrarDetallePersonas(true)
              }}
            />
          </div>
          <div className="min-w-0 lg:col-span-4">
            <TablaDetalleSquad
              filas={derivados.filasAnalisis}
              onVerAplicaciones={(squad) => {
                setBusquedaDetalleAplicaciones('')
                setSquadDetalleAplicaciones(squad)
              }}
            />
          </div>
        </div>
      </div>

      {mostrarDetalleWo && (
        <ModalDetalleWo
          filas={derivados.detalleWoSoporteFiltrado}
          busqueda={busquedaDetalleWo}
          onBusqueda={setBusquedaDetalleWo}
          onCerrar={() => setMostrarDetalleWo(false)}
        />
      )}

      {mostrarDetallePersonas && (
        <ModalDetallePersonas
          filas={derivados.detallePersonasCapacidadFiltrado}
          totalPeriodos={filtro.periodosSeleccionados.length}
          busqueda={busquedaDetallePersonas}
          onBusqueda={setBusquedaDetallePersonas}
          onCerrar={() => setMostrarDetallePersonas(false)}
        />
      )}

      {squadDetalleAplicaciones !== null && (
        <ModalDetalleAplicaciones
          squad={squadDetalleAplicaciones}
          filas={derivados.detalleAplicacionesEpmFiltrado}
          busqueda={busquedaDetalleAplicaciones}
          onBusqueda={setBusquedaDetalleAplicaciones}
          onCerrar={() => setSquadDetalleAplicaciones(null)}
        />
      )}
    </div>
  )
}
