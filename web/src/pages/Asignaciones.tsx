import { useCallback, useEffect, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { Aviso } from '../components/ui'
import { useAplicacion } from '../context/AplicacionContext'
import { useAuth } from '../context/AuthContext'
import type { AsignacionItem } from './asignaciones/tipos'
import { BarraFiltrosAsignaciones } from './asignaciones/BarraFiltrosAsignaciones'
import { FormularioAsignacion } from './asignaciones/FormularioAsignacion'
import { VistaPorActas } from './asignaciones/VistaPorActas'
import { VistaPorPersonas } from './asignaciones/VistaPorPersonas'
import { useDatosAsignaciones } from './asignaciones/useDatosAsignaciones'
import { useDerivadosAsignaciones } from './asignaciones/useDerivadosAsignaciones'
import { useEscriturasAsignaciones } from './asignaciones/useEscriturasAsignaciones'
import { useFormularioAsignacion } from './asignaciones/useFormularioAsignacion'
import { useWorkOrdersPorPersona } from './asignaciones/useWorkOrdersPorPersona'

export default function Asignaciones() {
  const { asignaciones, personas, categorias, requerimientos, configuraciones, capacidades, error, recargar } =
    useDatosAsignaciones()
  const { modoConsolidado, activa } = useAplicacion()
  const { tienePermiso } = useAuth()
  const { wosPorPersonaMap } = useWorkOrdersPorPersona(personas)

  const puedeEditarAsignaciones = tienePermiso('asignaciones.editar')

  const [aviso, setAviso] = useState('')
  const [gruposExpandidos, setGruposExpandidos] = useState<Set<string | null>>(new Set())
  const [filtroEstado, setFiltroEstado] = useState<string>('__todos__')
  const [filtroPersona, setFiltroPersona] = useState<string>('__todos__')
  const [busquedaPersona, setBusquedaPersona] = useState('')
  const [vistaActiva, setVistaActiva] = useState<'actas' | 'personas'>('actas')
  const [personasExpandidas, setPersonasExpandidas] = useState<Set<string>>(new Set())

  const {
    personasDisponibles,
    personaPorId,
    categoriaPorId,
    reqIdsActivos,
    opcionesReq,
    etiquetaReq,
    capacidadUsada,
    calcularPctSugerido,
    gruposReq,
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
    filtroEstado,
    filtroPersona,
    busquedaPersona,
  })

  const formulario = useFormularioAsignacion({
    opcionesReq,
    requerimientos,
    etiquetaReq,
    calcularPctSugerido,
    activa,
    modoConsolidado,
    puedeEditar: puedeEditarAsignaciones,
    setAviso,
  })

  // INVARIANTE: `useEscrituras` se llama después de `useFormulario` porque
  // `crear` usa `resolverAppCreacion`, que depende del estado del formulario
  // (requerimiento seleccionado). No reordenar estos dos hooks.
  const escrituras = useEscriturasAsignaciones({
    asignaciones,
    requerimientos,
    reqIdsActivos,
    capacidadUsada,
    activa,
    puedeEditar: puedeEditarAsignaciones,
    setAviso,
    recargar,
    formulario,
    etiquetaReq,
  })

  // INVARIANTE: depende de `gruposReq`, no de `gruposFiltrados` — se
  // reejecuta tras cada `recargar()` (cualquier alta/edición/baja cambia
  // `gruposReq`). Por eso colapsar un grupo se deshace solo al recargar: es
  // comportamiento vigente, no un bug a corregir aquí.
  useEffect(() => {
    setGruposExpandidos(new Set(gruposReq.map((grupo) => grupo.reqId)))
  }, [gruposReq])

  const abrirEdicion = useCallback((asig: AsignacionItem) => {
    escrituras.cancelarEdicionInline()
    formulario.abrirEdicion(asig)
  }, [escrituras, formulario])

  const alternarGrupo = useCallback((reqId: string | null) => {
    setGruposExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(reqId)) next.delete(reqId)
      else next.add(reqId)
      return next
    })
  }, [])

  const onAlternarGrupo = useCallback((event: ReactMouseEvent<HTMLButtonElement>, reqId: string | null) => {
    event.preventDefault()
    alternarGrupo(reqId)
  }, [alternarGrupo])

  const onAlternarPersona = useCallback((personaId: string) => {
    setPersonasExpandidas((prev) => {
      const next = new Set(prev)
      if (next.has(personaId)) next.delete(personaId)
      else next.add(personaId)
      return next
    })
  }, [])

  const mensajeVacioActas = filtroEstado !== '__todos__'
    ? 'No hay asignaciones con ese estado de requerimiento.'
    : 'Sin asignaciones.'

  return (
    <div>
      <h1 className="titulo-pagina mb-4">Asignaciones de carga</h1>

      {puedeEditarAsignaciones && (
        <FormularioAsignacion
          form={formulario}
          onSubmit={formulario.modoEdicion ? escrituras.actualizar : escrituras.crear}
          categorias={categorias}
          personasDisponibles={personasDisponibles}
          puedeEditar={puedeEditarAsignaciones}
        />
      )}

      {modoConsolidado && !formulario.requerimientoId && !formulario.modoEdicion && (
        <Aviso tono="alerta" className="mb-3">
          Modo consolidado: selecciona un requerimiento para crear la asignación en la aplicación correcta.
        </Aviso>
      )}

      {(aviso || error) && (
        <Aviso tono="error" className="mb-3">{aviso || error}</Aviso>
      )}

      <div className="pestanas mb-4">
        <button
          type="button"
          onClick={() => setVistaActiva('actas')}
          className={`pestana ${vistaActiva === 'actas' ? 'pestana-activa' : ''}`}
        >
          Por Actas / Requerimientos
        </button>
        <button
          type="button"
          onClick={() => setVistaActiva('personas')}
          className={`pestana ${vistaActiva === 'personas' ? 'pestana-activa' : ''}`}
        >
          Por Personas
        </button>
      </div>

      <BarraFiltrosAsignaciones
        filtroEstado={filtroEstado}
        setFiltroEstado={setFiltroEstado}
        filtroPersona={filtroPersona}
        setFiltroPersona={setFiltroPersona}
        busquedaPersona={busquedaPersona}
        setBusquedaPersona={setBusquedaPersona}
        estadosUnicos={estadosUnicos}
        personasDisponibles={personasDisponibles}
      />

      {vistaActiva === 'actas' && (
        <VistaPorActas
          gruposFiltrados={gruposFiltrados}
          gruposExpandidos={gruposExpandidos}
          onAlternarGrupo={onAlternarGrupo}
          mensajeVacio={mensajeVacioActas}
          puedeEditarAsignaciones={puedeEditarAsignaciones}
          personaPorId={personaPorId}
          categoriaPorId={categoriaPorId}
          editandoAsigId={formulario.editandoAsig?.id}
          escrituras={escrituras}
          onEditar={abrirEdicion}
        />
      )}

      {vistaActiva === 'personas' && (
        <VistaPorPersonas
          gruposPorPersona={gruposPorPersona}
          personasExpandidas={personasExpandidas}
          onAlternarPersona={onAlternarPersona}
          wosPorPersonaMap={wosPorPersonaMap}
          categoriaPorId={categoriaPorId}
        />
      )}
    </div>
  )
}
