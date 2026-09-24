// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useState } from 'react'
import type { FormEvent } from 'react'
import client from '../../api/client'
import { mensajeError } from '../../api/hooks'
import { AreaTexto, Aviso, Boton, Campo, Selector } from '../../components/ui'
import { TIPOS_COSTO } from '../../constantes'
import type { Aplicacion, Persona, Requerimiento } from '../../types'
import type { CamposRequerimiento } from './useRequerimientoDetalle'

/** Id del `<form>`; el botón "Guardar cambios" del encabezado lo referencia
 * con el atributo HTML `form` para poder vivir fuera del propio formulario. */
export const ID_FORMULARIO_DATOS_GENERALES = 'formulario-datos-generales'

/**
 * Campo "ID de Azure (Hitss)" con guardado propio (PATCH independiente del
 * `guardar()` general del formulario), para que quien solo tenga
 * `requerimientos.id_azure_hitss.editar` (sin `requerimientos.editar`) pueda
 * editarlo sin pasar por el botón "Guardar cambios" (gateado por el permiso
 * general, que le devolvería 403).
 */
function CampoIdAzureHitss({
  reqId,
  valorInicial,
  puedeEditar,
  onGuardado,
}: {
  reqId: string
  valorInicial: number | null
  puedeEditar: boolean
  onGuardado: () => void
}) {
  const [valor, setValor] = useState(valorInicial != null ? String(valorInicial) : '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  if (!puedeEditar) {
    return (
      <label className="text-sm">
        <span className="mb-1 block text-slate-600">ID de Azure (Hitss)</span>
        <Campo
          value={valorInicial != null ? String(valorInicial) : ''}
          type="number" disabled
          placeholder="ID del work item en Azure DevOps"
          className="w-full" />
      </label>
    )
  }

  const valorGuardado = valorInicial != null ? String(valorInicial) : ''
  const modificado = valor !== valorGuardado

  async function guardar(): Promise<void> {
    setGuardando(true)
    setError('')
    try {
      const nuevoValor = valor.trim() ? Number(valor) : null
      await client.patch(`/requerimientos/${reqId}/id-azure-hitss`, { id_azure_hitss: nuevoValor })
      setValor(nuevoValor != null ? String(nuevoValor) : '')
      onGuardado()
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <label className="text-sm">
      <span className="mb-1 block text-slate-600">ID de Azure (Hitss)</span>
      <div className="flex items-center gap-2">
        <Campo
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          type="number"
          placeholder="ID del work item en Azure DevOps"
          className="w-full" />
        {modificado && (
          <Boton variante="secundario" tamano="sm" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Boton>
        )}
      </div>
      {error && <Aviso tono="error" className="mt-1">{error}</Aviso>}
    </label>
  )
}

interface Props {
  campos: CamposRequerimiento
  req: Requerimiento
  puedeEditarReq: boolean
  puedeEditarIdAzure: boolean
  onGuardadoIdAzure: () => void
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
  puedeEditarIdAzure,
  onGuardadoIdAzure,
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
    <form id={ID_FORMULARIO_DATOS_GENERALES} onSubmit={onSubmit} className="tarjeta tarjeta-pad">
      <h2 className="etiqueta-sup mb-3">
        Datos generales
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
      {/* `display: contents` saca al fieldset del flujo del grid (sus hijos
          participan directamente en las columnas, como si no existiera
          visualmente) sin anular el `disabled` HTML, que sigue aplicando a
          todos sus descendientes. Así el campo de ID de Azure, que vive
          fuera de este fieldset, puede tener su propio permiso/guardado. */}
      <fieldset disabled={!puedeEditarReq} style={{ display: 'contents' }}>
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
          <span className="mb-1 block text-slate-600">Acta de trabajo</span>
          <Campo value={valores.actaTrabajo} onChange={(e) => actualizar('actaTrabajo', e.target.value)}
            disabled={!puedeEditarReq}
            placeholder="Número o referencia del acta de trabajo"
            className="w-full" />
        </label>
      </fieldset>
      <CampoIdAzureHitss
        reqId={req.id}
        valorInicial={req.id_azure_hitss}
        puedeEditar={puedeEditarIdAzure}
        onGuardado={onGuardadoIdAzure}
      />
      <fieldset disabled={!puedeEditarReq} style={{ display: 'contents' }}>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-slate-600">Seguimiento EPM</span>
          <AreaTexto value={valores.seguimientoEpm} onChange={(e) => actualizar('seguimientoEpm', e.target.value)} rows={2}
            disabled={!puedeEditarReq}
            className="w-full" />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-slate-600">Motivo de cierre</span>
          <Campo value={valores.motivoCierre} onChange={(e) => actualizar('motivoCierre', e.target.value)}
            className="w-full" />
        </label>
      </fieldset>
      </div>
    </form>
  )
}
