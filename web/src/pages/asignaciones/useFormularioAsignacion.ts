import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Requerimiento } from '../../types'
import type { AsignacionItem, OpcionReq } from './tipos'

interface ParametrosFormulario {
  opcionesReq: OpcionReq[]
  requerimientos: Requerimiento[]
  etiquetaReq: (reqId: string | null) => string
  calcularPctSugerido: (pid: string) => string
  activa: string
  modoConsolidado: boolean
  puedeEditar: boolean
  setAviso: (mensaje: string) => void
}

/**
 * Estado y lógica del formulario de "Nueva/Editar asignación": campos
 * controlados, combobox de requerimiento (búsqueda + cierre al hacer clic fuera),
 * % sugerido y los handlers de selección/limpieza/edición. No renderiza JSX.
 */
export function useFormularioAsignacion({
  opcionesReq,
  requerimientos,
  etiquetaReq,
  calcularPctSugerido,
  activa,
  modoConsolidado,
  puedeEditar,
  setAviso,
}: ParametrosFormulario) {
  const [editandoAsig, setEditandoAsig] = useState<AsignacionItem | null>(null)
  const [personaId, setPersonaId] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [porcentaje, setPorcentaje] = useState('')
  const [requerimientoId, setRequerimientoId] = useState('')
  const [busquedaReq, setBusquedaReq] = useState('')
  const [dropdownReqAbierto, setDropdownReqAbierto] = useState(false)
  const reqBoxRef = useRef<HTMLDivElement | null>(null)
  const modoEdicion = editandoAsig !== null

  useEffect(() => {
    function cerrarDropdown(event: MouseEvent) {
      if (reqBoxRef.current && !reqBoxRef.current.contains(event.target as Node)) {
        setDropdownReqAbierto(false)
      }
    }

    document.addEventListener('mousedown', cerrarDropdown)
    return () => document.removeEventListener('mousedown', cerrarDropdown)
  }, [])

  const opcionReqSeleccionada = useMemo(
    () => opcionesReq.find((opcion) => opcion.id === requerimientoId) ?? null,
    [opcionesReq, requerimientoId],
  )

  const opcionesReqFiltradas = useMemo(() => {
    const filtro = busquedaReq.trim().toLocaleLowerCase('es')
    const lista = filtro
      ? opcionesReq.filter((opcion) => opcion.label.toLocaleLowerCase('es').includes(filtro))
      : opcionesReq
    return lista.slice(0, 15)
  }, [busquedaReq, opcionesReq])

  const porcentajeSugerido = useMemo(
    () => (!modoEdicion && personaId ? calcularPctSugerido(personaId) : ''),
    [calcularPctSugerido, modoEdicion, personaId],
  )

  const limpiarFormulario = useCallback(() => {
    setEditandoAsig(null)
    setPersonaId('')
    setCategoriaId('')
    setPorcentaje('')
    setRequerimientoId('')
    setBusquedaReq('')
    setDropdownReqAbierto(false)
    setAviso('')
  }, [setAviso])

  const resolverAppCreacion = useCallback(() => {
    if (opcionReqSeleccionada?.aplicacionId) return opcionReqSeleccionada.aplicacionId
    if (modoConsolidado) return ''
    return activa
  }, [activa, modoConsolidado, opcionReqSeleccionada])

  const abrirEdicion = useCallback((asig: AsignacionItem) => {
    if (!puedeEditar) return
    const primerReq = asig.proyectos.find((p) => p.requerimiento_id)?.requerimiento_id ?? ''
    setEditandoAsig(asig)
    setPersonaId(asig.persona_id)
    setCategoriaId(asig.categoria_id)
    setPorcentaje(String(asig.total_porcentaje))
    setRequerimientoId(primerReq)
    setBusquedaReq(primerReq ? etiquetaReq(primerReq) : '')
    setDropdownReqAbierto(false)
    setAviso('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [etiquetaReq, puedeEditar])

  const seleccionarReq = useCallback((opcion: OpcionReq) => {
    setRequerimientoId(opcion.id)
    setBusquedaReq(opcion.label)
    setDropdownReqAbierto(false)
    // Si el requerimiento tiene un analista de requerimientos configurado y aún no se
    // eligió una persona, se preselecciona ese analista con 0% de carga, para dejarlo
    // asignado de una vez mientras luego se le define la capacidad/porcentaje real.
    if (!modoEdicion && !personaId) {
      const req = requerimientos.find((r) => r.id === opcion.id)
      const analistaId = req?.solicitud?.analista_requerimientos_id
      if (analistaId) {
        setPersonaId(analistaId)
        setPorcentaje('0')
      }
    }
  }, [modoEdicion, personaId, requerimientos])

  const cambiarBusquedaReq = useCallback((value: string) => {
    setBusquedaReq(value)
    setDropdownReqAbierto(true)
    if (!value.trim()) setRequerimientoId('')
    else if (opcionReqSeleccionada?.label !== value) setRequerimientoId('')
  }, [opcionReqSeleccionada])

  const limpiarRequerimiento = useCallback(() => {
    setBusquedaReq('')
    setRequerimientoId('')
    setDropdownReqAbierto(false)
  }, [])

  const onPersonaChange = useCallback((value: string) => {
    setPersonaId(value)
    if (!modoEdicion) setPorcentaje(value ? calcularPctSugerido(value) : '')
  }, [calcularPctSugerido, modoEdicion])

  return {
    editandoAsig,
    personaId,
    categoriaId,
    setCategoriaId,
    porcentaje,
    setPorcentaje,
    requerimientoId,
    busquedaReq,
    dropdownReqAbierto,
    setDropdownReqAbierto,
    reqBoxRef,
    modoEdicion,
    porcentajeSugerido,
    opcionReqSeleccionada,
    opcionesReqFiltradas,
    onPersonaChange,
    seleccionarReq,
    cambiarBusquedaReq,
    limpiarRequerimiento,
    limpiarFormulario,
    abrirEdicion,
    resolverAppCreacion,
  }
}
