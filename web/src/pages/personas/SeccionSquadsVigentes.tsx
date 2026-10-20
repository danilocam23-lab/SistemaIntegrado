// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useMemo, useState } from 'react'
import { useLista } from '../../api/hooks'
import { Aviso, Boton, Chip } from '../../components/ui'
import type { Aplicacion, Membresia, Persona } from '../../types'
import { EditorFechasMembresia } from './EditorFechasMembresia'
import { fechaCorta, hoyISO } from './formatoFecha'
import { ModalAbrirSquad } from './ModalAbrirSquad'
import { ModalDesactivarSquad } from './ModalDesactivarSquad'
import { ModalEliminarSquad } from './ModalEliminarSquad'

interface Props {
  persona: Persona
  aplicaciones: Aplicacion[]
  puedeEditar: boolean
  /** Cambió alguna membresía: refrescar el listado de personas (squads derivados). */
  onCambio: () => void
  /** La persona se desactivó desde el aviso de «último squad»: el panel debe cerrarse y recargar. */
  onPersonaDesactivada: () => void
}

type Dialogo =
  | { tipo: 'cerrar'; membresia: Membresia }
  | { tipo: 'eliminar'; membresia: Membresia }
  | { tipo: 'abrir'; squadFijo?: string }

function EstadoMembresia({ m, hoy }: { m: Membresia; hoy: string }) {
  const desde = m.desde?.slice(0, 10) ?? null
  const hasta = m.hasta?.slice(0, 10) ?? null
  if (m.activo) {
    return desde && desde > hoy ? (
      <Chip tono="alerta">Desde {fechaCorta(m.desde)}</Chip>
    ) : (
      <Chip tono="exito">Activo</Chip>
    )
  }
  // `hasta` es el último día activo (incluido): hasta hoy o después sigue vigente.
  if (hasta && hasta >= hoy) return <Chip tono="alerta">Activo hasta {fechaCorta(m.hasta)}</Chip>
  return <Chip tono="neutro">Hasta {fechaCorta(m.hasta)}</Chip>
}

