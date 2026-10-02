// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useCallback, useMemo, useState } from 'react'
import { Aviso, Boton, EncabezadoPagina, Icono } from '../components/ui'
import { useAplicacion } from '../context/AplicacionContext'
import { useAuth } from '../context/AuthContext'
import { BarraFiltrosCapacidades } from './capacidades/BarraFiltrosCapacidades'
import type { ModoCapacidades, VistaCapacidades } from './capacidades/BarraFiltrosCapacidades'
import { EsqueletoCapacidades } from './capacidades/EsqueletoCapacidades'
import { KpisCapacidades } from './capacidades/KpisCapacidades'
import { LeyendaCapacidades } from './capacidades/LeyendaCapacidades'
import { MapaCalor } from './capacidades/MapaCalor'
import type { EdicionCelda } from './capacidades/MapaCalor'
import { ModalCopiarMes } from './capacidades/ModalCopiarMes'
import { ModalRellenarAnio } from './capacidades/ModalRellenarAnio'
import { PanelCapacidad } from './capacidades/PanelCapacidad'
import { TablaEquipos } from './capacidades/TablaEquipos'
import { TarjetasMovil } from './capacidades/TarjetasMovil'
import { ToastEliminacion } from './capacidades/ToastEliminacion'
import { etiquetaMes } from './capacidades/plan'
import { MESES_ABREV } from './capacidades/tipos'
import type { FilaCapacidad, ResultadoLote } from './capacidades/tipos'
import { useDatosCapacidades } from './capacidades/useDatosCapacidades'
import { useEliminacionCapacidad } from './capacidades/useEliminacionCapacidad'
import { useEscriturasCapacidades } from './capacidades/useEscriturasCapacidades'
import { useMatrizCapacidades } from './capacidades/useMatrizCapacidades'
import type { FiltrosCapacidades } from './capacidades/useMatrizCapacidades'

interface PanelAbierto {
  /** `''` = alta nueva sin persona elegida. */
  personaId: string
  indice: number
}

interface MensajePantalla {
  tono: 'exito' | 'alerta' | 'error'
  titulo: string
  detalles?: string[]
}

export default function Capacidades() {
  const { tienePermiso } = useAuth()
  if (!tienePermiso('capacidades.ver')) {
    return (
      <div>
        <EncabezadoPagina icono={<Icono nombre="grafico-barras" />} titulo="Capacidades mensuales" />
        <Aviso tono="alerta"><span role="alert">No tienes acceso a esta sección.</span></Aviso>
      </div>
    )
  }
  return <ContenidoCapacidades />
}

