import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import client from '../api/client'
import { mensajeError, useLista, useEstados } from '../api/hooks'
import { useAplicacion } from '../context/AplicacionContext'
import { useAuth } from '../context/AuthContext'
import { TIPOS_COSTO } from '../constantes'
import type { Aplicacion, EventoBitacora, Liquidacion, Persona, Requerimiento, Squad } from '../types'
import { useHistorialEstados } from './requerimiento-detalle/useHistorialEstados'
import ModalHistorialEstados from './requerimiento-detalle/ModalHistorialEstados'
import SeccionLiquidacion from './requerimiento-detalle/SeccionLiquidacion'
import SeccionBitacora from './requerimiento-detalle/SeccionBitacora'
import SeccionEntregas from './requerimiento-detalle/SeccionEntregas'
import FormularioEntrega from './requerimiento-detalle/FormularioEntrega'
import { useFormularioEntrega } from './requerimiento-detalle/useFormularioEntrega'

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
  const [analistaId, setAnalistaId] = useState('')
  const [horas, setHoras] = useState('')
  const [fechaSolicitudActa, setFechaSolicitudActa] = useState('')
  const [fechaRealEntregaEst, setFechaRealEntregaEst] = useState('')
  const [seguimiento, setSeguimiento] = useState('')
  const [seguimientoEpm, setSeguimientoEpm] = useState('')
  const [tipificacion, setTipificacion] = useState('')
  const [motivoCierre, setMotivoCierre] = useState('')
  const [actaTrabajo, setActaTrabajo] = useState('')

  // Formulario de entrega (estados + lógica de cargar/cancelar/limpiar)
  const form = useFormularioEntrega(estadosEnt)

  // Edición inline de Observaciones Hitss / Tipificación por entrega
  // (visible para quienes tengan requerimientos.tipificacion.editar aunque no
  // tengan requerimientos.editar completo).
  const [tipifEdicion, setTipifEdicion] = useState<Record<number, { obs: string; tip: string }>>({})
  const [guardandoTipif, setGuardandoTipif] = useState<Set<number>>(new Set())

  // Historial de estados (popup con cuánto tiempo estuvo en cada estado y a
  // cuál pasó) tanto del requerimiento como de una entrega puntual.
  const historial = useHistorialEstados(reqId)

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

  function cambiarTipifEntregaInline(numero: number, campo: 'obs' | 'tip', valor: string): void {
    setTipifEdicion((p) => ({ ...p, [numero]: { ...p[numero], [campo]: valor } }))
  }

  function cancelarTipifEntregaInline(numero: number): void {
    setTipifEdicion((p) => { const n = { ...p }; delete n[numero]; return n })
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
      setAnalistaId(data.solicitud?.analista_requerimientos_id ?? '')
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

  const ltHitss = personas.filter((p) => p.activo && p.rol_operativo === 'LT_HITSS')
  const ltEpm = personas.filter((p) => p.activo && p.rol_operativo === 'LT_EPM')

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
    (p) => p.activo && p.rol_operativo === 'SCRUM' && (
      personasSquad.length > 0 || !squadNombre || squadNombre === '—' || (p.squads ?? []).includes(squadNombre)
    ),
  )

  // Analistas de requerimientos: personas activas con rol Scrum o AR/QA del squad seleccionado.
  const analistas = (personasSquad.length > 0 ? personasSquad : personas).filter(
    (p) => p.activo && (p.rol_operativo === 'SCRUM' || p.rol_operativo === 'AR/QA') && (
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

  // Respaldo equivalente para el analista de requerimientos asignado.
  const [analistaAsignado, setAnalistaAsignado] = useState<Persona | null>(null)
  useEffect(() => {
    if (!analistaId) {
      setAnalistaAsignado(null)
      return
    }
    if (personas.some((p) => p.id === analistaId) || personasSquad.some((p) => p.id === analistaId)) {
      setAnalistaAsignado(null)
      return
    }
    client.get<Persona>(`/personas/${analistaId}`, { headers: { 'X-Aplicacion': '__todas__' } })
      .then((r) => setAnalistaAsignado(r.data))
      .catch(() => setAnalistaAsignado(null))
  }, [analistaId, personas, personasSquad])

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
          analista_requerimientos_id: analistaId || null,
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
      await client.post(`/requerimientos/${reqId}/entregas`, form.cuerpoEntrega(), writeConfig())
      form.limpiarTrasGuardar()
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
                onChange={(e) => { setSquadId(e.target.value); setScrumId(''); setAnalistaId('') }}
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
            <span className="mb-1 block text-slate-600">Analista de requerimientos</span>
            <select value={analistaId} onChange={(e) => setAnalistaId(e.target.value)}
              disabled={!squadId}
              className="campo w-full">
              <option value="">{squadId ? '— Seleccionar —' : 'Elige un squad primero'}</option>
              {analistaId && !analistas.some((p) => p.id === analistaId) && (
                <option value={analistaId}>
                  {personas.find((p) => p.id === analistaId)?.nombre
                    ?? personasSquad.find((p) => p.id === analistaId)?.nombre
                    ?? analistaAsignado?.nombre
                    ?? analistaId}
                </option>
              )}
              {analistas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
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
        <div>
          <button type="button" onClick={historial.verHistorialRequerimiento}
            className="btn btn-secundario mt-3">
            Historial de estados
          </button>
        </div>
      </div>

      {/* Entregas */}
      <SeccionEntregas
        entregas={req.entregas}
        totalHorasEstimadas={req.total_horas_estimadas}
        puedeEditarReq={puedeEditarReq}
        puedeEditarTipificacion={puedeEditarTipificacion}
        tipifEdicion={tipifEdicion}
        guardandoTipif={guardandoTipif}
        onIniciarEdicionTipif={iniciarEdicionTipifEntrega}
        onCambiarTipif={cambiarTipifEntregaInline}
        onCancelarTipif={cancelarTipifEntregaInline}
        onGuardarTipif={guardarTipifEntregaInline}
        onVerHistorialEntrega={historial.verHistorialEntrega}
        onEditarEntrega={form.cargarEntrega}
        onEliminarEntrega={eliminarEntrega}
      >
        {puedeEditarReq && (
          <FormularioEntrega
            form={form}
            estadosEnt={estadosEnt}
            estadoRequerimiento={req?.estado ?? ''}
            onSubmit={agregarEntrega}
            onVerHistorial={() => historial.verHistorialEntrega(form.valores.numero)}
          />
        )}
      </SeccionEntregas>

      {/* Liquidación */}
      <SeccionLiquidacion liquidacion={liquidacion} />

      {/* Bitácora */}
      <SeccionBitacora
        eventos={eventos}
        puedeEliminar={puedeEliminarBitacora}
        onEliminar={eliminarEvento}
      />

      <ModalHistorialEstados
        titulo={historial.titulo}
        abierto={historial.abierto}
        cargando={historial.cargando}
        error={historial.error}
        segmentos={historial.segmentos}
        onCerrar={historial.cerrar}
      />
    </div>
  )
}