/** Squads vigentes de una persona con sus acciones (desactivar/reabrir/agregar) — ADR-0010. */
export function SeccionSquadsVigentes({ persona, aplicaciones, puedeEditar, onCambio, onPersonaDesactivada }: Props) {
  const { datos, cargando, error, recargar } = useLista<Membresia>(`/membresias/persona/${persona.id}`)
  const [dialogo, setDialogo] = useState<Dialogo | null>(null)
  const hoy = hoyISO()

  const nombrePorCodigo = useMemo(() => new Map(aplicaciones.map((a) => [a.codigo, a.nombre])), [aplicaciones])
  const nombreSquad = (codigo: string) => nombrePorCodigo.get(codigo) ?? codigo

  const filas = useMemo(() => {
    const nombre = (codigo: string) => nombrePorCodigo.get(codigo) ?? codigo
    return [...datos].sort((a, b) => nombre(a.squad_id).localeCompare(nombre(b.squad_id)) || (a.desde ?? '').localeCompare(b.desde ?? ''))
  }, [datos, nombrePorCodigo])
  const conAbierta = useMemo(() => new Set(datos.filter((m) => m.activo).map((m) => m.squad_id)), [datos])
  // Última fila de cada squad (la más reciente): es la única que se puede reabrir.
  const ultimaPorSquad = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const m of filas) mapa.set(m.squad_id, m.id)
    return mapa
  }, [filas])

  // Vigentes: abiertas o cerradas cuyo último día activo es hoy o posterior. Historial: el resto.
  const esVigente = (m: Membresia) => m.activo || (!!m.hasta && m.hasta.slice(0, 10) >= hoy)
  const vigentes = filas.filter(esVigente)
  const historial = filas.filter((m) => !esVigente(m))

  const opcionesAgregar = aplicaciones.filter((a) => a.activa && !conAbierta.has(a.codigo))
  const puedeActuar = puedeEditar && persona.activo

  function alCambiar(): void {
    recargar()
    onCambio()
  }

  return (
    <div className="space-y-3">
      {error && (
        <Aviso tono="error">
          <span role="alert" className="flex flex-wrap items-center justify-between gap-2">
            {error}
            <Boton tamano="sm" onClick={recargar}>Reintentar</Boton>
          </span>
        </Aviso>
      )}

      {cargando && datos.length === 0 && !error && <p className="text-sm text-slate-500">Cargando squads…</p>}
      {!cargando && !error && vigentes.length === 0 && <span className="text-xs text-slate-400">Sin squads vigentes</span>}

      {vigentes.length > 0 && (
        <ul className="space-y-2">
          {vigentes.map((m) => {
            const nombre = nombreSquad(m.squad_id)
            return (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="text-sm font-semibold text-slate-700">{nombre}</span>
                  <EstadoMembresia m={m} hoy={hoy} />
                </span>
                {puedeActuar && m.activo && (
                  <Boton
                    tamano="sm"
                    variante="peligro-suave"
                    aria-label={`Desactivar a ${persona.nombre} en el squad ${nombre}`}
                    onClick={() => setDialogo({ tipo: 'cerrar', membresia: m })}
                  >
                    Desactivar en este squad…
                  </Boton>
                )}
                {puedeEditar && (
                  <Boton
                    tamano="sm"
                    variante="peligro-suave"
                    aria-label={`Eliminar el squad ${nombre} de ${persona.nombre}`}
                    onClick={() => setDialogo({ tipo: 'eliminar', membresia: m })}
                  >
                    Eliminar…
                  </Boton>
                )}
                <EditorFechasMembresia
                  key={`${m.id}-${m.desde}-${m.hasta}`}
                  membresia={m}
                  nombreSquad={nombre}
                  puedeEditar={puedeEditar}
                  onGuardada={alCambiar}
                />
              </li>
            )
          })}
        </ul>
      )}

      {historial.length > 0 && (
        <details className="rounded-lg border border-slate-100 px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold text-slate-600">
            Historial de squads ({historial.length})
          </summary>
          <ul className="mt-2 space-y-2">
            {historial.map((m) => {
              const nombre = nombreSquad(m.squad_id)
              const reabrible = !conAbierta.has(m.squad_id) && ultimaPorSquad.get(m.squad_id) === m.id
              return (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span className="text-sm text-slate-700">{nombre}</span>
                    <EstadoMembresia m={m} hoy={hoy} />
                  </span>
                  {puedeActuar && reabrible && (
                    <Boton
                      tamano="sm"
                      aria-label={`Reabrir el squad ${nombre}`}
                      onClick={() => setDialogo({ tipo: 'abrir', squadFijo: m.squad_id })}
                    >
                      Reabrir…
                    </Boton>
                  )}
                  {puedeEditar && (
                    <Boton
                      tamano="sm"
                      variante="peligro-suave"
                      aria-label={`Eliminar el squad ${nombre} de ${persona.nombre}`}
                      onClick={() => setDialogo({ tipo: 'eliminar', membresia: m })}
                    >
                      Eliminar…
                    </Boton>
                  )}
                  <EditorFechasMembresia
                    key={`${m.id}-${m.desde}-${m.hasta}`}
                    membresia={m}
                    nombreSquad={nombre}
                    puedeEditar={puedeEditar}
                    onGuardada={alCambiar}
                  />
                </li>
              )
            })}
          </ul>
        </details>
      )}

      {puedeActuar && (
        <Boton onClick={() => setDialogo({ tipo: 'abrir' })} disabled={opcionesAgregar.length === 0}>
          + Agregar a un squad
        </Boton>
      )}

      {dialogo?.tipo === 'cerrar' && (
        <ModalDesactivarSquad
          persona={persona}
          membresia={dialogo.membresia}
          nombreSquad={nombreSquad(dialogo.membresia.squad_id)}
          onCerrar={() => setDialogo(null)}
          onCerrada={alCambiar}
          onPersonaDesactivada={onPersonaDesactivada}
        />
      )}
      {dialogo?.tipo === 'eliminar' && (
        <ModalEliminarSquad
          persona={persona}
          membresia={dialogo.membresia}
          nombreSquad={nombreSquad(dialogo.membresia.squad_id)}
          onCerrar={() => setDialogo(null)}
          onEliminada={alCambiar}
        />
      )}
      {dialogo?.tipo === 'abrir' && (
        <ModalAbrirSquad
          persona={persona}
          opciones={dialogo.squadFijo ? aplicaciones.filter((a) => a.codigo === dialogo.squadFijo) : opcionesAgregar}
          squadFijo={dialogo.squadFijo}
          onCerrar={() => setDialogo(null)}
          onAbierta={alCambiar}
        />
      )}
    </div>
  )
}
