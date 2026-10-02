// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useCallback, useEffect, useMemo, useState } from 'react'
import { mensajeError, useLista } from '../api/hooks'
import { useAplicacion } from '../context/AplicacionContext'
import { useAuth } from '../context/AuthContext'
import type { Persona, PlanAccion } from '../types'
import { Aviso, Boton, EncabezadoPagina, Icono } from '../components/ui'
import { BarraFiltrosPlanes } from './planes-accion/BarraFiltrosPlanes'
import { EsqueletoPlanes } from './planes-accion/EsqueletoPlanes'
import { KpisPlanes } from './planes-accion/KpisPlanes'
import { ListaPlanes } from './planes-accion/ListaPlanes'
import { PanelPlan } from './planes-accion/PanelPlan'
import { TableroPlanes } from './planes-accion/TableroPlanes'
import { ToastPlanes } from './planes-accion/ToastPlanes'
import { hoyLocal } from './planes-accion/fechas'
import { FILTROS_INICIALES, FORM_VACIO } from './planes-accion/tipos'
import type { FormPlan, FiltrosPlanes, VistaPlanes } from './planes-accion/tipos'
import { useDerivadosPlanes } from './planes-accion/useDerivadosPlanes'
import { useEscriturasPlanes } from './planes-accion/useEscriturasPlanes'

