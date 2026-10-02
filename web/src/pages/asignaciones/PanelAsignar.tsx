// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useId, useMemo } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Aviso, Boton, Campo, Chip, Selector } from '../../components/ui'
import type { Categoria, Persona } from '../../types'
import { ETIQUETA_NIVEL, formatearPct, nivelCarga, TONO_CHIP_NIVEL } from './carga'
import type { CargaPersona } from './carga'
import { Combobox } from './Combobox'
import { MedidorCarga } from './MedidorCarga'
import { PanelLateral } from './PanelLateral'
import type { AsignacionItem, OpcionReq } from './tipos'
import type { DatosAsignacion } from './useEscriturasAsignaciones'
import type { PanelAsignarEstado } from './usePanelAsignar'

const ATAJOS_PCT = [10, 20, 25, 50]

interface Props {
  panel: PanelAsignarEstado
  crear: (datos: DatosAsignacion) => Promise<string | null>
  actualizar: (asig: AsignacionItem, datos: DatosAsignacion) => Promise<string | null>
  categorias: Categoria[]
  personasDisponibles: Persona[]
  personaPorId: Map<string, Persona>
  opcionesReq: OpcionReq[]
  reqIdsActivos: Set<string>
  cargaDe: (personaId: string) => CargaPersona
  capacidadUsada: (personaId: string, excluyendoId?: string) => number
  contarActivas: (personaId: string, excluyendoId?: string) => number
  asignacionExistente: (personaId: string, reqId: string, excluyendoId?: string) => AsignacionItem | null
  etiquetaReq: (reqId: string | null) => string
  modoConsolidado: boolean
  activa: string
}

/**
 * Panel lateral "Asignar": reemplaza al formulario fijo. Sirve para crear y para
 * editar (mismos campos y mismas validaciones), muestra la capacidad de la
 * persona antes y después de guardar, propone "Resto" como %, y resuelve el
 * conflicto del 100% o el duplicado con un clic. Los errores del servidor
 * (422/404/409) se muestran aquí, no arriba de la página.
 */
