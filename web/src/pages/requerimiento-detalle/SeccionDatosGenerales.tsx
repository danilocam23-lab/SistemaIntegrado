import type { FormEvent } from 'react'
import { AreaTexto, Boton, Campo, Chip, Selector } from '../../components/ui'
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
          <Campo value={valores.codigoSc} onChange={(e) => actualizar('codigoSc', e.target.value)} required
            className="w-full" />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-slate-600">Nombre de acta</span>
          <Campo value={valores.nombreActa} onChange={(e) => actualizar('nombreActa', e.target.value)}
            className="w-full" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Tipo de costo</span>
          <Selector value={valores.tipoCosto} onChange={(e) => actualizar('tipoCosto', e.target.value)}
            className="w-full">
            {TIPOS_COSTO.map((t) => <option key={t} value={t}>{t}</option>)}
          </Selector>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Squad</span>
          {/* Muestra el nombre resuelto (importados: id→nombre, manuales: codigo→nombre) */}
          <div className="mb-1 rounded border bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">
            {resolverNombreSquad(valores.squadId)}
          </div>
          {puedeEditarReq && (
            <Selector
              value={valores.squadId}
              onChange={(e) => onCambiarSquad(e.target.value)}
              className="w-full"
            >
              <option value="">— Cambiar squad —</option>
              {squads.filter((s) => s.activa).map((s) => <option key={s.codigo} value={s.codigo}>{s.nombre}</option>)}
            </Selector>
          )}
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Líder técnico</span>
          <Selector value={valores.ltHitssId} onChange={(e) => actualizar('ltHitssId', e.target.value)}
            className="w-full">
            <option value="">— Seleccionar —</option>
            {ltHitss.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </Selector>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Líder técnico EPM</span>
          <Selector value={valores.ltEpmId} onChange={(e) => actualizar('ltEpmId', e.target.value)}
            className="w-full">
            <option value="">— Seleccionar —</option>
            {ltEpm.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </Selector>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Scrum</span>
          <Selector value={valores.scrumId} onChange={(e) => actualizar('scrumId', e.target.value)}
            disabled={!valores.squadId}
            className="w-full">
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
          </Selector>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Analista de requerimientos</span>
          <Selector value={valores.analistaId} onChange={(e) => actualizar('analistaId', e.target.value)}
            disabled={!valores.squadId}
            className="w-full">
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
          </Selector>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Horas estimadas</span>
          <Campo value={valores.horas} onChange={(e) => actualizar('horas', e.target.value)} type="number" step="any"
            className="w-full" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Fecha y hora de solicitud</span>
          <Campo value={valores.fechaSolicitudActa} onChange={(e) => actualizar('fechaSolicitudActa', e.target.value)}
            type="datetime-local" className="w-full" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Fecha límite</span>
          <Campo
            value={req.fecha_limite ? req.fecha_limite.slice(0, 16).replace('T', ' ') : '—'}
            readOnly disabled
            className="w-full" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Fecha real entrega de estimaciones</span>
          <Campo value={valores.fechaRealEntregaEst} onChange={(e) => actualizar('fechaRealEntregaEst', e.target.value)}
            type="datetime-local"
            disabled={!puedeEditarReq}
            className="w-full" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">ANS Estimación</span>
          {(() => {
            const cumple =
              req.fecha_limite && valores.fechaRealEntregaEst
                ? new Date(valores.fechaRealEntregaEst) <= new Date(req.fecha_limite)
                : null
            return (
              <Chip tono={cumple === true ? 'exito' : cumple === false ? 'error' : 'neutro'}>
                {cumple === true ? 'Cumple' : cumple === false ? 'No cumple' : '—'}
              </Chip>
            )
          })()}
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Cantidad de entregas</span>
          <Campo value={req.entregas.length} readOnly disabled
            className="w-full" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Acta de trabajo</span>
          <Campo value={valores.actaTrabajo} onChange={(e) => actualizar('actaTrabajo', e.target.value)}
            disabled={!puedeEditarReq}
            placeholder="Número o referencia del acta de trabajo"
            className="w-full" />
        </label>
        <label className="text-sm sm:col-span-2 lg:col-span-3">
          <span className="mb-1 block text-slate-600">Seguimiento EPM</span>
          <AreaTexto value={valores.seguimientoEpm} onChange={(e) => actualizar('seguimientoEpm', e.target.value)} rows={2}
            disabled={!puedeEditarReq}
            className="w-full" />
        </label>
        <label className="text-sm sm:col-span-2 lg:col-span-3">
          <span className="mb-1 block text-slate-600">Motivo de cierre</span>
          <Campo value={valores.motivoCierre} onChange={(e) => actualizar('motivoCierre', e.target.value)}
            className="w-full" />
        </label>
      </div>
      </fieldset>
      {puedeEditarReq && (
        <Boton variante="primario" type="submit" className="mt-3">
          Guardar cambios
        </Boton>
      )}
    </form>
  )
}
