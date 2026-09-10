import type { FormEvent } from 'react'
import { TIPOS_COSTO } from '../../constantes'
import type { Aplicacion, Persona, Requerimiento } from '../../types'
import type { CamposRequerimiento } from './useRequerimientoDetalle'

interface Props {
  campos: CamposRequerimiento
  req: Requerimiento
  puedeEditarReq: boolean
  squads: Aplicacion[]
  resolverNombreSquad: (id: string) => string
  ltHitss: Persona[]
  ltEpm: Persona[]
  scrums: Persona[]
  analistas: Persona[]
  personas: Persona[]
  personasSquad: Persona[]
  scrumAsignado: Persona | null
  analistaAsignado: Persona | null
  onCambiarSquad: (codigo: string) => void
  onSubmit: (e: FormEvent) => void
}

export default function SeccionDatosGenerales({
  campos,
  req,
  puedeEditarReq,
  squads,
  resolverNombreSquad,
  ltHitss,
  ltEpm,
  scrums,
  analistas,
  personas,
  personasSquad,
  scrumAsignado,
  analistaAsignado,
  onCambiarSquad,
  onSubmit,
}: Props) {
  const { valores, actualizar } = campos

  return (
    <form onSubmit={onSubmit} className="tarjeta tarjeta-pad">
      <fieldset disabled={!puedeEditarReq}>
      <h2 className="etiqueta-sup mb-3">
        Datos generales
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Código SC</span>
          <input value={valores.codigoSc} onChange={(e) => actualizar('codigoSc', e.target.value)} required
            className="campo w-full" />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-slate-600">Nombre de acta</span>
          <input value={valores.nombreActa} onChange={(e) => actualizar('nombreActa', e.target.value)}
            className="campo w-full" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Tipo de costo</span>
          <select value={valores.tipoCosto} onChange={(e) => actualizar('tipoCosto', e.target.value)}
            className="campo w-full">
            {TIPOS_COSTO.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Squad</span>
          {/* Muestra el nombre resuelto (importados: id→nombre, manuales: codigo→nombre) */}
          <div className="mb-1 rounded border bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">
            {resolverNombreSquad(valores.squadId)}
          </div>
          {puedeEditarReq && (
            <select
              value={valores.squadId}
              onChange={(e) => onCambiarSquad(e.target.value)}
              className="campo w-full"
            >
              <option value="">— Cambiar squad —</option>
              {squads.filter((s) => s.activa).map((s) => <option key={s.codigo} value={s.codigo}>{s.nombre}</option>)}
            </select>
          )}
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Líder técnico</span>
          <select value={valores.ltHitssId} onChange={(e) => actualizar('ltHitssId', e.target.value)}
            className="campo w-full">
            <option value="">— Seleccionar —</option>
            {ltHitss.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Líder técnico EPM</span>
          <select value={valores.ltEpmId} onChange={(e) => actualizar('ltEpmId', e.target.value)}
            className="campo w-full">
            <option value="">— Seleccionar —</option>
            {ltEpm.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Scrum</span>
          <select value={valores.scrumId} onChange={(e) => actualizar('scrumId', e.target.value)}
            disabled={!valores.squadId}
            className="campo w-full">
            <option value="">{valores.squadId ? '— Seleccionar —' : 'Elige un squad primero'}</option>
            {valores.scrumId && !scrums.some((p) => p.id === valores.scrumId) && (
              <option value={valores.scrumId}>
                {personas.find((p) => p.id === valores.scrumId)?.nombre
                  ?? personasSquad.find((p) => p.id === valores.scrumId)?.nombre
                  ?? scrumAsignado?.nombre
                  ?? valores.scrumId}
              </option>
            )}
            {scrums.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Analista de requerimientos</span>
          <select value={valores.analistaId} onChange={(e) => actualizar('analistaId', e.target.value)}
            disabled={!valores.squadId}
            className="campo w-full">
            <option value="">{valores.squadId ? '— Seleccionar —' : 'Elige un squad primero'}</option>
            {valores.analistaId && !analistas.some((p) => p.id === valores.analistaId) && (
              <option value={valores.analistaId}>
                {personas.find((p) => p.id === valores.analistaId)?.nombre
                  ?? personasSquad.find((p) => p.id === valores.analistaId)?.nombre
                  ?? analistaAsignado?.nombre
                  ?? valores.analistaId}
              </option>
            )}
            {analistas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Horas estimadas</span>
          <input value={valores.horas} onChange={(e) => actualizar('horas', e.target.value)} type="number" step="any"
            className="campo w-full" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Fecha y hora de solicitud</span>
          <input value={valores.fechaSolicitudActa} onChange={(e) => actualizar('fechaSolicitudActa', e.target.value)}
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
          <input value={valores.fechaRealEntregaEst} onChange={(e) => actualizar('fechaRealEntregaEst', e.target.value)}
            type="datetime-local"
            disabled={!puedeEditarReq}
            className="campo w-full" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">ANS Estimación</span>
          {(() => {
            const cumple =
              req.fecha_limite && valores.fechaRealEntregaEst
                ? new Date(valores.fechaRealEntregaEst) <= new Date(req.fecha_limite)
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
          <input value={valores.actaTrabajo} onChange={(e) => actualizar('actaTrabajo', e.target.value)}
            disabled={!puedeEditarReq}
            placeholder="Número o referencia del acta de trabajo"
            className="campo w-full" />
        </label>
        <label className="text-sm sm:col-span-2 lg:col-span-3">
          <span className="mb-1 block text-slate-600">Seguimiento EPM</span>
          <textarea value={valores.seguimientoEpm} onChange={(e) => actualizar('seguimientoEpm', e.target.value)} rows={2}
            disabled={!puedeEditarReq}
            className="campo w-full" />
        </label>
        <label className="text-sm sm:col-span-2 lg:col-span-3">
          <span className="mb-1 block text-slate-600">Motivo de cierre</span>
          <input value={valores.motivoCierre} onChange={(e) => actualizar('motivoCierre', e.target.value)}
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
  )
}
