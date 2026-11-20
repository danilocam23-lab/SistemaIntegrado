// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useEffect, useState } from 'react'
import type { FormEvent, MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import client from '../api/client'
import { analitica } from '../analitica'
import { mensajeError, useLista, useEstados } from '../api/hooks'
import { useAplicacion } from '../context/AplicacionContext'
import { useAuth } from '../context/AuthContext'
import { TIPOS_COSTO } from '../constantes'
import { Boton, Campo, Chip, PanelPestana, Pestanas, Selector, TablaScroll } from '../components/ui'
import type { DefinicionPestana } from '../components/ui'
import type { Persona } from '../types'
import ModalEntrega from './requerimiento-detalle/ModalEntrega'
import { construirCuerpoEntrega, useFormularioEntrega } from './requerimiento-detalle/useFormularioEntrega'
import type { ValoresEntrega } from './requerimiento-detalle/useFormularioEntrega'

export default function RequerimientoNuevo() {
  const navigate = useNavigate()
  const { tienePermiso } = useAuth()
  const { modoConsolidado, activa, aplicaciones: squads } = useAplicacion()
  const puedeCrear = tienePermiso('requerimientos.crear')
  const puedeCrearConsolidado = tienePermiso('consolidado.ver') && puedeCrear
  const { datos: personas } = useLista<Persona>('/personas')
  const { estadosReq, estadosEnt } = useEstados()

  const [codigoSc, setCodigoSc] = useState('')
  const [codigoReq, setCodigoReq] = useState('')
  const [nombre, setNombre] = useState('')
  const [tipoCosto, setTipoCosto] = useState('TYM')
  const [squadId, setSquadId] = useState('')
  const [ltHitssId, setLtHitssId] = useState('')
  const [ltEpmId, setLtEpmId] = useState('')
  const [scrumId, setScrumId] = useState('')
  const [analistaId, setAnalistaId] = useState('')
  const [horas, setHoras] = useState('')
  const [fechaSolicitud, setFechaSolicitud] = useState('')
  const [aviso, setAviso] = useState('')
  const [enviando, setEnviando] = useState(false)

  // Pestañas del formulario y entregas acumuladas: se crean después del requerimiento,
  // en secuencia, con el mismo endpoint de alta de entrega del detalle.
  const [pestana, setPestana] = useState('datos')
  const [entregas, setEntregas] = useState<ValoresEntrega[]>([])
  const formEntrega = useFormularioEntrega(estadosEnt)
  const [modalEntregaAbierto, setModalEntregaAbierto] = useState(false)
  const [indiceEdicion, setIndiceEdicion] = useState<number | null>(null)
  const [errorEntrega, setErrorEntrega] = useState('')

  // Regla de negocio: squad == aplicación. En modo normal el squad es el activo y no
  // se puede cambiar; en consolidado el único selector "Squad" fija también el destino.
  useEffect(() => {
    if (!modoConsolidado && activa) setSquadId(activa)
  }, [modoConsolidado, activa])
  const aplicacionDestino = squadId
  const sinEstadoInicial = estadosReq.length === 0
  const formularioBloqueado = !puedeCrear || (modoConsolidado && !puedeCrearConsolidado)

  const squadNombre = squads.find((s) => s.codigo === squadId)?.nombre

  // `personas` (useLista('/personas')) solo trae quienes pertenecen al squad
  // "ambiente" (el que se está navegando actualmente), no necesariamente al squad
  // elegido en este formulario. Por eso el listado de Scrum se consulta explícitamente
  // contra el squad seleccionado (squadId), para que aparezcan personas con varios
  // squads aunque el squad del nuevo requerimiento sea distinto del squad ambiente.
  const [personasSquad, setPersonasSquad] = useState<Persona[]>([])
  useEffect(() => {
    if (!squadId) {
      setPersonasSquad([])
      return
    }
    // `cancelado` descarta la respuesta si el squad cambió mientras volaba la petición.
    let cancelado = false
    client.get<Persona[]>('/personas', { headers: { 'X-Aplicacion': squadId } })
      .then((r) => { if (!cancelado) setPersonasSquad(r.data) })
      .catch(() => { if (!cancelado) setPersonasSquad([]) })
    return () => { cancelado = true }
  }, [squadId])

  // Líderes técnicos por rol. Con squad elegido salen de sus personas; en consolidado
  // `personas` mezcla todas las aplicaciones, así que no se usa de respaldo.
  const baseLt = squadId && personasSquad.length > 0 ? personasSquad : (modoConsolidado ? [] : personas)
  const ltHitss = baseLt.filter((p) => p.activo && p.rol_operativo === 'LT_HITSS')
  const ltEpm = baseLt.filter((p) => p.activo && p.rol_operativo === 'LT_EPM')

  const scrums = (personasSquad.length > 0 ? personasSquad : personas).filter(
    (p) => p.activo && p.rol_operativo === 'SCRUM' && (!squadNombre || (p.squads ?? []).includes(squadNombre)),
  )

  // Analistas de requerimientos: personas activas con rol Scrum o AR/QA del squad seleccionado.
  const analistas = (personasSquad.length > 0 ? personasSquad : personas).filter(
    (p) => p.activo && (p.rol_operativo === 'SCRUM' || p.rol_operativo === 'AR/QA') && (!squadNombre || (p.squads ?? []).includes(squadNombre)),
  )

  function cambiarSquad(valor: string): void {
    setSquadId(valor)
    setLtHitssId('')
    setLtEpmId('')
    setScrumId('')
    setAnalistaId('')
  }

  function abrirNuevaEntrega(): void {
    formEntrega.cancelar()
    const mayor = entregas.reduce((m, en) => Math.max(m, Number(en.numero) || 0), 0)
    formEntrega.actualizar('numero', String(mayor + 1))
    setIndiceEdicion(null)
    setErrorEntrega('')
    setModalEntregaAbierto(true)
  }

  function editarEntrega(indice: number): void {
    formEntrega.cargarValores(entregas[indice])
    setIndiceEdicion(indice)
    setErrorEntrega('')
    setModalEntregaAbierto(true)
  }

  function cerrarModalEntrega(): void {
    setModalEntregaAbierto(false)
    setIndiceEdicion(null)
    formEntrega.cancelar()
  }

  function guardarEntregaLocal(e: FormEvent): void {
    e.preventDefault()
    const repetida = entregas.some((en, i) => i !== indiceEdicion && Number(en.numero) === Number(formEntrega.valores.numero))
    if (repetida) {
      setErrorEntrega(`Ya agregaste la entrega N.º ${formEntrega.valores.numero}.`)
      return
    }
    const valores = formEntrega.valores
    setEntregas((lista) => (
      indiceEdicion === null
        ? [...lista, valores]
        : lista.map((en, i) => (i === indiceEdicion ? valores : en))
    ))
    cerrarModalEntrega()
  }

  // Los obligatorios viven en la pestaña "Datos": si falta alguno estando en otra
  // pestaña, se abre la que lo contiene y se muestra el aviso nativo.
  function alCrear(e: MouseEvent<HTMLButtonElement>): void {
    const formulario = e.currentTarget.form
    if (formulario && !formulario.checkValidity()) {
      e.preventDefault()
      setPestana('datos')
      window.setTimeout(() => formulario.reportValidity(), 0)
    }
  }

  async function crear(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (enviando) return
    const confirmarFormulario = analitica.prepararEnvioFormulario('requerimiento_nuevo')
    setAviso('')
    if (!puedeCrear) {
      setAviso('No tienes permiso para crear requerimientos.')
      return
    }

    if (modoConsolidado && !puedeCrearConsolidado) {
      setAviso('La creación en modo consolidado requiere permisos de consolidado y creación.')
      return
    }
    if (!squadId) {
      setAviso(modoConsolidado
        ? 'En modo "Todos los squads" debes seleccionar el squad del requerimiento.'
        : 'No hay un squad activo seleccionado.')
      return
    }
    if (sinEstadoInicial) {
      setAviso('No hay un estado inicial configurado para los requerimientos. Revisa la configuración de estados.')
      return
    }

    // Override del header X-Aplicacion cuando estamos en modo consolidado
    const config = modoConsolidado ? { headers: { 'X-Aplicacion': aplicacionDestino } } : {}

    setEnviando(true)
    try {
      const resp = await client.post<{ id: string }>('/requerimientos', {
        codigo_req: codigoReq,
        nombre,
        solicitud: {
          codigo_sc: codigoSc,
          tipo_costo: tipoCosto,
          squad_id: squadId,
          lt_hitss_id: ltHitssId || null,
          lt_epm_id: ltEpmId || null,
          scrum_id: scrumId || null,
          analista_requerimientos_id: analistaId || null,
        },
        estado: estadosReq[0],
        total_horas_estimadas: horas ? Number(horas) : null,
        fecha_solicitud_acta: fechaSolicitud || null,
      }, config)
      confirmarFormulario()

      // Entregas acumuladas, una a una. Si una falla, se avisa y se deja al usuario en el
      // detalle del requerimiento ya creado (las siguientes no se envían).
      let avisoCreacion = ''
      for (const [i, entrega] of entregas.entries()) {
        try {
          await client.post(`/requerimientos/${resp.data.id}/entregas`, construirCuerpoEntrega(entrega), config)
        } catch (err) {
          const pendientes = entregas.length - i - 1
          avisoCreacion = `El requerimiento se creó, pero la entrega N.º ${entrega.numero} no se pudo registrar: ${mensajeError(err)}`
            + (pendientes > 0 ? ` No se enviaron ${pendientes} entrega(s) más.` : '')
            + ' Agrégalas desde la pestaña Entregas.'
          break
        }
      }
      navigate(
        `/requerimientos/${resp.data.id}${avisoCreacion ? '#entregas' : ''}`,
        avisoCreacion ? { state: { avisoCreacion } } : undefined,
      )
    } catch (err) {
      setAviso(mensajeError(err))
    } finally {
      setEnviando(false)
    }
  }

  const pestanas: DefinicionPestana[] = [
    { id: 'datos', etiqueta: 'Datos del requerimiento' },
    { id: 'entregas', etiqueta: 'Entregas', contador: entregas.length },
  ]

  return (
    <div className="space-y-6">
      <div>
        <Link data-analytics-id="requerimiento.volver" to="/requerimientos" className="text-sm text-marca hover:underline">
          ← Requerimientos
        </Link>
        <h1 className="titulo-pagina mt-1">Nuevo Requerimiento</h1>
      </div>

      {aviso && <div className="aviso aviso-error">{aviso}</div>}

      {modoConsolidado && !puedeCrearConsolidado && (
        <div className="aviso aviso-alerta">
          La creación de requerimientos en modo consolidado requiere permisos de consolidado y creación.
        </div>
      )}

      {sinEstadoInicial && (
        <div className="aviso aviso-alerta">
          No hay estados de requerimiento configurados, por lo que todavía no se pueden crear requerimientos.
        </div>
      )}

      <form data-analytics-form="requerimiento_nuevo" onSubmit={crear} className="space-y-0">
        <Pestanas
          prefijo="requerimiento-nuevo"
          etiqueta="Secciones del formulario"
          pestanas={pestanas}
          activa={pestana}
          onCambiar={setPestana}
        />
        <fieldset disabled={formularioBloqueado} className="tarjeta tarjeta-pad rounded-t-none border-t-0">
          <PanelPestana prefijo="requerimiento-nuevo" id="datos" activa={pestana}>
            <p className="mb-3 text-xs text-slate-500">Los campos con * son obligatorios.</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Campo etiqueta="Código SC *" value={codigoSc} onChange={(e) => setCodigoSc(e.target.value)} required
                placeholder="11110" className="w-full" />
              <Campo etiqueta="Código REQ *" value={codigoReq} onChange={(e) => setCodigoReq(e.target.value)} required
                placeholder="RP-SSC-0964" className="w-full" />
              <Campo etiqueta="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre del requerimiento" className="w-full" />
              <Selector data-analytics-id="requerimiento.tipo_costo" etiqueta="Tipo de costo" value={tipoCosto} onChange={(e) => setTipoCosto(e.target.value)}
                className="w-full">
                {TIPOS_COSTO.map((t) => <option key={t} value={t}>{t}</option>)}
              </Selector>
              {modoConsolidado ? (
                <Selector data-analytics-id="requerimiento.squad" etiqueta="Squad *" value={squadId} onChange={(e) => cambiarSquad(e.target.value)}
                  required className="w-full">
                  <option value="">— Seleccionar squad —</option>
                  {squads.map((s) => <option key={s.codigo} value={s.codigo}>{s.nombre}</option>)}
                </Selector>
              ) : (
                <Selector data-analytics-id="requerimiento.squad" etiqueta="Squad" value={squadId} onChange={() => undefined}
                  disabled className="w-full">
                  <option value={squadId}>{squadNombre ?? squadId}</option>
                </Selector>
              )}
              <Selector data-analytics-id="requerimiento.lt_hitss" etiqueta="Líder técnico" value={ltHitssId} onChange={(e) => setLtHitssId(e.target.value)}
                className="w-full">
                <option value="">— Seleccionar —</option>
                {ltHitss.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </Selector>
              <Selector data-analytics-id="requerimiento.lt_epm" etiqueta="Líder técnico EPM" value={ltEpmId} onChange={(e) => setLtEpmId(e.target.value)}
                className="w-full">
                <option value="">— Seleccionar —</option>
                {ltEpm.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </Selector>
              <Selector data-analytics-id="requerimiento.scrum" etiqueta="Scrum" value={scrumId} onChange={(e) => setScrumId(e.target.value)}
                disabled={!squadId}
                className="w-full">
                <option value="">{squadId ? '— Seleccionar —' : 'Elige un squad primero'}</option>
                {scrums.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </Selector>
              <Selector data-analytics-id="requerimiento.analista" etiqueta="Analista de requerimientos" value={analistaId} onChange={(e) => setAnalistaId(e.target.value)}
                disabled={!squadId}
                className="w-full">
                <option value="">{squadId ? '— Seleccionar —' : 'Elige un squad primero'}</option>
                {analistas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </Selector>
              <Campo etiqueta="Horas estimadas" value={horas} onChange={(e) => setHoras(e.target.value)} type="number" step="any"
                className="w-full" />
              <Campo etiqueta="Fecha y hora de solicitud" value={fechaSolicitud} onChange={(e) => setFechaSolicitud(e.target.value)}
                type="datetime-local" className="w-full" />
            </div>
            <p className="mt-2 text-xs text-slate-400">
              La cantidad de entregas inicia en 0 y se calcula automáticamente al registrar
              entregas en el requerimiento. El seguimiento y la tipificación se llenan después, en el detalle.
            </p>
          </PanelPestana>

          <PanelPestana prefijo="requerimiento-nuevo" id="entregas" activa={pestana}>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <p className="text-sm text-slate-500">
                Opcional. Agrega aquí las entregas ya conocidas; también puedes hacerlo después.
              </p>
              <Boton variante="secundario" tamano="sm" onClick={abrirNuevaEntrega}>
                + Agregar entrega
              </Boton>
            </div>
            {entregas.length === 0 ? (
              <p className="text-sm text-slate-400">Sin entregas agregadas.</p>
            ) : (
              <TablaScroll>
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>N.º</th>
                      <th>Horas</th>
                      <th>Fecha comprometida</th>
                      <th>Estado</th>
                      <th><span className="sr-only">Acciones</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {entregas.map((en, i) => (
                      <tr key={`${en.numero}-${i}`}>
                        <td>{en.numero}</td>
                        <td>{en.horas || '—'}</td>
                        <td>{en.fecha || '—'}</td>
                        <td><Chip tono="neutro">{en.estado}</Chip></td>
                        <td className="whitespace-nowrap text-right">
                          <button type="button" className="enlace-accion" onClick={() => editarEntrega(i)}>
                            Editar
                          </button>
                          {' · '}
                          <button
                            type="button"
                            className="enlace-accion enlace-accion-peligro"
                            onClick={() => setEntregas((lista) => lista.filter((_, k) => k !== i))}
                          >
                            Quitar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TablaScroll>
            )}
            <p className="mt-3 text-xs text-slate-400">
              Cada entrega agregada queda con su nota automática de creación en la bitácora.
            </p>
          </PanelPestana>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <small className="text-xs text-slate-500">
              Al crear, se registra automáticamente en la bitácora: “Requerimiento creado por [usuario]”.
            </small>
            <div className="flex gap-2">
              <Boton variante="secundario" onClick={() => navigate('/requerimientos')}>
                Cancelar
              </Boton>
              <Boton data-analytics-id="requerimiento.crear" variante="primario" type="submit" onClick={alCrear}
                disabled={enviando || sinEstadoInicial}>
                {enviando ? 'Creando…' : 'Crear requerimiento'}
              </Boton>
            </div>
          </div>
        </fieldset>
      </form>

      <ModalEntrega
        abierto={modalEntregaAbierto}
        modo="crear"
        form={formEntrega}
        estadosEnt={estadosEnt}
        estadoRequerimiento={estadosReq[0] ?? ''}
        onSubmit={guardarEntregaLocal}
        onCerrar={cerrarModalEntrega}
        error={errorEntrega}
      />
    </div>
  )
}