function ContenidoCapacidades() {
  const { tienePermiso } = useAuth()
  const { aplicaciones, modoConsolidado } = useAplicacion()
  // En modo consolidado el servidor rechaza las escrituras (409): la pantalla es solo lectura.
  const puedeEditar = tienePermiso('capacidades.editar') && !modoConsolidado

  const datos = useDatosCapacidades()
  const { recargar } = datos

  const [anio, setAnio] = useState(() => new Date().getFullYear())
  const [vista, setVista] = useState<VistaCapacidades>('persona')
  const [modo, setModo] = useState<ModoCapacidades>('horas')
  const [filtros, setFiltros] = useState<FiltrosCapacidades>({ busqueda: '', rol: '', soloAlertas: false })
  const [edicion, setEdicion] = useState<EdicionCelda | null>(null)
  const [panel, setPanel] = useState<PanelAbierto | null>(null)
  const [copiarAbierto, setCopiarAbierto] = useState(false)
  const [rellenarAbierto, setRellenarAbierto] = useState(false)
  const [mensaje, setMensaje] = useState<MensajePantalla | null>(null)

  const alFallarEliminar = useCallback(
    (texto: string) => setMensaje({ tono: 'error', titulo: texto }),
    [],
  )
  const eliminacion = useEliminacionCapacidad({ puedeEditar, recargar, alFallar: alFallarEliminar })
  const escrituras = useEscriturasCapacidades({ puedeEditar, recargar })

  const matriz = useMatrizCapacidades({
    capacidades: datos.capacidades,
    personas: datos.personas,
    anio,
    horasMesDefault: datos.horasMesDefault,
    festivosPorMes: datos.festivosPorMes,
    cargaPorPersona: datos.cargaPorPersona,
    cargaDisponible: datos.cargaDisponible,
    ocultos: eliminacion.ocultos,
    filtros,
  })
  const { indicadores, filasTodas, filas, meses, mesActual } = matriz
  const indiceMesActual = matriz.esAnioActual ? matriz.indiceMesActual : -1

  const personasEditables = useMemo(() => filasTodas.filter((f) => !f.inactiva), [filasTodas])
  const basePorMes = useMemo(() => meses.map((m) => m.base), [meses])

  const nombreAplicacion = useCallback(
    (persona: FilaCapacidad['persona']) => {
      const codigo = persona.aplicacion_id ?? ''
      return aplicaciones.find((a) => a.codigo === codigo)?.nombre ?? codigo
    },
    [aplicaciones],
  )

  const cambiarFiltros = useCallback(
    (cambio: Partial<FiltrosCapacidades>) => setFiltros((previo) => ({ ...previo, ...cambio })),
    [],
  )

  function activarCelda(fila: FilaCapacidad, indice: number, conMayus: boolean) {
    const celda = fila.celdas[indice]
    // Con registro y mes vigente o futuro: edición en línea. Mayús, vacía o mes pasado: panel
    // (el panel avisa "estás editando un mes pasado" y exige pulsar Guardar).
    if (conMayus || !celda.registro || celda.mes < mesActual) {
      setEdicion(null)
      setPanel({ personaId: fila.persona.id, indice })
      return
    }
    setEdicion({ personaId: fila.persona.id, mes: celda.mes })
  }

  async function guardarCelda(fila: FilaCapacidad, indice: number, horas: number): Promise<string | null> {
    const celda = fila.celdas[indice]
    const error = await escrituras.guardarRegistro({
      registro: celda.registro, personaId: fila.persona.id, mes: celda.mes, horas,
    })
    if (!error) setEdicion(null)
    return error
  }

  function eliminarCelda(fila: FilaCapacidad, indice: number) {
    const registro = fila.celdas[indice].registro
    setEdicion(null)
    if (registro) eliminacion.eliminar(registro, `${fila.persona.nombre} · ${etiquetaMes(registro.mes)}`)
  }

  function mostrarResultado(titulo: string, resultado: ResultadoLote) {
    if (resultado.errores.length === 0) {
      setMensaje({
        tono: 'exito',
        titulo: `${titulo}: ${resultado.creadas} creados y ${resultado.actualizadas} actualizados.`,
      })
      return
    }
    const fallidas = Math.max(resultado.errores.length, resultado.total - resultado.creadas - resultado.actualizadas)
    setMensaje({
      tono: 'alerta',
      titulo: `${titulo}: se guardaron ${resultado.creadas + resultado.actualizadas} y fallaron ${fallidas}.`,
      detalles: resultado.errores.slice(0, 5),
    })
  }

  const filaPanel = panel ? filasTodas.find((f) => f.persona.id === panel.personaId) ?? null : null
  const hayPersonas = filasTodas.length > 0

  return (
    <div>
      <EncabezadoPagina
        icono={<Icono nombre="grafico-barras" />}
        titulo="Capacidades mensuales"
        descripcion="Horas disponibles por persona y mes"
        acciones={puedeEditar && (
          <>
            <Boton onClick={() => setCopiarAbierto(true)} disabled={!hayPersonas}>Copiar mes…</Boton>
            <Boton onClick={() => setRellenarAbierto(true)} disabled={!hayPersonas}>Rellenar año…</Boton>
            <Boton
              variante="primario"
              onClick={() => setPanel({ personaId: '', indice: indiceMesActual >= 0 ? indiceMesActual : 0 })}
            >
              Nueva capacidad
            </Boton>
          </>
        )}
      />

      {modoConsolidado && (
        <Aviso tono="info" className="mb-4">
          <span role="status">
            Modo consolidado: solo lectura. Elige una aplicación para editar capacidades.
          </span>
        </Aviso>
      )}

      {datos.errorPrincipal && (
        <Aviso tono="error" className="mb-4">
          <span role="alert" className="flex flex-wrap items-center justify-between gap-2">
            <span>No fue posible cargar las capacidades.</span>
            <Boton tamano="sm" onClick={datos.recargarTodo}>Reintentar</Boton>
          </span>
        </Aviso>
      )}

      {datos.avisosSecundarios.length > 0 && (
        <Aviso tono="alerta" className="mb-4">
          <span role="alert" className="flex flex-wrap items-center justify-between gap-2">
            <span>No fue posible cargar: {datos.avisosSecundarios.join('; ')}.</span>
            <Boton tamano="sm" onClick={datos.recargarTodo}>Reintentar</Boton>
          </span>
        </Aviso>
      )}

      {mensaje && (
        <Aviso tono={mensaje.tono === 'exito' ? 'exito' : mensaje.tono === 'alerta' ? 'alerta' : 'error'} className="mb-4">
          <div role={mensaje.tono === 'exito' ? 'status' : 'alert'} className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold">{mensaje.titulo}</p>
              {mensaje.detalles && mensaje.detalles.length > 0 && (
                <ul className="mt-1 list-disc pl-5 text-xs">
                  {mensaje.detalles.map((d) => <li key={d}>{d}</li>)}
                </ul>
              )}
            </div>
            <Boton tamano="sm" variante="fantasma" onClick={() => setMensaje(null)}>Cerrar</Boton>
          </div>
        </Aviso>
      )}

      {datos.cargandoInicial ? (
        <EsqueletoCapacidades />
      ) : !hayPersonas && !datos.errorPrincipal ? (
        <Aviso tono="info">
          No hay personas activas con rol operativo para mostrar capacidades. Crea o activa personas en la pantalla de
          Personas.
        </Aviso>
      ) : hayPersonas && (
        <>
          <KpisCapacidades indicadores={indicadores} esAnioActual={matriz.esAnioActual} cargaDisponible={datos.cargaDisponible} />

          {indicadores.sinRegistrosEnAnio ? (
            <Aviso tono="info" className="mb-4">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span>Aún no hay capacidades para {anio}. Las celdas muestran la base sugerida (*).</span>
                {puedeEditar && (
                  <Boton tamano="sm" onClick={() => setRellenarAbierto(true)}>
                    Rellenar {anio} con la base sugerida
                  </Boton>
                )}
              </span>
            </Aviso>
          ) : (indicadores.porRegistrar > 0 || (datos.cargaDisponible && indicadores.sobrecarga.length > 0)) && (
            <Aviso tono="alerta" className="mb-4">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span role="status">
                  {indicadores.porRegistrar > 0 && indicadores.desdeMes < 12 && (
                    <>
                      <b>{indicadores.porRegistrar}</b> celdas de {MESES_ABREV[indicadores.desdeMes].toLowerCase()}–dic sin
                      registro usan hoy la base sugerida.{' '}
                    </>
                  )}
                  {datos.cargaDisponible && indicadores.sobrecarga.length > 0 && (
                    <>
                      {indicadores.sobrecarga.length} persona(s) en sobrecarga según Asignaciones:{' '}
                      {indicadores.sobrecarga.map((f) => f.persona.nombre.split(' ')[0]).join(', ')}.
                    </>
                  )}
                </span>
                {puedeEditar && indicadores.porRegistrar > 0 && (
                  <Boton tamano="sm" onClick={() => setRellenarAbierto(true)}>Rellenar con la base</Boton>
                )}
              </span>
            </Aviso>
          )}

          <BarraFiltrosCapacidades
            anio={anio}
            onAnio={(a) => { setAnio(a); setEdicion(null) }}
            vista={vista}
            onVista={setVista}
            modo={modo}
            onModo={setModo}
            filtros={filtros}
            onFiltros={cambiarFiltros}
            roles={matriz.roles}
            nAlertas={indicadores.alertas}
          />

          {vista === 'persona' ? (
            <>
              <div className="hidden md:block">
                <MapaCalor
                  filas={filas}
                  meses={meses}
                  totalesMes={matriz.totalesMes}
                  totalAnio={matriz.totalAnio}
                  modo={modo}
                  puedeEditar={puedeEditar}
                  modoConsolidado={modoConsolidado}
                  nombreAplicacion={nombreAplicacion}
                  indiceMesActual={indiceMesActual}
                  edicion={edicion}
                  seleccion={panel && filaPanel ? { personaId: filaPanel.persona.id, mes: meses[panel.indice].mes } : null}
                  alActivarCelda={activarCelda}
                  alGuardarCelda={guardarCelda}
                  alCerrarEdicion={() => setEdicion(null)}
                  alEliminarCelda={eliminarCelda}
                />
              </div>
              <div className="md:hidden">
                <TarjetasMovil
                  filas={filas}
                  modo={modo}
                  editable={puedeEditar}
                  modoConsolidado={modoConsolidado}
                  nombreAplicacion={nombreAplicacion}
                  indiceMesActual={indiceMesActual}
                  onAbrirMes={(fila, indice) => setPanel({ personaId: fila.persona.id, indice })}
                />
              </div>
            </>
          ) : (
            <TablaEquipos equipos={matriz.equipos} basePorMes={basePorMes} modo={modo} indiceMesActual={indiceMesActual} />
          )}

          <LeyendaCapacidades />
        </>
      )}

      {panel && puedeEditar && (
        <PanelCapacidad
          key={`${panel.personaId}|${panel.indice}`}
          fila={filaPanel}
          indice={panel.indice}
          anio={anio}
          personasElegibles={personasEditables}
          filasNavegables={filas.filter((f) => !f.inactiva)}
          horasMesDefault={datos.horasMesDefault}
          mesActual={mesActual}
          escrituras={escrituras}
          onNavegar={(personaId, indice) => setPanel({ personaId, indice })}
          onCerrar={() => setPanel(null)}
          onEliminar={eliminacion.eliminar}
        />
      )}

      {puedeEditar && (
        <>
          <ModalCopiarMes
            abierto={copiarAbierto}
            onCerrar={() => setCopiarAbierto(false)}
            anio={anio}
            filas={personasEditables}
            indiceMesActual={indiceMesActual}
            guardando={escrituras.guardando}
            aplicarLote={escrituras.aplicarLote}
            onResultado={mostrarResultado}
          />
          <ModalRellenarAnio
            abierto={rellenarAbierto}
            onCerrar={() => setRellenarAbierto(false)}
            anio={anio}
            filas={personasEditables}
            basePorMes={basePorMes}
            indiceMesActual={indiceMesActual}
            guardando={escrituras.guardando}
            aplicarLote={escrituras.aplicarLote}
            onResultado={mostrarResultado}
          />
        </>
      )}

      <ToastEliminacion pendientes={eliminacion.pendientes} onDeshacer={eliminacion.deshacer} />
    </div>
  )
}
