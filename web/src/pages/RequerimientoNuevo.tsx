// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import client from '../api/client'
import { analitica } from '../analitica'
import { mensajeError, useLista, useEstados } from '../api/hooks'
import { useAplicacion } from '../context/AplicacionContext'
import { useAuth } from '../context/AuthContext'
import { TIPIFICACIONES, TIPOS_COSTO } from '../constantes'
import { AreaTexto, Boton, Campo, Selector } from '../components/ui'
import type { Persona } from '../types'

export default function RequerimientoNuevo() {
  const navigate = useNavigate()
  const { tienePermiso } = useAuth()
  const { modoConsolidado, activa, aplicaciones: squads } = useAplicacion()
  const puedeCrear = tienePermiso('requerimientos.crear')
  const puedeCrearConsolidado = tienePermiso('consolidado.ver') && puedeCrear
  const { datos: personas } = useLista<Persona>('/personas')
  const { estadosReq } = useEstados()

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
  const [seguimiento, setSeguimiento] = useState('')
  const [seguimientoEpm, setSeguimientoEpm] = useState('')
  const [tipificacion, setTipificacion] = useState('')
  const [aviso, setAviso] = useState('')
  const [enviando, setEnviando] = useState(false)

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
        seguimiento: seguimiento || null,
        seguimiento_epm: seguimientoEpm || null,
        tipificacion: tipificacion || null,
      }, config)
      confirmarFormulario()
      navigate(`/requerimientos/${resp.data.id}`)
    } catch (err) {
      setAviso(mensajeError(err))
    } finally {
      setEnviando(false)
    }
  }

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

      <form data-analytics-form="requerimiento_nuevo" onSubmit={crear} className="tarjeta tarjeta-pad">
        <fieldset disabled={formularioBloqueado} className="space-y-0">
        <h2 className="etiqueta-sup mb-3">
          Datos generales
        </h2>
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
          <div className="sm:col-span-2 lg:col-span-3">
            <AreaTexto etiqueta="Seguimiento Hitss" value={seguimiento} onChange={(e) => setSeguimiento(e.target.value)} rows={2}
              className="w-full" />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <AreaTexto etiqueta="Seguimiento EPM" value={seguimientoEpm} onChange={(e) => setSeguimientoEpm(e.target.value)} rows={2}
              className="w-full" />
          </div>
          <Selector data-analytics-id="requerimiento.tipificacion" etiqueta="Tipificación" value={tipificacion} onChange={(e) => setTipificacion(e.target.value)}
            className="w-full">
            <option value="">— Seleccionar —</option>
            {TIPIFICACIONES.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
          </Selector>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          La cantidad de entregas inicia en 0 y se calcula automáticamente al registrar
          entregas en el requerimiento.
        </p>
        <Boton data-analytics-id="requerimiento.crear" variante="primario" type="submit" className="mt-4"
          disabled={enviando || sinEstadoInicial}>
          {enviando ? 'Creando…' : 'Crear requerimiento'}
        </Boton>
        </fieldset>
      </form>
    </div>
  )
}