export default function PlanesAccion() {
  const { datos, error, cargando, recargar } = useLista<PlanAccion>('/planes-accion')
  const { datos: personas, error: errorPersonas } = useLista<Persona>('/personas')
  const { tienePermiso } = useAuth()
  const { modoConsolidado } = useAplicacion()
  const puedeEditar = tienePermiso('planes_accion.editar') && !modoConsolidado

  const [vista, setVista] = useState<VistaPlanes>('lista')
  const [filtros, setFiltros] = useState<FiltrosPlanes>(FILTROS_INICIALES)
  const [form, setForm] = useState<FormPlan | null>(null)
  const [errorAccion, setErrorAccion] = useState('')
  const [hoy] = useState(hoyLocal)

  const alFallar = useCallback((mensaje: string) => setErrorAccion(mensaje), [])
  const escrituras = useEscriturasPlanes({ puedeEditar, recargar, alFallar })

  const visibles = useMemo(
    () => datos.filter((p) => !escrituras.ocultos.has(p.id)),
    [datos, escrituras.ocultos],
  )
  const d = useDerivadosPlanes(visibles, personas, filtros, hoy)

  const planEditando = useMemo(
    () => (form?.id ? datos.find((p) => p.id === form.id) ?? null : null),
    [datos, form?.id],
  )

  function nuevo() {
    if (puedeEditar) setForm({ ...FORM_VACIO })
  }

  function editar(plan: PlanAccion) {
    if (!puedeEditar) return
    setForm({
      id: plan.id,
      titulo: plan.titulo,
      descripcion: plan.descripcion ?? '',
      responsableId: plan.responsable_id ?? '',
      fechaLimite: plan.fecha_limite ?? '',
      estado: plan.estado,
    })
  }

  function cambiarFiltros(cambios: Partial<FiltrosPlanes>) {
    setFiltros((f) => ({ ...f, ...cambios }))
  }

  const hayFiltros = filtros.estado !== '' || filtros.vencimiento !== '' || filtros.responsable !== '' || filtros.busqueda !== ''

  // Atajo "N": nuevo plan (si no se está escribiendo ni hay panel abierto).
  useEffect(() => {
    function alPulsar(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== 'n' || e.ctrlKey || e.metaKey || e.altKey) return
      const destino = e.target as HTMLElement | null
      if (destino && (['INPUT', 'TEXTAREA', 'SELECT'].includes(destino.tagName) || destino.isContentEditable)) return
      if (form || !puedeEditar) return
      e.preventDefault()
      setForm({ ...FORM_VACIO })
    }
    document.addEventListener('keydown', alPulsar)
    return () => document.removeEventListener('keydown', alPulsar)
  }, [form, puedeEditar])

  const sinDatos = !cargando && !error && visibles.length === 0
  const cargaInicial = cargando && datos.length === 0 && !error

  return (
    <div>
      <EncabezadoPagina
        icono={<Icono nombre="portafolio" />}
        titulo="Planes de acción"
        descripcion="Seguimiento de compromisos del equipo"
        acciones={puedeEditar && (
          <Boton variante="primario" onClick={nuevo} title="Atajo: N">
            + Nuevo plan
          </Boton>
        )}
      />

      <div className="mt-4">
        {modoConsolidado && (
          <Aviso tono="info" className="mb-4">
            <span role="status">
              Modo consolidado: solo lectura. Elige una aplicación para crear o editar planes.
            </span>
          </Aviso>
        )}

        {error && (
          <Aviso tono="error" className="mb-4">
            <span role="alert" className="flex flex-wrap items-center justify-between gap-2">
              <span>No fue posible cargar los planes.</span>
              <Boton tamano="sm" onClick={recargar}>Reintentar</Boton>
            </span>
          </Aviso>
        )}

        {errorPersonas && !error && (
          <Aviso tono="alerta" className="mb-4">
            <span role="alert">
              No fue posible cargar las personas: los responsables pueden verse sin nombre.
            </span>
          </Aviso>
        )}

        {errorAccion && (
          <Aviso tono="error" className="mb-4">
            <span role="alert" className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 break-words">{errorAccion}</span>
              <Boton tamano="sm" onClick={() => setErrorAccion('')}>Cerrar</Boton>
            </span>
          </Aviso>
        )}

        {cargaInicial ? (
          <EsqueletoPlanes />
        ) : (
          <>
            {!error && (
              <>
                <KpisPlanes
                  kpis={d.kpis}
                  onVerVencidos={() => cambiarFiltros({ vencimiento: 'vencidos' })}
                />
                <BarraFiltrosPlanes
                  filtros={filtros}
                  alCambiar={cambiarFiltros}
                  vista={vista}
                  alCambiarVista={setVista}
                  contadoresEstado={d.contadoresEstado}
                  total={d.kpis.total}
                  responsables={d.responsablesEnPlanes}
                />
              </>
            )}

            {sinDatos && (
              <div className="tarjeta tarjeta-pad py-10 text-center">
                <p className="mb-3 text-sm text-slate-600">Aún no hay planes de acción en esta aplicación.</p>
                {puedeEditar && <Boton variante="primario" onClick={nuevo}>Crear el primer plan</Boton>}
              </div>
            )}

            {!error && visibles.length > 0 && d.filtrados.length === 0 && (
              <div className="tarjeta tarjeta-pad py-10 text-center">
                <p className="mb-3 text-sm text-slate-600">Ningún plan con estos filtros.</p>
                {hayFiltros && (
                  <Boton onClick={() => setFiltros((f) => ({ ...FILTROS_INICIALES, orden: f.orden }))}>
                    Quitar filtros
                  </Boton>
                )}
              </div>
            )}

            {d.filtrados.length > 0 && (vista === 'lista' ? (
              <ListaPlanes
                filas={d.filtrados}
                personas={d.personasPorId}
                puedeEditar={puedeEditar}
                guardando={escrituras.guardando}
                onEditar={editar}
                onEliminar={escrituras.eliminar}
                onCambiarEstado={(p) => void escrituras.cambiarEstado(p)}
              />
            ) : (
              <TableroPlanes
                filas={d.filtrados}
                personas={d.personasPorId}
                puedeEditar={puedeEditar}
                guardando={escrituras.guardando}
                onEditar={editar}
                onCambiarEstado={(p) => void escrituras.cambiarEstado(p)}
              />
            ))}
          </>
        )}
      </div>

      <PanelPlan
        form={puedeEditar ? form : null}
        plan={planEditando}
        responsablesAsignables={d.responsablesAsignables}
        personasPorId={d.personasPorId}
        hoy={hoy}
        onGuardar={(f) => escrituras.guardar(f).catch((e) => mensajeError(e))}
        onEliminar={escrituras.eliminar}
        onCerrar={() => setForm(null)}
      />
      <ToastPlanes avisos={escrituras.avisos} />
    </div>
  )
}
