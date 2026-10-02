// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import Modal from '../../components/Modal'
import { Aviso, Boton, Icono, TablaScroll } from '../../components/ui'
import type { GrupoDuplicados } from './tipos'

/** Banner de aviso: hay grupos de personas duplicadas. */
export function BannerDuplicados({
  total,
  puedeFusionar,
  modoConsolidado = false,
  onVer,
}: {
  total: number
  puedeFusionar: boolean
  /** En consolidado el backend rechaza la fusión (409): el botón se deshabilita. */
  modoConsolidado?: boolean
  onVer: () => void
}) {
  const bloqueado = puedeFusionar && modoConsolidado
  const motivo = 'Elige una aplicación para fusionar duplicados'
  return (
    <Aviso tono="alerta" className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <span role="status">
        <Icono nombre="alerta" className="mr-1 inline align-text-bottom" /> Se encontraron <strong>{total}</strong>{' '}
        grupo{total === 1 ? '' : 's'} con personas duplicadas.
        {bloqueado && <span className="block text-xs">{motivo}.</span>}
      </span>
      <Boton variante="alerta" tamano="sm" onClick={onVer} disabled={bloqueado} title={bloqueado ? motivo : undefined}>
        {puedeFusionar ? 'Ver detalle y fusionar' : 'Ver detalle'}
      </Boton>
    </Aviso>
  )
}

interface Props {
  abierto: boolean
  duplicados: GrupoDuplicados[]
  puedeFusionar: boolean
  fusionando: boolean
  error: string
  onConfirmar: () => void
  onCerrar: () => void
}

/** Detalle de duplicados: qué se conserva y qué se elimina; la confirmación es este modal. */
export function ModalDuplicados({ abierto, duplicados, puedeFusionar, fusionando, error, onConfirmar, onCerrar }: Props) {
  return (
    <Modal
      titulo={`Personas duplicadas (${duplicados.length} grupo${duplicados.length === 1 ? '' : 's'})`}
      abierto={abierto}
      onCerrar={onCerrar}
    >
      <div className="space-y-4 text-sm">
        <p className="text-slate-500">
          Se conservará la persona con mayor información (email, squads, usuario vinculado). Las demás se eliminarán y sus
          referencias serán redirigidas automáticamente.
        </p>
        {error && (
          <Aviso tono="error">
            <span role="alert">{error}</span>
          </Aviso>
        )}
        <div className="max-h-96 space-y-3 overflow-auto">
          {duplicados.map((g) => (
            <div key={`${g.nombre}-${g.rol}`} className="rounded border bg-slate-50 p-3">
              <div className="mb-2 font-semibold text-slate-700">
                {g.nombre} <span className="ml-2 text-xs font-normal text-slate-500">[{g.rol}]</span>
                <span className="ml-2 text-xs text-amber-700">{g.total} registros</span>
              </div>
              <TablaScroll>
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Email</th>
                      <th>Squads</th>
                      <th>App</th>
                      <th className="text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-emerald-50">
                      <td className="font-medium text-emerald-700">
                        <span className="inline-flex items-center gap-1">
                          <Icono nombre="check-circulo" /> {g.ganador.nombre}
                        </span>
                      </td>
                      <td>{g.ganador.email ?? '—'}</td>
                      <td>{g.ganador.squads.join(', ') || '—'}</td>
                      <td>{g.ganador.aplicacion_id}</td>
                      <td className="text-center text-emerald-700">Conservar</td>
                    </tr>
                    {g.duplicados.map((d) => (
                      <tr key={d.id} className="bg-red-50">
                        <td className="text-red-700">
                          <span className="inline-flex items-center gap-1">
                            <Icono nombre="papelera" /> {d.nombre}
                          </span>
                        </td>
                        <td>{d.email ?? '—'}</td>
                        <td>{d.squads.join(', ') || '—'}</td>
                        <td>{d.aplicacion_id}</td>
                        <td className="text-center text-red-600">Eliminar</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TablaScroll>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Boton variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          {puedeFusionar && (
            <Boton variante="alerta" onClick={onConfirmar} disabled={fusionando || duplicados.length === 0}>
              {fusionando ? 'Fusionando…' : 'Confirmar fusión'}
            </Boton>
          )}
        </div>
      </div>
    </Modal>
  )
}
