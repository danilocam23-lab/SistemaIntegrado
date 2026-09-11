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
import { Aviso } from '../components/ui'

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

  const { columnasActivas, filtrosActivos, exportCamposActivos, columnasExtra, coreVisibleCount, metricasVisibles, totalColumnasTabla } =
    useCamposRequerimientos(configuracion)

  const {
    filtros, setFiltros, mostrarFiltros, setMostrarFiltros, hayFiltrosActivos, datosFiltrados,
    squadsDisponibles, lideresDisponibles, categoriasDisponibles, tipificacionesDisponibles, tiposCostoDisponibles,
  } = useFiltrosRequerimientos(datos, personas, squadPorId, categoriaPorId)

  const { CAMPO_ACCESOR_REQ } = useAccesoresRequerimiento(squadPorId, categoriaPorId, personaPorId, nombrePersona)
  const { exportarExcel } = useExportarExcel(puedeExportar, exportCamposActivos, datosFiltrados, CAMPO_ACCESOR_REQ)

  const [aviso, setAviso] = useState('')

  const { editValue, setEditValue, iniciarEdicionCelda, guardarCelda, handleKeyDown, isEditing, eliminar } =
    useEscriturasRequerimientos(puedeEditar, puedeEliminar, recargar, setAviso)
  const renderCelda = crearRenderCelda({
    editValue, setEditValue, guardarCelda, handleKeyDown, isEditing, iniciarEdicionCelda, puedeEditar, estadosReq, personas,
  })

  const { estimacionIds, estimacionesMap, expandedReqs, loadingReqEst, refreshEstimacionIds, toggleExpandReq } =
    useEstimaciones(datos)

  const {
    estModalReqId, setEstModalReqId, estData, estLoading, creatingTasks, expandedSections, expandedHUs,
    openEstimationModal, toggleSection, toggleHU, handleCreateTasks, deleteEstimation,
  } = useModalEstimacion(setAviso, refreshEstimacionIds, puedeGestionarEstimaciones)

  const { fileInputRef, handleUploadClick: handleUploadClickCarga, uploadingId, handleFileSelected } =
    useCargaEstimacion(puedeGestionarEstimaciones, setAviso, refreshEstimacionIds, openEstimationModal)

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
        <Aviso tono="error" className="mb-3">{aviso || error}</Aviso>
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
        hayFiltrosActivos={hayFiltrosActivos}
        columnasActivas={columnasActivas}
        columnasExtra={columnasExtra}
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
