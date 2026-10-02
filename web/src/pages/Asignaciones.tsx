// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Aviso, Boton } from '../components/ui'
import { useAplicacion } from '../context/AplicacionContext'
import { useAuth } from '../context/AuthContext'
import { AvisoSobrecarga } from './asignaciones/AvisoSobrecarga'
import { BarraFiltrosAsignaciones } from './asignaciones/BarraFiltrosAsignaciones'
import { EsqueletoAsignaciones } from './asignaciones/EsqueletoAsignaciones'
import { FranjaSinAsignar } from './asignaciones/FranjaSinAsignar'
import { KpisAsignaciones } from './asignaciones/KpisAsignaciones'
import { MapaCarga } from './asignaciones/MapaCarga'
import { ModalRedistribuir } from './asignaciones/ModalRedistribuir'
import { PanelAsignar } from './asignaciones/PanelAsignar'
import { ToastDeshacer } from './asignaciones/ToastDeshacer'
import { VistaPorActas } from './asignaciones/VistaPorActas'
import { VistaPorPersonas } from './asignaciones/VistaPorPersonas'
import { reqIdDeAsignacion } from './asignaciones/resolverApp'
import type { AsignacionItem } from './asignaciones/tipos'
import { useBacklogFuturoPorPersona } from './asignaciones/useBacklogFuturoPorPersona'
import { useDatosAsignaciones } from './asignaciones/useDatosAsignaciones'
import { useDerivadosAsignaciones } from './asignaciones/useDerivadosAsignaciones'
import { useEliminacionDiferida } from './asignaciones/useEliminacionDiferida'
import { useEscriturasAsignaciones } from './asignaciones/useEscriturasAsignaciones'
import { useFiltrosAsignaciones } from './asignaciones/useFiltrosAsignaciones'
import { useHorasAzurePorFeature } from './asignaciones/useHorasAzurePorFeature'
import { usePanelAsignar } from './asignaciones/usePanelAsignar'
import { useWorkOrdersPorPersona } from './asignaciones/useWorkOrdersPorPersona'

function alternarEn<T>(conjunto: Set<T>, valor: T): Set<T> {
  const siguiente = new Set(conjunto)
  if (siguiente.has(valor)) siguiente.delete(valor)
  else siguiente.add(valor)
  return siguiente
}