export function PanelAsignar({
  panel,
  crear,
  actualizar,
  categorias,
  personasDisponibles,
  personaPorId,
  opcionesReq,
  reqIdsActivos,
  cargaDe,
  capacidadUsada,
  contarActivas,
  asignacionExistente,
  etiquetaReq,
  modoConsolidado,
  activa,
}: Props) {
  const idFormulario = useId()
  const { modoEdicion, asigEditando, personaId, requerimientoId } = panel
  const editId = asigEditando?.id

  const personasOpciones = useMemo(() => {
    const lista = [...personasDisponibles]
    // En edición, si la persona ya no figura entre las disponibles (desactivada o cambió de rol)
    // se conserva para poder ver y guardar la asignación sin cambiarle la persona sin querer.
    if (asigEditando && !lista.some((p) => p.id === asigEditando.persona_id)) {
      const actual = personaPorId.get(asigEditando.persona_id)
      if (actual) lista.push(actual)
    }
    return lista
  }, [asigEditando, personaPorId, personasDisponibles])

  const categoriasOrdenadas = useMemo(
    () => categorias.slice().sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es')),
    [categorias],
  )

  const opcionesCombobox = useMemo(
    () => opcionesReq.map((o) => ({ id: o.id, etiqueta: o.label, detalle: o.estado ? (o.estado.length > 18 ? `${o.estado.slice(0, 18)}…` : o.estado) : undefined })),
    [opcionesReq],
  )

  const persona = personaPorId.get(personaId)
  const pct = panel.porcentaje === '' ? Number.NaN : Number(panel.porcentaje)
  const pctValido = Number.isFinite(pct) && pct >= 0 && pct <= 100

  // ─── Capacidad antes / después ───
  const vista = useMemo(() => {
    if (!personaId) return null
    const carga = cargaDe(personaId)
    let activaAhora = carga.activa
    let sinReqAhora = carga.sinReq
    // En edición, "ahora" excluye la asignación que se está editando (se vuelve a sumar con el % nuevo).
    if (asigEditando && asigEditando.persona_id === personaId) {
      const tieneReq = asigEditando.proyectos.some((p) => p.requerimiento_id)
      const esActiva = asigEditando.proyectos.some((p) => p.requerimiento_id && reqIdsActivos.has(p.requerimiento_id))
      if (esActiva) activaAhora -= asigEditando.total_porcentaje
      else if (!tieneReq) sinReqAhora -= asigEditando.total_porcentaje
    }
    const nuevo = pctValido ? pct : 0
    const nuevaEsActiva = requerimientoId ? reqIdsActivos.has(requerimientoId) : false
    const nuevaSinReq = !requerimientoId
    const activaDespues = activaAhora + (nuevaEsActiva ? nuevo : 0)
    const sinReqDespues = sinReqAhora + (nuevaSinReq ? nuevo : 0)
    const usadoActivo = capacidadUsada(personaId, editId)
    return {
      carga,
      ahora: activaAhora + sinReqAhora,
      activaAhora,
      sinReqAhora,
      despues: activaDespues + sinReqDespues,
      activaDespues,
      sinReqDespues,
      usadoActivo,
      resto: Math.max(0, 100 - usadoActivo),
      horasNuevo: carga.capacidadHoras * (nuevo / 100),
      nIgual: contarActivas(personaId, editId),
    }
  }, [asigEditando, capacidadUsada, cargaDe, contarActivas, editId, pct, pctValido, personaId, reqIdsActivos, requerimientoId])

  const duplicada = personaId && requerimientoId ? asignacionExistente(personaId, requerimientoId, editId) : null
  const conflicto = vista !== null && pctValido && vista.usadoActivo + pct > 100
  const faltaRequerimiento = modoConsolidado && !requerimientoId
  const puedeGuardar = Boolean(personaId) && Boolean(panel.categoriaId) && pctValido
    && !conflicto && !duplicada && !faltaRequerimiento && !panel.guardando

  function datos(): DatosAsignacion {
    const opcion = panel.opcionReqSeleccionada
    return {
      personaId,
      categoriaId: panel.categoriaId,
      porcentaje: pct,
      requerimientoId,
      etiquetaRequerimiento: opcion?.label ?? etiquetaReq(requerimientoId || null),
      aplicacionId: opcion?.aplicacionId || (modoConsolidado ? '' : activa),
      prioridad: panel.prioridad,
    }
  }

  async function guardar(mantenerAbierto: boolean) {
    if (!puedeGuardar) return
    panel.setGuardando(true)
    panel.setError('')
    const errorServidor = asigEditando ? await actualizar(asigEditando, datos()) : await crear(datos())
    if (errorServidor) {
      panel.setError(errorServidor)
      panel.setGuardando(false)
      return
    }
    if (mantenerAbierto && !asigEditando) {
      panel.prepararSiguiente(`Asignación creada${persona ? ` para ${persona.nombre}` : ''}. Puedes agregar otra.`)
    } else {
      panel.cerrar()
    }
  }

  function alEnviar(evento: FormEvent) {
    evento.preventDefault()
    void guardar(false)
  }

  function alPulsarTecla(evento: KeyboardEvent<HTMLFormElement>) {
    if (evento.key === 'Enter' && (evento.ctrlKey || evento.metaKey)) {
      evento.preventDefault()
      void guardar(true)
    }
  }

  const nivelDespues = vista ? nivelCarga(vista.despues) : null

  return (
    <PanelLateral
      abierto={panel.abierto}
      titulo={modoEdicion ? 'Editar asignación' : 'Nueva asignación'}
      onCerrar={panel.cerrar}
      pie={
        <>
          <Boton variante="secundario" onClick={panel.cerrar}>Cancelar</Boton>
          <span className="flex-1" />
          {!modoEdicion && (
            <Boton variante="suave" disabled={!puedeGuardar} onClick={() => void guardar(true)} title="Ctrl + Enter">
              Crear y asignar otra
            </Boton>
          )}
          <Boton variante={modoEdicion ? 'exito' : 'primario'} type="submit" form={idFormulario} disabled={!puedeGuardar}>
            {panel.guardando ? 'Guardando…' : modoEdicion ? 'Actualizar' : 'Crear'}
          </Boton>
        </>
      }
    >
      <form id={idFormulario} onSubmit={alEnviar} onKeyDown={alPulsarTecla} className="grid gap-4">
        <Combobox
          etiqueta="Requerimiento"
          notaEtiqueta={modoConsolidado ? '(obligatorio en modo consolidado)' : '(opcional)'}
          opciones={opcionesCombobox}
          valor={requerimientoId}
          onCambio={panel.cambiarRequerimiento}
          placeholder="Buscar SC - REQ - Nombre"
          maximo={15}
          autoFocus={!personaId}
        />
        {faltaRequerimiento && (
          <Aviso tono="alerta">
            Modo consolidado: elige un requerimiento para crear la asignación en la aplicación correcta.
          </Aviso>
        )}

        <Selector
          etiqueta="Persona"
          value={personaId}
          onChange={(e) => panel.cambiarPersona(e.target.value)}
          required
        >
          <option value="">— Seleccionar —</option>
          {personasOpciones.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre} · {formatearPct(cargaDe(p.id).total)}%{p.activo ? '' : ' (inactiva)'}
            </option>
          ))}
        </Selector>
        <p className="-mt-3 text-xs text-slate-500">
          Solo personas activas y con rol operativo (sin LT_EPM), cada una con su carga actual.
        </p>

        <Selector
          etiqueta="Categoría"
          value={panel.categoriaId}
          onChange={(e) => panel.setCategoriaId(e.target.value)}
          required
        >
          <option value="">— Seleccionar —</option>
          {categoriasOrdenadas.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>
          ))}
        </Selector>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={panel.prioridad}
            onChange={(e) => panel.setPrioridad(e.target.checked)}
            className="h-4 w-4 accent-marca"
          />
          Marcar como prioridad
        </label>

        <div>
          <Campo
            etiqueta="% de carga"
            type="number"
            min="0"
            max="100"
            step="any"
            required
            value={panel.porcentaje}
            onChange={(e) => panel.setPorcentaje(e.target.value)}
            className="w-32"
          />
          <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Atajos de porcentaje">
            {ATAJOS_PCT.map((valor) => (
              <Boton
                key={valor}
                tamano="sm"
                variante={pct === valor ? 'primario' : 'suave'}
                aria-pressed={pct === valor}
                onClick={() => panel.setPorcentaje(String(valor))}
              >
                {valor}%
              </Boton>
            ))}
            {vista && vista.resto > 0 && (
              <Boton
                tamano="sm"
                variante={pct === vista.resto ? 'primario' : 'suave'}
                aria-pressed={pct === vista.resto}
                onClick={() => panel.setPorcentaje(formatearPct(vista.resto))}
              >
                Resto ({formatearPct(vista.resto)}%)
              </Boton>
            )}
            {vista && (
              <Boton
                tamano="sm"
                variante="suave"
                onClick={() => panel.setPorcentaje(String(Math.floor(100 / (vista.nIgual + 1))))}
              >
                Igual ({Math.floor(100 / (vista.nIgual + 1))}%)
              </Boton>
            )}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            Lo propuesto es lo que le queda libre a la persona; &quot;Igual&quot; reparte a partes iguales entre sus
            asignaciones activas.
          </p>
        </div>

        {vista && persona && nivelDespues && (
          <section
            aria-label={`Capacidad de ${persona.nombre}`}
            className="rounded-lg border border-slate-200 bg-slate-50 p-3"
          >
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Capacidad de {persona.nombre.split(' ')[0]} · mes en curso · {formatearPct(vista.carga.capacidadHoras)} h base
              {vista.carga.capacidadPorDefecto && ' (por defecto)'}
            </h3>
            <div className="grid gap-3">
              <div>
                <div className="mb-1 flex justify-between text-xs text-slate-600">
                  <span>Ahora</span>
                  <b className="tabular-nums text-slate-900">{formatearPct(vista.ahora)}%</b>
                </div>
                <MedidorCarga activa={vista.activaAhora} sinReq={vista.sinReqAhora} tamano="sm" etiqueta="Ahora" />
              </div>
              <div>
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                  <span>
                    Después de {modoEdicion ? 'guardar' : 'asignar'}
                    {pctValido && ` (+${formatearPct(pct)}% = ${vista.horasNuevo.toFixed(1)} h)`}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <b className="tabular-nums text-slate-900">{formatearPct(vista.despues)}%</b>
                    <Chip tono={TONO_CHIP_NIVEL[nivelDespues]}>{ETIQUETA_NIVEL[nivelDespues]}</Chip>
                  </span>
                </div>
                <MedidorCarga activa={vista.activaDespues} sinReq={vista.sinReqDespues} tamano="sm" etiqueta="Después" />
              </div>
            </div>
          </section>
        )}

        {panel.aviso && <Aviso tono="exito">{panel.aviso}</Aviso>}

        {duplicada && persona && (
          <Aviso tono="alerta">
            <span role="alert">
              {persona.nombre} ya está asignado a {etiquetaReq(requerimientoId)} ({formatearPct(duplicada.total_porcentaje)}%).{' '}
              <button type="button" className="enlace-accion" onClick={() => panel.abrirEditar(duplicada)}>
                Editar la existente
              </button>
            </span>
          </Aviso>
        )}

        {conflicto && vista && persona && (
          <Aviso tono="error">
            <span role="alert">
              Superaría el 100%: {persona.nombre} tiene {formatearPct(vista.usadoActivo)}% asignado en requerimientos
              activos y agregas {formatearPct(pct)}% (= {formatearPct(vista.usadoActivo + pct)}%).{' '}
              Disponible: {formatearPct(vista.resto)}%.{' '}
              <button
                type="button"
                className="enlace-accion"
                onClick={() => panel.setPorcentaje(formatearPct(vista.resto))}
              >
                Ajustar a {formatearPct(vista.resto)}%
              </button>
            </span>
          </Aviso>
        )}

        {panel.error && (
          <Aviso tono="error">
            <span role="alert">{panel.error}</span>
          </Aviso>
        )}

        {!conflicto && !duplicada && vista && pctValido && vista.despues <= 100 && (
          <p className="text-xs text-emerald-700">
            Queda dentro de la capacidad: {formatearPct(vista.despues)}% tras {modoEdicion ? 'guardar' : 'asignar'}. Libre:{' '}
            {formatearPct(Math.max(0, 100 - vista.despues))}%.
          </p>
        )}
      </form>
    </PanelLateral>
  )
}
