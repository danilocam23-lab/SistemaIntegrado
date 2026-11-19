// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCamposRequerimientos } from './requerimientos/useCamposRequerimientos'
import { useDatosRequerimientos } from './requerimientos/useDatosRequerimientos'
import { useFiltrosRequerimientos } from './requerimientos/useFiltrosRequerimientos'
import { PanelFiltrosRequerimientos } from './requerimientos/PanelFiltrosRequerimientos'
import { BarraAccionesRequerimientos } from './requerimientos/BarraAccionesRequerimientos'
import { useAccesoresRequerimiento } from './requerimientos/useAccesoresRequerimiento'
import { useExportarExcel } from './requerimientos/useExportarExcel'
import { useEscriturasRequerimientos } from './requerimientos/useEscriturasRequerimientos'
import { crearRenderCelda } from './requerimientos/CeldaEditable'
import { useEstimaciones } from './requerimientos/useEstimaciones'
import { useModalEstimacion } from './requerimientos/useModalEstimacion'
import { useCargaEstimacion } from './requerimientos/useCargaEstimacion'
import { TablaRequerimientos } from './requerimientos/TablaRequerimientos'
import { ModalEstimacion } from './requerimientos/ModalEstimacion'
import { Aviso, Paginacion } from '../components/ui'
import { usePaginacion, useRegistrosPorPagina } from '../hooks/useRegistrosPorPagina'