export default function Asignaciones() {
  const {
    asignaciones: asignacionesServidor,
    personas,
    categorias,
    requerimientos,
    configuraciones,
    backlogFuturo,
    capacidades,
    requerimientoPorId,
    cargandoInicial,
    errorPrincipal,
    erroresSecundarios,
    recargar,
    recargarTodo,
  } = useDatosAsignaciones()
  const { modoConsolidado, activa } = useAplicacion()
  const { tienePermiso } = useAuth()
  const { wosPorPersonaMap, errorWo, reintentarWo } = useWorkOrdersPorPersona(personas)
  const { backlogPorPersonaMap } = useBacklogFuturoPorPersona(backlogFuturo)
  const { horasAzurePorFeature, errorAzure, reintentarAzure } = useHorasAzurePorFeature(requerimientos)
  const { filtros, actualizar, limpiar, hayFiltros, nFiltros } = useFiltrosAsignaciones()

  const puedeEditarAsignaciones = tienePermiso('asignaciones.editar')

  // Errores por fila/asignación: se muestran en la propia fila (o en el panel), no arriba de la página.
  const [erroresFila, setErroresFila] = useState<Record<string, string>>({})
  const registrarErrorFila = useCallback((asigId: string, mensaje: string) => {
    setErroresFila((previo) => {
      if (!mensaje) {
        if (!(asigId in previo)) return previo
        const { [asigId]: _quitado, ...resto } = previo
        return resto
      }
      return { ...previo, [asigId]: mensaje }
    })
  }, [])
  const cerrarErrorFila = useCallback((asigId: string) => registrarErrorFila(asigId, ''), [registrarErrorFila])

  const eliminacion = useEliminacionDiferida({
    requerimientoPorId,
    activa,
    puedeEditar: puedeEditarAsignaciones,
    recargar,
    registrarErrorFila,
  })

  // Las asignaciones pendientes de eliminar (con "Deshacer") se ocultan al instante.
  const asignaciones = useMemo(() => {
    if (eliminacion.pendientes.length === 0) return asignacionesServidor
    const ocultas = new Set(eliminacion.pendientes.map((p) => p.asig.id))
    return asignacionesServidor.filter((a) => !ocultas.has(a.id))
  }, [asignacionesServidor, eliminacion.pendientes])

  // Estado de expansión estable: por defecto todo abierto en Actas y todo cerrado en Personas;
  // solo cambia cuando el usuario lo cambia (recargar tras guardar no lo reinicia).
  const [gruposColapsados, setGruposColapsados] = useState<Set<string | null>>(new Set())
  const [personasExpandidas, setPersonasExpandidas] = useState<Set<string>>(new Set())
  const [personaRepartir, setPersonaRepartir] = useState<string | null>(null)

  const {
    personasDisponibles,
    personaPorId,
    personaPorEmail,
    categoriaPorId,
    reqIdsActivos,
    opcionesReq,
    etiquetaReq,
    capacidadUsada,
    contarActivas,
    cargaDe,
    asignacionExistente,
    planReparto,
    personasSobrecarga,
    reqsSinAsignar,
    resumen,
    estadosUnicos,
    gruposFiltrados,
    gruposPorPersona,
  } = useDerivadosAsignaciones({
    asignaciones,
    personas,
    categorias,
    requerimientos,
    configuraciones,
    capacidades,
    wosPorPersonaMap,
    backlogPorPersonaMap,
    horasAzurePorFeature,
    filtroEstado: filtros.estado,
    filtroPersona: filtros.persona,
    busquedaReq: filtros.requerimiento,
    mostrar: filtros.mostrar,
    orden: filtros.orden,
  })

  const escrituras = useEscriturasAsignaciones({
    requerimientoPorId,
    capacidadUsada,
    asignacionExistente,
    activa,
    puedeEditar: puedeEditarAsignaciones,
    recargar,
    registrarErrorFila,
  })

  const panel = usePanelAsignar({
    asignaciones,
    opcionesReq,
    requerimientoPorId,
    personasDisponibles,
    puedeEditar: puedeEditarAsignaciones,
    capacidadUsada,
  })

  const { cancelarEdicionInline } = escrituras
  const { abrirCrear, abrirEditar, cerrar: cerrarPanel, abierto: panelAbierto, asigEditando } = panel

  const abrirAsignar = useCallback((opciones: { requerimientoId?: string; personaId?: string } = {}) => {
    cancelarEdicionInline()
    abrirCrear(opciones)
  }, [abrirCrear, cancelarEdicionInline])

  const abrirEdicion = useCallback((asig: AsignacionItem) => {
    cancelarEdicionInline()
    abrirEditar(asig)
  }, [abrirEditar, cancelarEdicionInline])

  const asignarDesdeGrupo = useCallback(
    (reqId: string | null) => abrirAsignar({ requerimientoId: reqId ?? undefined }),
    [abrirAsignar],
  )
  const asignarDesdeSintetica = useCallback(
    (personaId: string, reqId: string | null) => abrirAsignar({ personaId, requerimientoId: reqId ?? undefined }),
    [abrirAsignar],
  )
  const asignarAPersona = useCallback((personaId: string) => abrirAsignar({ personaId }), [abrirAsignar])
  const asignarAReq = useCallback((requerimientoId: string) => abrirAsignar({ requerimientoId }), [abrirAsignar])

  const eliminar = useCallback((asig: AsignacionItem) => {
    if (asigEditando?.id === asig.id) cerrarPanel()
    cancelarEdicionInline()
    const nombre = personaPorId.get(asig.persona_id)?.nombre ?? asig.persona_id
    const reqId = reqIdDeAsignacion(asig)
    eliminacion.eliminar(asig, `${nombre} en ${reqId ? etiquetaReq(reqId) : 'Sin requerimiento'}`)
  }, [asigEditando?.id, cancelarEdicionInline, cerrarPanel, eliminacion, etiquetaReq, personaPorId])

  // Atajo de teclado: N abre "Nueva asignación" (si no se está escribiendo en un campo).
  useEffect(() => {
    if (!puedeEditarAsignaciones) return
    function alPulsarTecla(evento: KeyboardEvent) {
      if (evento.key.toLowerCase() !== 'n' || evento.ctrlKey || evento.metaKey || evento.altKey) return
      if (panelAbierto || personaRepartir) return
      const destino = evento.target as HTMLElement | null
      if (destino && (destino.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(destino.tagName))) return
      evento.preventDefault()
      abrirAsignar()
    }
    document.addEventListener('keydown', alPulsarTecla)
    return () => document.removeEventListener('keydown', alPulsarTecla)
  }, [abrirAsignar, panelAbierto, personaRepartir, puedeEditarAsignaciones])

  const alternarGrupo = useCallback((reqId: string | null) => {
    setGruposColapsados((previo) => alternarEn(previo, reqId))
  }, [])

  const alternarPersona = useCallback((personaId: string) => {
    setPersonasExpandidas((previo) => alternarEn(previo, personaId))
  }, [])

  const irAPersona = useCallback((personaId: string) => {
    // Se quitan los filtros que podrían ocultar la tarjeta y se salta a ella.
    actualizar({ vista: 'personas', persona: '__todos__', requerimiento: '', estado: '__todos__', mostrar: 'todo' })
    setPersonasExpandidas((previo) => new Set(previo).add(personaId))
    window.setTimeout(() => {
      document.getElementById(`persona-${personaId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 60)
  }, [actualizar])

  const verAsignacionesDe = useCallback((personaId: string) => {
    actualizar({ vista: 'personas', persona: personaId, requerimiento: '', estado: '__todos__', mostrar: 'todo' })
    setPersonasExpandidas((previo) => new Set(previo).add(personaId))
  }, [actualizar])

  const reintentarTodo = useCallback(() => {
    recargarTodo()
    reintentarAzure()
    reintentarWo()
  }, [recargarTodo, reintentarAzure, reintentarWo])

  const avisosFuentes = useMemo(() => {
    const lista = [...erroresSecundarios]
    if (errorAzure) lista.push('horas de Azure DevOps (no se muestran horas de Azure)')
    if (errorWo) lista.push('solicitudes de soporte WO (no se muestran WO)')
    return lista
  }, [erroresSecundarios, errorAzure, errorWo])

  const personaEnReparto = personaRepartir ? personaPorId.get(personaRepartir) ?? null : null
  const filasReparto = personaRepartir ? planReparto(personaRepartir) : []

  const sinAsignaciones = asignaciones.length === 0
  const botonLimpiar = (
    <Boton variante="secundario" tamano="sm" onClick={limpiar}>Limpiar filtros</Boton>
  )
  const botonCrearPrimera = puedeEditarAsignaciones && (
    <Boton variante="primario" onClick={() => abrirAsignar()}>+ Crear la primera asignación</Boton>
  )

  const vacioActas = errorPrincipal ? 'No hay datos para mostrar.' : hayFiltros ? (
    <div className="grid justify-items-center gap-3">
      <span>
        {filtros.estado !== '__todos__' && filtros.persona === '__todos__' && filtros.mostrar === 'todo' && !filtros.requerimiento.trim()
          ? 'No hay asignaciones con ese estado de requerimiento.'
          : 'No hay asignaciones que coincidan con los filtros.'}
      </span>
      {botonLimpiar}
    </div>
  ) : sinAsignaciones ? (
    <div className="grid justify-items-center gap-3">
      <span>Aún no hay asignaciones en este squad.</span>
      {botonCrearPrimera}
    </div>
  ) : 'Sin asignaciones.'

  const vacioPersonas = errorPrincipal ? 'No hay datos para mostrar.' : hayFiltros ? (
    <div className="grid justify-items-center gap-3">
      <span>Ninguna persona coincide con los filtros.</span>
      {botonLimpiar}
    </div>
  ) : sinAsignaciones ? (
    <div className="grid justify-items-center gap-3">
      <span>Aún no hay asignaciones en este squad.</span>
      {botonCrearPrimera}
    </div>
  ) : 'Sin asignaciones para mostrar.'

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="titulo-pagina">Asignaciones de carga</h1>
          <p className="subtitulo-pagina">
            Quién trabaja en qué, y cuánto de su capacidad ocupa · mes en curso
          </p>
        </div>
        {puedeEditarAsignaciones && (
          <Boton variante="primario" onClick={() => abrirAsignar()} title="Atajo: N">
            + Nueva asignación
          </Boton>
        )}
      </div>

      {errorPrincipal && (
        <Aviso tono="error" className="mb-4">
          <span role="alert" className="flex flex-wrap items-center justify-between gap-2">
            <span>No fue posible cargar las asignaciones.</span>
            <Boton tamano="sm" variante="secundario" onClick={reintentarTodo}>Reintentar</Boton>
          </span>
        </Aviso>
      )}

      {avisosFuentes.length > 0 && (
        <Aviso tono="alerta" className="mb-4">
          <span role="alert" className="flex flex-wrap items-center justify-between gap-2">
            <span>No fue posible cargar: {avisosFuentes.join('; ')}. Las cifras que dependen de esos datos pueden estar incompletas.</span>
            <Boton tamano="sm" variante="secundario" onClick={reintentarTodo}>Reintentar</Boton>
          </span>
        </Aviso>
      )}

      {cargandoInicial ? (
        <EsqueletoAsignaciones />
      ) : (
        <>
          <KpisAsignaciones
            totalPersonas={resumen.totalPersonas}
            conCarga={resumen.conCarga}
            media={resumen.media}
            capacidadBaseMedia={resumen.capacidadBaseMedia}
            sobrecarga={personasSobrecarga}
            conHolgura={resumen.conHolgura}
            reqsSinAsignar={reqsSinAsignar.length}
            azureSinPersonaHoras={resumen.azureSinPersonaHoras}
            azureSinPersonaReqs={resumen.azureSinPersonaReqs}
            azureNoDisponible={errorAzure !== ''}
          />

          <AvisoSobrecarga
            filas={personasSobrecarga}
            puedeEditar={puedeEditarAsignaciones}
            onVerAsignaciones={verAsignacionesDe}
            onRevisarReparto={setPersonaRepartir}
          />

          <FranjaSinAsignar
            requerimientos={reqsSinAsignar}
            puedeEditar={puedeEditarAsignaciones}
            onAsignar={asignarAReq}
          />

          <div className="pestanas mb-4" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={filtros.vista === 'actas'}
              onClick={() => actualizar({ vista: 'actas' })}
              className={`pestana ${filtros.vista === 'actas' ? 'pestana-activa' : ''}`}
            >
              Por Actas / Requerimientos
              <span className="text-xs font-medium opacity-70">({gruposFiltrados.length})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filtros.vista === 'personas'}
              onClick={() => actualizar({ vista: 'personas' })}
              className={`pestana ${filtros.vista === 'personas' ? 'pestana-activa' : ''}`}
            >
              Por Personas
              <span className="text-xs font-medium opacity-70">({gruposPorPersona.length})</span>
            </button>
          </div>

          <BarraFiltrosAsignaciones
            filtros={filtros}
            onCambio={actualizar}
            onLimpiar={limpiar}
            hayFiltros={hayFiltros}
            nFiltros={nFiltros}
            estadosUnicos={estadosUnicos}
            personasDisponibles={personasDisponibles}
          />

          {filtros.vista === 'actas' && (
            <>
              <MapaCarga
                filas={resumen.mapa}
                orden={filtros.orden}
                onOrden={(orden) => actualizar({ orden })}
                onIrAPersona={irAPersona}
              />
              <VistaPorActas
                gruposFiltrados={gruposFiltrados}
                gruposColapsados={gruposColapsados}
                onAlternarGrupo={alternarGrupo}
                vacio={vacioActas}
                puedeEditarAsignaciones={puedeEditarAsignaciones}
                personaPorId={personaPorId}
                personaPorEmail={personaPorEmail}
                categoriaPorId={categoriaPorId}
                editandoAsigId={panel.asigEditando?.id}
                cargaDe={cargaDe}
                escrituras={escrituras}
                erroresFila={erroresFila}
                onCerrarError={cerrarErrorFila}
                onEditar={abrirEdicion}
                onEliminar={eliminar}
                onAsignar={asignarDesdeGrupo}
                onAsignarSintetica={asignarDesdeSintetica}
              />
            </>
          )}

          {filtros.vista === 'personas' && (
            <VistaPorPersonas
              gruposPorPersona={gruposPorPersona}
              personasExpandidas={personasExpandidas}
              onAlternarPersona={alternarPersona}
              wosPorPersonaMap={wosPorPersonaMap}
              backlogPorPersonaMap={backlogPorPersonaMap}
              categoriaPorId={categoriaPorId}
              cargaDe={cargaDe}
              puedeEditarAsignaciones={puedeEditarAsignaciones}
              escrituras={escrituras}
              erroresFila={erroresFila}
              onCerrarError={cerrarErrorFila}
              onEditar={abrirEdicion}
              onEliminar={eliminar}
              onAsignar={asignarAPersona}
              onRepartir={setPersonaRepartir}
              vacio={vacioPersonas}
            />
          )}
        </>
      )}

      {puedeEditarAsignaciones && (
        <PanelAsignar
          panel={panel}
          crear={escrituras.crear}
          actualizar={escrituras.actualizar}
          categorias={categorias}
          personasDisponibles={personasDisponibles}
          personaPorId={personaPorId}
          opcionesReq={opcionesReq}
          reqIdsActivos={reqIdsActivos}
          cargaDe={cargaDe}
          capacidadUsada={capacidadUsada}
          contarActivas={contarActivas}
          asignacionExistente={asignacionExistente}
          etiquetaReq={etiquetaReq}
          modoConsolidado={modoConsolidado}
          activa={activa}
        />
      )}

      {puedeEditarAsignaciones && (
        <ModalRedistribuir
          key={personaRepartir ?? 'sin-persona'}
          persona={personaEnReparto}
          filas={filasReparto}
          onAplicar={escrituras.aplicarReparto}
          onCerrar={() => setPersonaRepartir(null)}
        />
      )}

      <ToastDeshacer
        pendientes={eliminacion.pendientes}
        onDeshacer={eliminacion.deshacer}
        onRepartir={setPersonaRepartir}
        puedeRepartir={(personaId) => cargaDe(personaId).nActivas > 0}
        puedeEditar={puedeEditarAsignaciones}
      />
    </div>
  )
}
