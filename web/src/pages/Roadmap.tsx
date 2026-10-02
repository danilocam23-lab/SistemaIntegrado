// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useMemo, useState } from 'react'
import { Aviso, Boton, EncabezadoPagina, Icono } from '../components/ui'
import { AgendaMovil } from './roadmap/AgendaMovil'
import { BarraFiltrosRoadmap } from './roadmap/BarraFiltrosRoadmap'
import { posicionHoy } from './roadmap/CapaTiempo'
import { EsqueletoRoadmap } from './roadmap/EsqueletoRoadmap'
import { GanttRoadmap } from './roadmap/GanttRoadmap'
import { PanelDetalleRoadmap } from './roadmap/PanelDetalleRoadmap'
import { AvisosRoadmap, KpisRoadmap, LeyendaRoadmap } from './roadmap/ResumenRoadmap'
import { MAX_MESES_TODO } from './roadmap/derivados'
import { useRoadmap } from './roadmap/useRoadmap'

export default function Roadmap() {
  const r = useRoadmap()
  const { datos } = r
  const [seleccionId, setSeleccionId] = useState<string | null>(null)

  const seleccionado = useMemo(
    () => (seleccionId ? r.base.dibujables.find((x) => x.req.id === seleccionId) ?? null : null),
    [seleccionId, r.base.dibujables],
  )

  const categoriasLeyenda = useMemo(() => {
    const mapa = new Map<string, { id: string; nombre: string; color: string }>()
    r.grupos.forEach((g) => g.categorias.forEach((c) => mapa.set(c.id, { id: c.id, nombre: c.nombre, color: c.color })))
    return Array.from(mapa.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [r.grupos])

  const hayDatos = r.grupos.length > 0
  const hayFiltroActivo = r.fueraDeRango > 0 && r.preset !== 'todo'

  return (
    <div className="flex flex-col">
      <EncabezadoPagina
        icono={<Icono nombre="calendario" />}
        titulo="Roadmap del Equipo"
        descripcion="Línea de tiempo de proyectos y entregas"
      />

      {datos.hayError && (
        <Aviso tono="error" className="mb-4">
          <span role="alert" className="flex flex-wrap items-center justify-between gap-2">
            <span>No fue posible cargar el Roadmap.</span>
            <Boton tamano="sm" onClick={datos.reintentar}>Reintentar</Boton>
          </span>
        </Aviso>
      )}

      {datos.cargandoInicial ? (
        <EsqueletoRoadmap />
      ) : datos.hayError ? null : (
        <>
          <KpisRoadmap resumen={r.resumen} />
          <AvisosRoadmap
            resumen={r.resumen}
            mostrarSobrecarga={r.modo === 'usuario' && datos.cargaDisponible}
            sinFecha={r.sinFecha}
            onSeleccionarVencido={(x) => setSeleccionId(x.req.id)}
          />

          <BarraFiltrosRoadmap
            modo={r.modo}
            onModo={r.setModo}
            preset={r.preset}
            onPreset={r.elegirPreset}
            desdeIndice={r.rango.desdeIndice}
            hastaIndice={r.rango.hastaIndice}
            opcionesMes={r.opcionesMes}
            onExtremo={r.cambiarExtremo}
            estadosDisponibles={r.estadosDisponibles}
            estadosActivos={r.estadosActivos}
            setEstadosActivos={r.setEstadosActivos}
            personas={datos.personas}
            filtroPersona={r.filtroPersona}
            onFiltroPersona={r.setFiltroPersona}
            busqueda={r.busqueda}
            onBusqueda={r.setBusqueda}
          />

          {r.rangoRecortado && (
            <Aviso tono="alerta" className="mb-4">
              <span role="status">
                El rango «Todo» se limita a {MAX_MESES_TODO} meses: hay requerimientos con fechas posteriores a{' '}
                {r.rango.columnas[r.rango.columnas.length - 1].etiqueta}. Revisa fechas atípicas o usa un rango personalizado.
              </span>
            </Aviso>
          )}

          {!hayDatos ? (
            <Aviso tono="info">
              <span role="status" className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {r.base.dibujables.length === 0
                    ? 'No hay requerimientos con fecha de inicio para dibujar.'
                    : `Sin requerimientos con fechas entre ${r.rango.columnas[0].etiqueta} y ${r.rango.columnas[r.rango.columnas.length - 1].etiqueta}.`}
                </span>
                {hayFiltroActivo && (
                  <Boton tamano="sm" variante="primario" onClick={() => r.elegirPreset('todo')}>Ampliar a «Todo»</Boton>
                )}
              </span>
            </Aviso>
          ) : (
            <>
              <div className="hidden md:block">
                <GanttRoadmap
                  grupos={r.grupos}
                  rango={r.rango}
                  hoy={r.hoy}
                  contraidos={r.contraidos}
                  onAlternar={r.alternarContraido}
                  seleccionId={seleccionId}
                  onSeleccionar={setSeleccionId}
                  mostrarPorcentajes={r.modo === 'usuario'}
                  cargaDisponible={datos.cargaDisponible}
                />
              </div>
              <div className="md:hidden">
                <AgendaMovil
                  grupos={r.grupos}
                  rango={r.rango}
                  hoy={r.hoy}
                  onSeleccionar={setSeleccionId}
                  cargaDisponible={datos.cargaDisponible}
                />
              </div>
              <LeyendaRoadmap
                categorias={categoriasLeyenda}
                hoy={r.hoy}
                hayHoy={posicionHoy(r.hoy, r.rango) !== null}
              />
            </>
          )}
        </>
      )}

      <PanelDetalleRoadmap
        seleccionado={seleccionado}
        personas={datos.personas}
        asignaciones={datos.asignaciones}
        categoriasPorId={datos.categoriasPorId}
        onCerrar={() => setSeleccionId(null)}
      />
    </div>
  )
}
