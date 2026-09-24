// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useEffect, useState } from 'react'
import client from '../../api/client'
import { Aviso, Boton } from '../../components/ui'
import { CLAVE_USUARIO_ESQUEMA } from '../../components/azure/useConfigPersonaAzure'
import type { Persona } from '../../types'
import type { GrupoDetalleAzure, RespuestaDetalleAzure } from './tipos'

interface Props {
  idAzureHitss: number
  reqLabel: string
  personaPorEmail: Map<string, Persona>
  onCerrar: () => void
}

/** Resuelve el nombre de una persona a partir de su email (o "Sin persona" si no hay email). */
function nombrePorEmail(email: string | null, personaPorEmail: Map<string, Persona>): string {
  if (!email) return 'Sin persona'
  const persona = personaPorEmail.get(email.trim().toLowerCase())
  return persona?.nombre ?? email
}

function TablaDetalle({
  titulo,
  grupos,
  personaPorEmail,
}: {
  titulo: string
  grupos: GrupoDetalleAzure[]
  personaPorEmail: Map<string, Persona>
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-700">{titulo}</h3>
      {grupos.length === 0 ? (
        <p className="text-sm text-slate-400">Sin datos.</p>
      ) : (
        <table className="tabla">
          <thead>
            <tr>
              <th className="text-left">Clave</th>
              <th className="text-right">Horas</th>
              <th className="text-left">Por persona</th>
            </tr>
          </thead>
          <tbody>
            {grupos.map((grupo) => (
              <tr key={grupo.clave}>
                <td>{grupo.clave}</td>
                <td className="text-right font-medium">{grupo.total_horas.toFixed(1)} h</td>
                <td className="text-slate-600">
                  {grupo.personas
                    .map((p) => `${nombrePorEmail(p.email, personaPorEmail)}: ${p.horas.toFixed(1)}h`)
                    .join(' · ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

/**
 * Modal con el desglose de horas de Azure DevOps (Tasks + Bugs de la Feature
 * vinculada al requerimiento) agrupadas por Sprint y por Mes (según Start Date).
 */
export function ModalDetalleHorasAzure({ idAzureHitss, reqLabel, personaPorEmail, onCerrar }: Props) {
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [respuesta, setRespuesta] = useState<RespuestaDetalleAzure | null>(null)

  useEffect(() => {
    setCargando(true)
    setError('')
    const usuarioId = window.localStorage.getItem(CLAVE_USUARIO_ESQUEMA)
    const parametroUsuario = usuarioId ? `&usuario_id=${usuarioId}` : ''
    client
      .get<RespuestaDetalleAzure>(
        `/azdo/esquema/detalle-feature?id=${idAzureHitss}&target=hitss${parametroUsuario}`,
      )
      .then((r) => setRespuesta(r.data))
      .catch(() => setError('No fue posible cargar el detalle de horas de Azure.'))
      .finally(() => setCargando(false))
  }, [idAzureHitss])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <h2 className="titulo-seccion">Detalle de horas — {reqLabel}</h2>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar detalle de horas de Azure"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[70vh] space-y-6 overflow-auto p-6">
          {cargando && <p className="text-sm text-slate-400">Cargando…</p>}
          {!cargando && error && <Aviso tono="error">{error}</Aviso>}
          {!cargando && !error && respuesta && (
            <>
              <TablaDetalle titulo="Por Sprint" grupos={respuesta.por_sprint} personaPorEmail={personaPorEmail} />
              <TablaDetalle
                titulo="Por Mes (según Start Date de la tarea)"
                grupos={respuesta.por_mes}
                personaPorEmail={personaPorEmail}
              />
            </>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-200 px-6 py-4">
          <Boton variante="secundario" onClick={onCerrar}>
            Cerrar
          </Boton>
        </div>
      </div>
    </div>
  )
}