export default function Requerimientos() {
  const { tienePermiso } = useAuth()
  const puedeEditar = tienePermiso('requerimientos.editar')
  const puedeEliminar = tienePermiso('requerimientos.eliminar')
  const puedeCrear = tienePermiso('requerimientos.crear')
  const puedeExportar = tienePermiso('requerimientos.exportar')
  const puedeGestionarEstimaciones = tienePermiso('requerimientos.editar')
  const {
    datos, error, recargar,
    estadosReq, estadosEnt,
    personas,
    configuracion,
    squadPorId, personaPorId, categoriaPorId,
    nombrePersona,
  } = useDatosRequerimientos()

  const { columnasActivas, filtrosActivos, exportCamposActivos, columnasExtra, columnasOrdenadas, coreVisibleCount, metricasVisibles, totalColumnasTabla } =
    useCamposRequerimientos(configuracion)

  const {
    filtros, setFiltros, mostrarFiltros, setMostrarFiltros, hayFiltrosActivos, datosFiltrados,
    squadsDisponibles, lideresDisponibles, categoriasDisponibles, tipificacionesDisponibles, tiposCostoDisponibles,
  } = useFiltrosRequerimientos(datos, personas, squadPorId, categoriaPorId)

  // Paginación: último paso, después de filtrar. Totales y exportación usan `datosFiltrados`.
  const registrosPorPagina = useRegistrosPorPagina()
  const { filasPagina: datosPagina, rango: rangoPagina, cambiarPagina } =
    usePaginacion(datosFiltrados, registrosPorPagina, JSON.stringify(filtros))

  const { CAMPO_ACCESOR_REQ } =useAccesoresRequerimiento(squadPorId, categoriaPorId, personaPorId, nombrePersona)
  const { exportarExcel } = useExportarExcel(puedeExportar, exportCamposActivos, datosFiltrados, CAMPO_ACCESOR_REQ)

  const [aviso, setAvisoMensaje] = useState('')
  const [avisoTono, setAvisoTono] = useState<'error' | 'exito'>('error')
  function setAviso(mensaje: string, tono: 'error' | 'exito' = 'error') {
    setAvisoMensaje(mensaje)
    setAvisoTono(tono)
  }

  const { editValue, setEditValue, iniciarEdicionCelda, guardarCelda, handleKeyDown, isEditing, eliminar } =
    useEscriturasRequerimientos(puedeEditar, puedeEliminar, recargar, setAviso)
  const renderCelda = crearRenderCelda({
    editValue, setEditValue, guardarCelda, handleKeyDown, isEditing, iniciarEdicionCelda, puedeEditar, estadosReq, personas,
  })

  const { estimacionIds, estimacionesMap, expandedReqs, loadingReqEst, refreshEstimacionIds, toggleExpandReq, invalidarEstimacion } =
    useEstimaciones(datos)

  const {
    estModalReqId, setEstModalReqId, estData, estLoading, creatingTasks, expandedSections, expandedHUs,
    openEstimationModal, toggleSection, toggleHU, handleCreateTasks, deleteEstimation,
  } = useModalEstimacion(setAviso, refreshEstimacionIds, puedeGestionarEstimaciones, invalidarEstimacion)

  const { fileInputRef, handleUploadClick: handleUploadClickCarga, uploadingId, handleFileSelected } =
    useCargaEstimacion(puedeGestionarEstimaciones, setAviso, refreshEstimacionIds, openEstimationModal, invalidarEstimacion)

  const [expandedEntregas, setExpandedEntregas] = useState<Set<string>>(new Set())

  const reqSeleccionado = estModalReqId ? datos.find((req) => req.id === estModalReqId) ?? null : null

  return (
    <div>
      <BarraAccionesRequerimientos
        puedeCrear={puedeCrear}
        puedeExportar={puedeExportar}
        mostrarFiltros={mostrarFiltros}
        setMostrarFiltros={setMostrarFiltros}
        hayFiltrosActivos={hayFiltrosActivos}
        exportarDeshabilitado={datosFiltrados.length === 0}
        onExportar={exportarExcel}
      />

      {(aviso || error) && (
        <Aviso tono={error ? 'error' : avisoTono} className="mb-3">{aviso || error}</Aviso>
      )}

      {/* Panel de filtros */}
      {mostrarFiltros && (
        <PanelFiltrosRequerimientos
          filtros={filtros}
          setFiltros={setFiltros}
          hayFiltrosActivos={hayFiltrosActivos}
          filtrosActivos={filtrosActivos}
          estadosReq={estadosReq}
          estadosEnt={estadosEnt}
          squadsDisponibles={squadsDisponibles}
          lideresDisponibles={lideresDisponibles}
          categoriasDisponibles={categoriasDisponibles}
          tipificacionesDisponibles={tipificacionesDisponibles}
          tiposCostoDisponibles={tiposCostoDisponibles}
        />
      )}

      <TablaRequerimientos
        datosFiltrados={datosFiltrados}
        datosPagina={datosPagina}
        hayFiltrosActivos={hayFiltrosActivos}
        columnasActivas={columnasActivas}
        columnasExtra={columnasExtra}
        columnasOrdenadas={columnasOrdenadas}
        coreVisibleCount={coreVisibleCount}
        metricasVisibles={metricasVisibles}
        totalColumnasTabla={totalColumnasTabla}
        expandedReqs={expandedReqs}
        estimacionIds={estimacionIds}
        estimacionesMap={estimacionesMap}
        loadingReqEst={loadingReqEst}
        toggleExpandReq={toggleExpandReq}
        expandedEntregas={expandedEntregas}
        setExpandedEntregas={setExpandedEntregas}
        renderCelda={renderCelda}
        squadPorId={squadPorId}
        nombrePersona={nombrePersona}
        CAMPO_ACCESOR_REQ={CAMPO_ACCESOR_REQ}
        uploadingId={uploadingId}
        puedeGestionarEstimaciones={puedeGestionarEstimaciones}
        handleUploadClick={handleUploadClickCarga}
        openEstimationModal={openEstimationModal}
        puedeEditar={puedeEditar}
        puedeEliminar={puedeEliminar}
        eliminar={eliminar}
      />

      <Paginacion
        rango={rangoPagina}
        onCambiarPagina={cambiarPagina}
        etiqueta="requerimientos"
        ids={{
          primera: 'requerimiento.pagina_primera',
          anterior: 'requerimiento.pagina_anterior',
          siguiente: 'requerimiento.pagina_siguiente',
          ultima: 'requerimiento.pagina_ultima',
        }}
      />

      {estModalReqId && (
        <ModalEstimacion
          estModalReqId={estModalReqId}
          reqSeleccionado={reqSeleccionado}
          estData={estData}
          estLoading={estLoading}
          creatingTasks={creatingTasks}
          expandedSections={expandedSections}
          expandedHUs={expandedHUs}
          puedeGestionarEstimaciones={puedeGestionarEstimaciones}
          onClose={() => setEstModalReqId(null)}
          onCreateTasks={(org) => { void handleCreateTasks(org) }}
          onReemplazar={() => handleUploadClickCarga(estModalReqId)}
          onEliminar={() => { void deleteEstimation() }}
          onToggleSection={toggleSection}
          onToggleHU={toggleHU}
        />
      )}

      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { void handleFileSelected(e) }} />
    </div>
  )
}
