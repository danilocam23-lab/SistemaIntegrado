import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import client from '../api/client'
import { mensajeError, useLista, useEstados } from '../api/hooks'
import { useAplicacion } from '../context/AplicacionContext'
import { useAuth } from '../context/AuthContext'
import { TIPOS_COSTO } from '../constantes'
import type { Aplicacion, Persona } from '../types'

export default function RequerimientoNuevo() {
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const { modoConsolidado } = useAplicacion()
  const esSuperadmin = usuario?.rol === 'superadmin'
  const { datos: personas } = useLista<Persona>('/personas')
  const { datos: squads } = useLista<Aplicacion>('/aplicaciones')
  const { estadosReq } = useEstados()

  const [codigoSc, setCodigoSc] = useState('')
  const [codigoReq, setCodigoReq] = useState('')
  const [nombre, setNombre] = useState('')
  const [tipoCosto, setTipoCosto] = useState('TYM')
  const [squadId, setSquadId] = useState('')
  const [ltHitssId, setLtHitssId] = useState('')
  const [ltEpmId, setLtEpmId] = useState('')
  const [scrumId, setScrumId] = useState('')
  const [horas, setHoras] = useState('')
  const [fechaSolicitud, setFechaSolicitud] = useState('')
  const [seguimiento, setSeguimiento] = useState('')
  const [aplicacionDestino, setAplicacionDestino] = useState('')
  const [aviso, setAviso] = useState('')

  // Líderes técnicos por rol; el Scrum se filtra por el squad seleccionado.
  const ltHitss = personas.filter((p) => p.rol_operativo === 'LT_HITSS')
  const ltEpm = personas.filter((p) => p.rol_operativo === 'LT_EPM')
  const squadNombre = squads.find((s) => s.codigo === squadId)?.nombre
  const scrums = personas.filter(
    (p) => p.rol_operativo === 'SCRUM' && (!squadNombre || (p.squads ?? []).includes(squadNombre)),
  )

  function cambiarSquad(valor: string): void {
    setSquadId(valor)
    setScrumId('')
  }

  async function crear(e: FormEvent): Promise<void> {
    e.preventDefault()
    setAviso('')

    // En modo consolidado el superadmin debe elegir un squad destino
    if (modoConsolidado && !aplicacionDestino) {
      setAviso('En modo "Todos los squads" debes seleccionar el squad destino del requerimiento.')
      return
    }

    // Override del header X-Aplicacion cuando estamos en modo consolidado
    const config = modoConsolidado ? { headers: { 'X-Aplicacion': aplicacionDestino } } : {}

    try {
      const resp = await client.post<{ id: string }>('/requerimientos', {
        codigo_req: codigoReq,
        nombre,
        solicitud: {
          codigo_sc: codigoSc,
          tipo_costo: tipoCosto,
          squad_id: squadId || null,
          lt_hitss_id: ltHitssId || null,
          lt_epm_id: ltEpmId || null,
          scrum_id: scrumId || null,
        },
        estado: estadosReq[0],
        total_horas_estimadas: horas ? Number(horas) : null,
        fecha_solicitud_acta: fechaSolicitud || null,
        seguimiento: seguimiento || null,
      }, config)
      navigate(`/requerimientos/${resp.data.id}`)
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/requerimientos" className="text-sm text-marca hover:underline">
          ← Requerimientos
        </Link>
        <h1 className="mt-1 text-xl font-bold text-marca-osc">Nuevo Requerimiento</h1>
      </div>

      {aviso && <div className="rounded bg-red-50 p-2 text-sm text-red-700">{aviso}</div>}

      {modoConsolidado && !esSuperadmin && (
        <div className="rounded bg-amber-50 p-3 text-sm text-amber-700">
          La creación de requerimientos en modo consolidado solo está disponible para superadmin.
        </div>
      )}

      <form onSubmit={crear} className="rounded-xl border bg-white p-4">
        {modoConsolidado && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <label className="text-sm">
              <span className="mb-1 block font-semibold text-blue-800">
                Squad destino <span className="text-red-500">*</span>
              </span>
              <p className="mb-2 text-xs text-blue-600">
                Estás en modo "Todos los squads". Selecciona el squad al que pertenecerá este requerimiento.
              </p>
              <select
                value={aplicacionDestino}
                onChange={(e) => setAplicacionDestino(e.target.value)}
                required
                className="w-full rounded border px-3 py-2 text-sm"
              >
                <option value="">— Seleccionar squad destino —</option>
                {squads.filter((s) => s.activa).map((s) => (
                  <option key={s.codigo} value={s.codigo}>{s.nombre}</option>
                ))}
              </select>
            </label>
          </div>
        )}
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Datos generales
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Código SC *</span>
            <input value={codigoSc} onChange={(e) => setCodigoSc(e.target.value)} required
              placeholder="11110" className="w-full rounded border px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Código REQ *</span>
            <input value={codigoReq} onChange={(e) => setCodigoReq(e.target.value)} required
              placeholder="RP-SSC-0964" className="w-full rounded border px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Nombre</span>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del requerimiento" className="w-full rounded border px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Tipo de costo</span>
            <select value={tipoCosto} onChange={(e) => setTipoCosto(e.target.value)}
              className="w-full rounded border px-3 py-2">
              {TIPOS_COSTO.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Squad</span>
            <select value={squadId} onChange={(e) => cambiarSquad(e.target.value)}
              className="w-full rounded border px-3 py-2">
              <option value="">— Seleccionar —</option>
              {squads.filter((s) => s.activa).map((s) => <option key={s.codigo} value={s.codigo}>{s.nombre}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Líder técnico</span>
            <select value={ltHitssId} onChange={(e) => setLtHitssId(e.target.value)}
              className="w-full rounded border px-3 py-2">
              <option value="">— Seleccionar —</option>
              {ltHitss.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Líder técnico EPM</span>
            <select value={ltEpmId} onChange={(e) => setLtEpmId(e.target.value)}
              className="w-full rounded border px-3 py-2">
              <option value="">— Seleccionar —</option>
              {ltEpm.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Scrum</span>
            <select value={scrumId} onChange={(e) => setScrumId(e.target.value)}
              disabled={!squadId}
              className="w-full rounded border px-3 py-2 disabled:bg-slate-100">
              <option value="">{squadId ? '— Seleccionar —' : 'Elige un squad primero'}</option>
              {scrums.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Horas estimadas</span>
            <input value={horas} onChange={(e) => setHoras(e.target.value)} type="number" step="any"
              className="w-full rounded border px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Fecha y hora de solicitud</span>
            <input value={fechaSolicitud} onChange={(e) => setFechaSolicitud(e.target.value)}
              type="datetime-local" className="w-full rounded border px-3 py-2" />
          </label>
          <label className="text-sm sm:col-span-2 lg:col-span-3">
            <span className="mb-1 block text-slate-600">Seguimiento</span>
            <textarea value={seguimiento} onChange={(e) => setSeguimiento(e.target.value)} rows={2}
              className="w-full rounded border px-3 py-2" />
          </label>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          La cantidad de entregas inicia en 0 y se calcula automáticamente al registrar
          entregas en el requerimiento.
        </p>
        <button className="mt-4 rounded bg-marca px-6 py-2 text-white hover:bg-marca-osc">
          Crear requerimiento
        </button>
      </form>
    </div>
  )
}
