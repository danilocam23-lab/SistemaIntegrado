import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import client from '../api/client'
import { mensajeError, useLista, useEstados } from '../api/hooks'
import { useAplicacion } from '../context/AplicacionContext'
import { useAuth } from '../context/AuthContext'
import { TIPOS_COSTO, ESTADOS_ENTREGA } from '../constantes'
import type { Aplicacion, EventoBitacora, Liquidacion, Persona, Requerimiento, Squad } from '../types'

const MESES_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

export default function RequerimientoDetalle() {
  const { reqId } = useParams<{ reqId: string }>()
  const { tienePermiso } = useAuth()
  const { modoConsolidado } = useAplicacion()
  const puedeEditarReq = tienePermiso('requerimientos.editar')
  const puedeEditarTipificacion = puedeEditarReq || tienePermiso('requerimientos.tipificacion.editar')
  const puedeEliminarBitacora = tienePermiso('admin.roles.editar')
  const { datos: personas } = useLista<Persona>('/personas')
  const { datos: squads } = useLista<Aplicacion>('/aplicaciones')
  const { estadosReq, estadosEnt } = useEstados()

  // Squads reales (colección squads) cargados en modo __todas__ para resolver
  // squad_id importados (que son id del Squad document, no código de aplicación)
  const [squadsDoc, setSquadsDoc] = useState<Squad[]>([])
  useEffect(() => {
    client.get<Squad[]>('/squads', { headers: { 'X-Aplicacion': '__todas__' } })
      .then((r) => setSquadsDoc(r.data))
      .catch(() => {
        client.get<Squad[]>('/squads').then((r) => setSquadsDoc(r.data)).catch(() => {})
      })
  }, [])
  const [req, setReq] = useState<Requerimiento | null>(null)
  const [liquidacion, setLiquidacion] = useState<Liquidacion | null>(null)
  const [eventos, setEventos] = useState<EventoBitacora[]>([])
  const [aviso, setAviso] = useState('')
  const [ok, setOk] = useState('')

  // Formulario de datos generales
  const [nombreActa, setNombreActa] = useState('')
  const [codigoSc, setCodigoSc] = useState('')
  const [tipoCosto, setTipoCosto] = useState('TYM')
  const [squadId, setSquadId] = useState('')
  const [ltHitssId, setLtHitssId] = useState('')
  const [ltEpmId, setLtEpmId] = useState('')
  const [scrumId, setScrumId] = useState('')
  const [horas, setHoras] = useState('')
  const [fechaSolicitudActa, setFechaSolicitudActa] = useState('')
  const [fechaRealEntregaEst, setFechaRealEntregaEst] = useState('')
  const [seguimiento, setSeguimiento] = useState('')
  const [seguimientoEpm, setSeguimientoEpm] = useState('')
  const [tipificacion, setTipificacion] = useState('')
  const [motivoCierre, setMotivoCierre] = useState('')
  const [actaTrabajo, setActaTrabajo] = useState('')

  // Formulario de entrega
  const [eNumero, setENumero] = useState('')
  const [eHoras, setEHoras] = useState('')
  const [eFecha, setEFecha] = useState('')
  const [eFechaReal, setEFechaReal] = useState('')
  const [eEstado, setEEstado] = useState(ESTADOS_ENTREGA[0])
  const [eMesAprobacion, setEMesAprobacion] = useState('')
  const [eObservaciones, setEObservaciones] = useState('')
  const [eObservacionesHitss, setEObservacionesHitss] = useState('')
  const [eTipificacion, setETipificacion] = useState('')
  const [eGarantia, setEGarantia] = useState(false)
  const [eNumGarantia, setENumGarantia] = useState<number | null>(null)
  const [eEditando, setEEditando] = useState(false)

  // Edición inline de Observaciones Hitss / Tipificación por entrega
  // (visible para quienes tengan requerimientos.tipificacion.editar aunque no
  // tengan requerimientos.editar completo).
  const [tipifEdicion, setTipifEdicion] = useState<Record<number, { obs: string; tip: string }>>({})
  const [guardandoTipif, setGuardandoTipif] = useState<Set<number>>(new Set())

  function iniciarEdicionTipifEntrega(en: Requerimiento['entregas'][number]): void {
    setTipifEdicion((p) => ({
      ...p,
      [en.numero]: { obs: en.observaciones_hitss ?? '', tip: en.tipificacion ?? '' },
    }))
  }

  async function guardarTipifEntregaInline(numero: number): Promise<void> {
    const edicion = tipifEdicion[numero]
    if (!edicion || !req) return
    setGuardandoTipif((s) => new Set(s).add(numero))
    try {
      await client.patch('/requerimientos/detalle-ans', {
        tipo: 'entrega',
        req_id: req.id,
        entrega_numero: numero,
        observaciones_hitss: edicion.obs || null,
        tipificacion: edicion.tip || null,
      }, writeConfig())
      setTipifEdicion((p) => { const n = { ...p }; delete n[numero]; return n })
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    } finally {
      setGuardandoTipif((s) => { const n = new Set(s); n.delete(numero); return n })
    }
  }

  function cargarEntregaEnFormulario(en: Requerimiento['entregas'][number]): void {
    setENumero(String(en.numero))
    setEHoras(en.horas != null ? String(en.horas) : '')
    setEFecha(en.fecha_comprometida ? en.fecha_comprometida.slice(0, 10) : '')
    setEFechaReal(en.fecha_recepcion ? en.fecha_recepcion.slice(0, 10) : '')
    setEEstado(en.estado ?? estadosEnt[0])
    setEMesAprobacion(en.mes_aprobacion ?? '')
    setEObservaciones(en.observaciones ?? '')
    setEObservacionesHitss(en.observaciones_hitss ?? '')
    setETipificacion(en.tipificacion ?? '')
    setEGarantia(en.garantia ?? false)
    setENumGarantia(en.numero_garantia ?? (en.garantia ? 1 : null))
    setEEditando(true)
  }

  function cancelarEdicionEntrega(): void {
    setENumero('')
    setEHoras('')
    setEFecha('')
    setEFechaReal('')
    setEEstado(estadosEnt[0])
    setEMesAprobacion('')
    setEObservaciones('')
    setEObservacionesHitss('')
    setETipificacion('')
    setEGarantia(false)
    setENumGarantia(null)
    setEEditando(false)
  }

  const recargar = useCallback(async () => {
    if (!reqId) return
    try {
      const { data } = await client.get<Requerimiento>(`/requerimientos/${reqId}`)
      setReq(data)
      setNombreActa(data.nombre ?? '')
      setCodigoSc(data.solicitud?.codigo_sc ?? '')
      setTipoCosto(data.solicitud?.tipo_costo ?? 'TYM')
      setSquadId(data.solicitud?.squad_id ?? '')
      setLtHitssId(data.solicitud?.lt_hitss_id ?? '')
      setLtEpmId(data.solicitud?.lt_epm_id ?? '')
      setScrumId(data.solicitud?.scrum_id ?? '')
      setHoras(data.total_horas_estimadas != null ? String(data.total_horas_estimadas) : '')
      setFechaSolicitudActa(data.fecha_solicitud_acta ? data.fecha_solicitud_acta.slice(0, 16) : '')
      setFechaRealEntregaEst(data.fecha_real_entrega_estimacion ? data.fecha_real_entrega_estimacion.slice(0, 16) : '')
      setSeguimiento(data.seguimiento ?? '')
      setSeguimientoEpm(data.seguimiento_epm ?? '')
      setTipificacion(data.tipificacion ?? '')
      setMotivoCierre(data.motivo_cierre ?? '')
      setActaTrabajo(data.acta_trabajo ?? '')
      const [liq, bit] = await Promise.all([
        client.get<Liquidacion>(`/requerimientos/${reqId}/liquidacion`),
        client.get<EventoBitacora[]>(`/bitacora?entidad_id=${data.id}`),
      ])
      setLiquidacion(liq.data)
      setEventos(bit.data)
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }, [reqId])

  useEffect(() => {
    recargar()
  }, [recargar])

  const ltHitss = personas.filter((p) => p.rol_operativo === 'LT_HITSS')
  const ltEpm = personas.filter((p) => p.rol_operativo === 'LT_EPM')

  // Resuelve nombre del squad desde ambas fuentes:
  // - Aplicaciones (para registros creados manualmente: squad_id = codigo de app)
  // - Squad documents (para registros importados: squad_id = id del Squad)
  function resolverNombreSquad(id: string): string {
    if (!id) return '—'
    const porApp = squads.find((s) => s.codigo === id)
    if (porApp) return porApp.nombre
    const porDoc = squadsDoc.find((s) => String(s.id) === String(id))
    if (porDoc) return porDoc.nombre
    return id
  }

  const squadNombre = resolverNombreSquad(squadId)

  // El squadId puede ser el código de una Aplicación (registros creados a mano) o el id
  // de un documento Squad (registros importados). Para pedir personas del squad
  // correcto siempre se resuelve al código real de Aplicación a partir del nombre.
  const codigoAppSquad = squads.find((s) => s.codigo === squadId)?.codigo
    ?? squads.find((s) => s.nombre === squadNombre)?.codigo
    ?? ''

  // Las personas (`useLista('/personas')`) solo traen quienes pertenecen al squad
  // "ambiente" (el que se está navegando), no al squad seleccionado en este formulario.
  // Por eso, para el listado de Scrum se consulta explícitamente el squad elegido
  // (codigoAppSquad), así aparecen personas con varios squads aunque el squad del
  // requerimiento sea distinto al squad ambiente actual.
  const [personasSquad, setPersonasSquad] = useState<Persona[]>([])
  useEffect(() => {
    if (!codigoAppSquad) {
      setPersonasSquad([])
      return
    }
    client.get<Persona[]>('/personas', { headers: { 'X-Aplicacion': codigoAppSquad } })
      .then((r) => setPersonasSquad(r.data))
      .catch(() => setPersonasSquad([]))
  }, [codigoAppSquad])

  // Cuando ya se cargaron las personas del squad correcto (server-side ya filtra por
  // aplicacion_id o squads), no hace falta repetir el filtro por nombre de squad; solo
  // se re-aplica como respaldo si el fetch específico falló y se usa la lista ambiente.
  const scrums = (personasSquad.length > 0 ? personasSquad : personas).filter(
    (p) => p.rol_operativo === 'SCRUM' && (
      personasSquad.length > 0 || !squadNombre || squadNombre === '—' || (p.squads ?? []).includes(squadNombre)
    ),
  )

  // Respaldo: si el scrum ya asignado no aparece en ninguna de las listas anteriores
  // (por ejemplo, mientras el fetch por squad todavía no responde), se busca
  // puntualmente por id para no perder su nombre en el select.
  const [scrumAsignado, setScrumAsignado] = useState<Persona | null>(null)
  useEffect(() => {
    if (!scrumId) {
      setScrumAsignado(null)
      return
    }
    if (personas.some((p) => p.id === scrumId) || personasSquad.some((p) => p.id === scrumId)) {
      setScrumAsignado(null)
      return
    }
    client.get<Persona>(`/personas/${scrumId}`, { headers: { 'X-Aplicacion': '__todas__' } })
      .then((r) => setScrumAsignado(r.data))
      .catch(() => setScrumAsignado(null))
  }, [scrumId, personas, personasSquad])

  // En modo consolidado el cliente envía __todas__; las escrituras necesitan
  // el código real de la aplicación. Se obtiene del propio requerimiento
  // (aplicacion_id o squad_id de la solicitud como fallback).
  function writeConfig() {
    if (!modoConsolidado) return {}
    const appCode = req?.aplicacion_id || req?.solicitud?.squad_id
    return appCode ? { headers: { 'X-Aplicacion': appCode } } : {}
  }

  async function guardar(e: FormEvent): Promise<void> {
    e.preventDefault()
    setAviso('')
    setOk('')
    if (!puedeEditarReq) {
      setAviso('No tienes permiso para editar requerimientos.')
      return
    }
    if (!req) return
    try {
      await client.put(`/requerimientos/${reqId}`, {
        nombre: nombreActa || null,
        solicitud: {
          ...req.solicitud,
          codigo_sc: codigoSc,
          tipo_costo: tipoCosto || null,
          squad_id: squadId || null,
          lt_hitss_id: ltHitssId || null,
          lt_epm_id: ltEpmId || null,
          scrum_id: scrumId || null,
        },
        total_horas_estimadas: horas ? Number(horas) : null,
        fecha_solicitud_acta: fechaSolicitudActa || null,
        fecha_real_entrega_estimacion: fechaRealEntregaEst || null,
        seguimiento: seguimiento || null,
        seguimiento_epm: seguimientoEpm || null,
        tipificacion: tipificacion || null,
        motivo_cierre: motivoCierre || null,
        acta_trabajo: actaTrabajo || null,
      }, writeConfig())
      setOk('Cambios guardados.')
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  async function guardarTipificacionReq(): Promise<void> {
    setAviso('')
    setOk('')
    if (!puedeEditarTipificacion) {
      setAviso('No tienes permiso para editar Seguimiento Hitss / Tipificación.')
      return
    }
    if (!req) return
    try {
      await client.patch('/requerimientos/detalle-ans', {
        tipo: 'requerimiento',
        req_id: req.id,
        seguimiento: seguimiento || null,
        tipificacion: tipificacion || null,
      }, writeConfig())
      setOk('Cambios guardados.')
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  async function transicion(nuevoEstado: string): Promise<void> {
    setAviso('')
    setOk('')
    if (!puedeEditarReq) {
      setAviso('No tienes permiso para actualizar el estado del requerimiento.')
      return
    }
    try {
      await client.post(`/requerimientos/${reqId}/transicion`, { nuevo_estado: nuevoEstado }, writeConfig())
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  async function agregarEntrega(e: FormEvent): Promise<void> {
    e.preventDefault()
    setAviso('')
    setOk('')
    if (!puedeEditarReq) {
      setAviso('No tienes permiso para crear o actualizar entregas.')
      return
    }
    try {
      await client.post(`/requerimientos/${reqId}/entregas`, {
        numero: Number(eNumero),
        horas: eHoras ? Number(eHoras) : null,
        fecha_comprometida: eFecha || null,
        fecha_recepcion: eFechaReal || null,
        estado: eEstado,
        mes_aprobacion: eEstado.toUpperCase() === 'APROBADA' ? (eMesAprobacion || null) : null,
        observaciones: eObservaciones || null,
        observaciones_hitss: eObservacionesHitss || null,
        tipificacion: eTipificacion || null,
        garantia: eGarantia,
        numero_garantia: eGarantia ? (eNumGarantia ?? 1) : null,
      }, writeConfig())
      setENumero('')
      setEHoras('')
      setEFecha('')
      setEFechaReal('')
      setEMesAprobacion('')
      setEObservaciones('')
      setEObservacionesHitss('')
      setETipificacion('')
      setEEditando(false)
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  async function eliminarEntrega(numero: number): Promise<void> {
    setAviso('')
    setOk('')
    if (!puedeEditarReq) {
      setAviso('No tienes permiso para eliminar entregas.')
      return
    }
    try {
      await client.delete(`/requerimientos/${reqId}/entregas/${numero}`, writeConfig())
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  async function eliminarEvento(eventoId: string): Promise<void> {
    if (!confirm('¿Eliminar este evento de bitácora?')) return
    try {
      await client.delete(`/bitacora/${eventoId}`, writeConfig())
      setEventos((prev) => prev.filter((e) => e.id !== eventoId))
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  if (!req) {
    return <div className="text-slate-500">{aviso || 'Cargando…'}</div>
  }


  return (
    <div className="space-y-6">
      <div>
        <Link to="/requerimientos" className="text-sm text-marca hover:underline">
          ← Requerimientos
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="titulo-pagina">{req.codigo_req}</h1>
          {req.nombre && <span className="text-base text-slate-600">— {req.nombre}</span>}
          {puedeEditarReq ? (
            <select
              value={req.estado}
              onChange={(e) => transicion(e.target.value)}
              className="campo campo-sm"
            >
              {estadosReq.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <span className="rounded border bg-slate-50 px-2 py-1 text-xs text-slate-600">{req.estado}</span>
          )}
        </div>
      </div>

      {aviso && <div className="aviso aviso-error">{aviso}</div>}
      {ok && <div className="aviso aviso-exito">{ok}</div>}

      {/* Datos generales */}
      <form onSubmit={guardar} className="tarjeta tarjeta-pad">
        <fieldset disabled={!puedeEditarReq}>
        <h2 className="etiqueta-sup mb-3">
          Datos generales
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Código SC</span>
            <input value={codigoSc} onChange={(e) => setCodigoSc(e.target.value)} required
              className="campo w-full" />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-slate-600">Nombre de acta</span>
            <input value={nombreActa} onChange={(e) => setNombreActa(e.target.value)}
              className="campo w-full" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Tipo de costo</span>
            <select value={tipoCosto} onChange={(e) => setTipoCosto(e.target.value)}
              className="campo w-full">
              {TIPOS_COSTO.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Squad</span>
            {/* Muestra el nombre resuelto (importados: id→nombre, manuales: codigo→nombre) */}
            <div className="mb-1 rounded border bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">
              {resolverNombreSquad(squadId)}
            </div>
            {puedeEditarReq && (
              <select
                value={squadId}
                onChange={(e) => { setSquadId(e.target.value); setScrumId('') }}
                className="campo w-full"
              >
                <option value="">— Cambiar squad —</option>
                {squads.filter((s) => s.activa).map((s) => <option key={s.codigo} value={s.codigo}>{s.nombre}</option>)}
              </select>
            )}
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Líder técnico</span>
            <select value={ltHitssId} onChange={(e) => setLtHitssId(e.target.value)}
              className="campo w-full">
              <option value="">— Seleccionar —</option>
              {ltHitss.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Líder técnico EPM</span>
            <select value={ltEpmId} onChange={(e) => setLtEpmId(e.target.value)}
              className="campo w-full">
              <option value="">— Seleccionar —</option>
              {ltEpm.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Scrum</span>
            <select value={scrumId} onChange={(e) => setScrumId(e.target.value)}
              disabled={!squadId}
              className="campo w-full">
              <option value="">{squadId ? '— Seleccionar —' : 'Elige un squad primero'}</option>
              {scrumId && !scrums.some((p) => p.id === scrumId) && (
                <option value={scrumId}>
                  {personas.find((p) => p.id === scrumId)?.nombre
                    ?? personasSquad.find((p) => p.id === scrumId)?.nombre
                    ?? scrumAsignado?.nombre
                    ?? scrumId}
                </option>
              )}
              {scrums.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Horas estimadas</span>
            <input value={horas} onChange={(e) => setHoras(e.target.value)} type="number" step="any"
              className="campo w-full" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Fecha y hora de solicitud</span>
            <input value={fechaSolicitudActa} onChange={(e) => setFechaSolicitudActa(e.target.value)}
              type="datetime-local" className="campo w-full" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Fecha límite</span>
            <input
              value={req.fecha_limite ? req.fecha_limite.slice(0, 16).replace('T', ' ') : '—'}
              readOnly disabled
              className="campo w-full" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Fecha real entrega de estimaciones</span>
            <input value={fechaRealEntregaEst} onChange={(e) => setFechaRealEntregaEst(e.target.value)}
              type="datetime-local"
              disabled={!puedeEditarReq}
              className="campo w-full" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">ANS Estimación</span>
            {(() => {
              const cumple =
                req.fecha_limite && fechaRealEntregaEst
                  ? new Date(fechaRealEntregaEst) <= new Date(req.fecha_limite)
                  : null
              return (
                <span className={`block rounded border px-3 py-2 font-medium ${
                  cumple === true  ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                  cumple === false ? 'border-red-200 bg-red-50 text-red-700' :
                  'bg-slate-100 text-slate-500'
                }`}>
                  {cumple === true ? 'Cumple' : cumple === false ? 'No cumple' : '—'}
                </span>
              )
            })()}
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Cantidad de entregas</span>
            <input value={req.entregas.length} readOnly disabled
              className="campo w-full" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Acta de trabajo</span>
            <input value={actaTrabajo} onChange={(e) => setActaTrabajo(e.target.value)}
              disabled={!puedeEditarReq}
              placeholder="Número o referencia del acta de trabajo"
              className="campo w-full" />
          </label>
          <label className="text-sm sm:col-span-2 lg:col-span-3">
            <span className="mb-1 block text-slate-600">Seguimiento EPM</span>
            <textarea value={seguimientoEpm} onChange={(e) => setSeguimientoEpm(e.target.value)} rows={2}
              disabled={!puedeEditarReq}
              className="campo w-full" />
          </label>
          <label className="text-sm sm:col-span-2 lg:col-span-3">
            <span className="mb-1 block text-slate-600">Motivo de cierre</span>
            <input value={motivoCierre} onChange={(e) => setMotivoCierre(e.target.value)}
              className="campo w-full" />
          </label>
        </div>
        </fieldset>
        {puedeEditarReq && (
          <button className="btn btn-primario mt-3">
            Guardar cambios
          </button>
        )}
      </form>

      {/* Seguimiento Hitss y Tipificación (editable por Administrador de squad) */}
      <div className="tarjeta tarjeta-pad">
        <h2 className="etiqueta-sup mb-3">
          Seguimiento Hitss
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm sm:col-span-2 lg:col-span-3">
            <span className="mb-1 block text-slate-600">Seguimiento Hitss</span>
            <textarea value={seguimiento} onChange={(e) => setSeguimiento(e.target.value)} rows={2}
              disabled={!puedeEditarTipificacion}
              className="campo w-full" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Tipificación</span>
            <select value={tipificacion} onChange={(e) => setTipificacion(e.target.value)}
              disabled={!puedeEditarTipificacion}
              className="campo w-full">
              <option value="">— Seleccionar —</option>
              <option value="HITSS">Hitss</option>
              <option value="EPM">EPM</option>
            </select>
          </label>
        </div>
        {puedeEditarTipificacion && (
          <button type="button" onClick={guardarTipificacionReq}
            className="btn btn-primario mt-3">
            Guardar Seguimiento Hitss / Tipificación
          </button>
        )}
      </div>

      {/* Entregas */}
      <div className="tarjeta tarjeta-pad">
        <h2 className="etiqueta-sup mb-1">
          Entregas ({req.entregas.length})
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          Horas estimadas: <b>{req.total_horas_estimadas ?? '—'}</b> · Asignadas en entregas:{' '}
          <b>{req.entregas.reduce((s, e) => s + Number(e.horas ?? 0), 0)}</b>
          {req.total_horas_estimadas != null && (
            <>
              {' '}· Disponibles:{' '}
              <b>
                {Number(req.total_horas_estimadas) -
                  req.entregas.reduce((s, e) => s + Number(e.horas ?? 0), 0)}
              </b>
            </>
          )}
        </p>
        <table className="mb-3 w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="py-1">N°</th><th className="py-1">Horas</th>
              <th className="py-1">% Avance</th><th className="py-1">F. Comprometida</th>
              <th className="py-1">F. Real</th><th className="py-1">Estado</th><th className="py-1">Mes aprobación</th>
              <th className="py-1">Observaciones EPM</th><th className="py-1">Observaciones Hitss</th>
              <th className="py-1">Tipificación</th>
              <th className="py-1">ANS</th><th className="py-1">Garantía</th><th className="py-1">N° Garantía</th>
              <th className="py-1"></th>
            </tr>
          </thead>
          <tbody>
            {req.entregas.map((en) => {
              const porcentaje = en.horas != null && req.total_horas_estimadas
                ? ((Number(en.horas) * 100) / Number(req.total_horas_estimadas)).toFixed(1)
                : '—'
              const ansLabel = en.ans_entrega === 'CUMPLE' ? 'Cumple'
                : en.ans_entrega === 'NO_CUMPLE' ? 'No cumple' : '—'
              const ansColor = en.ans_entrega === 'CUMPLE' ? 'text-emerald-600'
                : en.ans_entrega === 'NO_CUMPLE' ? 'text-red-600' : ''
              return (
                <tr key={en.numero} className="border-t">
                  <td className="py-1">{en.numero}</td>
                  <td className="py-1">{en.horas ?? '—'}</td>
                  <td className="py-1">{porcentaje}{porcentaje !== '—' ? '%' : ''}</td>
                  <td className="py-1">{en.fecha_comprometida?.slice(0, 10) ?? '—'}</td>
                  <td className="py-1">{en.fecha_recepcion?.slice(0, 10) ?? '—'}</td>
                  <td className="py-1">{en.estado ?? '—'}</td>
                  <td className="py-1">{en.mes_aprobacion ?? '—'}</td>
                  <td className="py-1">{en.observaciones ?? '—'}</td>
                  <td className="py-1">
                    {tipifEdicion[en.numero] ? (
                      <input
                        value={tipifEdicion[en.numero].obs}
                        onChange={(ev) => setTipifEdicion((p) => ({ ...p, [en.numero]: { ...p[en.numero], obs: ev.target.value } }))}
                        className="campo campo-sm w-full"
                      />
                    ) : (en.observaciones_hitss ?? '—')}
                  </td>
                  <td className="py-1">
                    {tipifEdicion[en.numero] ? (
                      <select
                        value={tipifEdicion[en.numero].tip}
                        onChange={(ev) => setTipifEdicion((p) => ({ ...p, [en.numero]: { ...p[en.numero], tip: ev.target.value } }))}
                        className="campo campo-sm"
                      >
                        <option value="">— Seleccionar —</option>
                        <option value="HITSS">Hitss</option>
                        <option value="EPM">EPM</option>
                      </select>
                    ) : (en.tipificacion ?? '—')}
                  </td>
                  <td className={`py-1 font-medium ${ansColor}`}>{ansLabel}</td>
                  <td className="py-1">{en.garantia ? 'Sí' : 'No'}</td>
                  <td className="py-1">{en.numero_garantia ?? '—'}</td>
                  <td className="py-1">
                    {puedeEditarReq && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => cargarEntregaEnFormulario(en)}
                          className="enlace-accion"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => eliminarEntrega(en.numero)}
                          className="enlace-accion enlace-accion-peligro"
                        >
                          Eliminar
                        </button>
                      </div>
                    )}
                    {!puedeEditarReq && puedeEditarTipificacion && (
                      <div className="flex gap-2">
                        {tipifEdicion[en.numero] ? (
                          <>
                            <button
                              type="button"
                              disabled={guardandoTipif.has(en.numero)}
                              onClick={() => guardarTipifEntregaInline(en.numero)}
                              className="text-marca hover:underline disabled:opacity-50"
                            >
                              Guardar
                            </button>
                            <button
                              type="button"
                              onClick={() => setTipifEdicion((p) => { const n = { ...p }; delete n[en.numero]; return n })}
                              className="text-slate-500 hover:underline"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => iniciarEdicionTipifEntrega(en)}
                            className="enlace-accion"
                          >
                            Editar Hitss
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
            {req.entregas.length === 0 && (
              <tr><td colSpan={13} className="py-2 text-slate-400">Sin entregas.</td></tr>
            )}
          </tbody>
        </table>
        {puedeEditarReq && (
        <form onSubmit={agregarEntrega} className={`flex flex-wrap items-end gap-3 border-t pt-3 ${eEditando ? 'rounded-lg bg-amber-50 p-3' : ''}`}>
          {eEditando && (
            <div className="w-full text-xs font-semibold text-amber-700">
              ✏️ Editando entrega N° {eNumero} — los cambios reemplazarán la entrega existente
            </div>
          )}
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">N° entrega</span>
            <input value={eNumero} onChange={(e) => setENumero(e.target.value)} type="number" required
              readOnly={eEditando}
              className={`w-24 rounded border px-3 py-2 ${eEditando ? 'bg-slate-100 text-slate-500' : ''}`} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Horas</span>
            <input value={eHoras} onChange={(e) => setEHoras(e.target.value)} type="number" step="any"
              className="campo w-28" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">
              Fecha comprometida
              {req?.estado?.toUpperCase() !== 'CONTROL DE CAMBIOS' && (
                <span className="ml-1 text-red-500">*</span>
              )}
            </span>
            <input
              value={eFecha}
              onChange={(e) => setEFecha(e.target.value)}
              type="date"
              required={req?.estado?.toUpperCase() !== 'CONTROL DE CAMBIOS'}
              className="campo"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Fecha real entrega</span>
            <input value={eFechaReal} onChange={(e) => setEFechaReal(e.target.value)} type="date"
              className="campo" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Estado</span>
            <select value={eEstado} onChange={(e) => {
              const nuevoEstado = e.target.value
              setEEstado(nuevoEstado)
              if (nuevoEstado.toUpperCase() !== 'APROBADA') setEMesAprobacion('')
            }}
              className="campo">
              {estadosEnt.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          {eEstado.toUpperCase() === 'APROBADA' && (
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Mes de aprobación</span>
              <select
                value={eMesAprobacion}
                onChange={(e) => setEMesAprobacion(e.target.value)}
                className="campo"
              >
                <option value="">— Seleccionar —</option>
                {MESES_ES.map((mes) => <option key={mes} value={mes}>{mes}</option>)}
              </select>
            </label>
          )}
          <label className="min-w-[280px] flex-1 text-sm">
            <span className="mb-1 block text-slate-600">Observaciones EPM</span>
            <input
              value={eObservaciones}
              onChange={(e) => setEObservaciones(e.target.value)}
              placeholder="Notas de la entrega (EPM)"
              className="campo w-full"
            />
          </label>
          <label className="min-w-[280px] flex-1 text-sm">
            <span className="mb-1 block text-slate-600">Observaciones Hitss</span>
            <input
              value={eObservacionesHitss}
              onChange={(e) => setEObservacionesHitss(e.target.value)}
              placeholder="Notas de la entrega (Hitss)"
              className="campo w-full"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Tipificación</span>
            <select
              value={eTipificacion}
              onChange={(e) => setETipificacion(e.target.value)}
              className="campo"
            >
              <option value="">— Seleccionar —</option>
              <option value="HITSS">Hitss</option>
              <option value="EPM">EPM</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={eGarantia} onChange={(e) => { setEGarantia(e.target.checked); if (e.target.checked && !eNumGarantia) setENumGarantia(1) }} />
            <span className="text-slate-600">Garantía</span>
          </label>
          {eGarantia && (
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">N° Garantía</span>
              <input type="number" min={1} value={eNumGarantia ?? ''} onChange={(e) => setENumGarantia(e.target.value ? Number(e.target.value) : null)}
                className="campo campo-sm w-20" />
            </label>
          )}
          <button className="btn btn-primario">
            {eEditando ? 'Guardar cambios' : 'Guardar entrega'}
          </button>
          {eEditando && (
            <button type="button" onClick={cancelarEdicionEntrega}
              className="btn btn-secundario">
              Cancelar
            </button>
          )}
        </form>
        )}
      </div>

      {/* Liquidación */}
      <div className="tarjeta tarjeta-pad">
        <h2 className="etiqueta-sup mb-3">
          Liquidación
        </h2>
        {liquidacion ? (
          <>
            <p className="mb-2 text-sm">
              Total: <b className="text-marca-osc">{liquidacion.total.toLocaleString()}</b>
            </p>
            <ul className="text-sm text-slate-600">
              {liquidacion.entregas.map((le) => (
                <li key={le.numero}>
                  Entrega {le.numero}:{' '}
                  {le.error ? <span className="text-amber-600">{le.error}</span> : le.valor?.toLocaleString()}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-slate-400">Sin datos de liquidación.</p>
        )}
      </div>

      {/* Bitácora */}
      <div className="tarjeta tarjeta-pad">
        <h2 className="etiqueta-sup mb-3">
          Bitácora
        </h2>
        <ul className="space-y-1 text-sm">
          {eventos.map((ev) => (
            <li key={ev.id} className="flex items-start justify-between gap-2 border-b py-1 last:border-0">
              <span>
                <span className="text-slate-400">{ev.creado_en?.slice(0, 19).replace('T', ' ')}</span>
                {' · '}<b>{ev.accion}</b> · {ev.descripcion}
                {ev.autor ? <span className="text-slate-400"> ({ev.autor})</span> : null}
              </span>
              {puedeEliminarBitacora && (
                <button
                  onClick={() => { void eliminarEvento(ev.id) }}
                  className="btn btn-peligro shrink-0"
                  title="Eliminar evento"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </li>
          ))}
          {eventos.length === 0 && <li className="text-slate-400">Sin eventos.</li>}
        </ul>
      </div>
    </div>
  )
}
