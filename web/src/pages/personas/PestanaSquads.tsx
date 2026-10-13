// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useMemo, useState } from 'react'
import { useLista } from '../../api/hooks'
import { Aviso, Boton, Chip, TablaScroll } from '../../components/ui'
import type { Aplicacion, Membresia, Persona } from '../../types'
import { fechaCorta, hoyISO } from './formatoFecha'
import { ModalAbrirSquad } from './ModalAbrirSquad'
import { ModalDesactivarPersona } from './ModalDesactivarPersona'
import { ModalDesactivarSquad } from './ModalDesactivarSquad'

interface Props {
  persona: Persona
  aplicaciones: Aplicacion[]
  puedeEditar: boolean
  /** Cambió alguna membresía: refrescar el listado de personas (squads derivados). */
  onCambio: () => void
  /** La persona se desactivó desde esta pestaña: el panel debe cerrarse y recargar. */
  onPersonaDesactivada: () => void
}

type Dialogo =
  | { tipo: 'cerrar'; membresia: Membresia }
  | { tipo: 'abrir'; squadFijo?: string }
  | { tipo: 'persona' }

function EstadoMembresia({ m, hoy }: { m: Membresia; hoy: string }) {
  const desde = m.desde.slice(0, 10)
  const hasta = m.hasta?.slice(0, 10) ?? null
  if (m.activo) {
    return desde > hoy ? (
      <Chip tono="alerta">Desde {fechaCorta(m.desde)}</Chip>
    ) : (
      <Chip tono="exito">Activo</Chip>
    )
  }
  // Cerrada con efecto futuro: sigue vigente hasta esa fecha.
  if (hasta && hasta > hoy) return <Chip tono="alerta">Activo hasta {fechaCorta(m.hasta)}</Chip>
  return <Chip tono="neutro">Inactivo desde {fechaCorta(m.hasta)}</Chip>
}

/** Pestaña «Squads» del panel de persona: membresías con vigencia (ADR-0010). */
export function PestanaSquads({ persona, aplicaciones, puedeEditar, onCambio, onPersonaDesactivada }: Props) {
  const { datos, cargando, error, recargar } = useLista<Membresia>(`/membresias/persona/${persona.id}`)
  const [dialogo, setDialogo] = useState<Dialogo | null>(null)
  const hoy = hoyISO()

  const nombrePorCodigo = useMemo(() => new Map(aplicaciones.map((a) => [a.codigo, a.nombre])), [aplicaciones])
  const nombreSquad = (codigo: string) => nombrePorCodigo.get(codigo) ?? codigo

  const filas = useMemo(() => {
    const nombre = (codigo: string) => nombrePorCodigo.get(codigo) ?? codigo
    return [...datos].sort((a, b) => nombre(a.squad_id).localeCompare(nombre(b.squad_id)) || a.desde.localeCompare(b.desde))
  }, [datos, nombrePorCodigo])
  const conAbierta = useMemo(() => new Set(datos.filter((m) => m.activo).map((m) => m.squad_id)), [datos])
  // Última fila de cada squad (la más reciente): es la única que se puede reabrir.
  const ultimaPorSquad = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const m of filas) mapa.set(m.squad_id, m.id)
    return mapa
  }, [filas])

  const opcionesAgregar = aplicaciones.filter((a) => a.activa && !conAbierta.has(a.codigo))
  const personaActiva = persona.activo
  const puedeActuar = puedeEditar && personaActiva

  function alCambiar(): void {
    recargar()
    onCambio()
  }

  return (
    <div className="space-y-4">
      {error && (
        <Aviso tono="error">
          <span role="alert" className="flex flex-wrap items-center justify-between gap-2">
            {error}
            <Boton tamano="sm" onClick={recargar}>Reintentar</Boton>
          </span>
        </Aviso>
      )}

      {!personaActiva && (
        <Aviso tono="alerta">
          <span role="status">
            La persona está inactiva
            {persona.fecha_efecto_desactivacion ? ` desde el ${fechaCorta(persona.fecha_efecto_desactivacion, true)}` : ''}.
            Reactívala desde la pestaña Datos para abrir squads.
          </span>
        </Aviso>
      )}

      {cargando && datos.length === 0 && !error && <p className="text-sm text-slate-500">Cargando squads…</p>}

      {!cargando && !error && datos.length === 0 && (
        <p className="text-sm text-slate-500">Esta persona no tiene membresías en squads.</p>
      )}

      {filas.length > 0 && (
        <TablaScroll>
          <table className="tabla">
            <thead>
              <tr>
                <th>Squad</th>
                <th>Estado</th>
                <th>Desde</th>
                <th>Hasta</th>
                {puedeActuar && <th><span className="sr-only">Acción</span></th>}
              </tr>
            </thead>
            <tbody>
              {filas.map((m) => {
                const nombre = nombreSquad(m.squad_id)
                const reabrible = !m.activo && !conAbierta.has(m.squad_id) && ultimaPorSquad.get(m.squad_id) === m.id
                return (
                  <tr key={m.id}>
                    <td className="font-semibold">{nombre}</td>
                    <td><EstadoMembresia m={m} hoy={hoy} /></td>
                    <td className="whitespace-nowrap">{fechaCorta(m.desde, true)}</td>
                    <td className="whitespace-nowrap">{m.hasta ? fechaCorta(m.hasta, true) : '—'}</td>
                    {puedeActuar && (
                      <td className="whitespace-nowrap">
                        {m.activo && (
                          <Boton
                            tamano="sm"
                            variante="peligro-suave"
                            aria-label={`Desactivar a ${persona.nombre} en el squad ${nombre}`}
                            onClick={() => setDialogo({ tipo: 'cerrar', membresia: m })}
                          >
                            Desactivar en este squad…
                          </Boton>
                        )}
                        {reabrible && (
                          <Boton
                            tamano="sm"
                            aria-label={`Reabrir el squad ${nombre}`}
                            onClick={() => setDialogo({ tipo: 'abrir', squadFijo: m.squad_id })}
                          >
                            Reabrir…
                          </Boton>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </TablaScroll>
      )}

      {puedeActuar && (
        <Boton onClick={() => setDialogo({ tipo: 'abrir' })} disabled={opcionesAgregar.length === 0}>
          + Agregar a un squad
        </Boton>
      )}

      <p className="text-xs text-slate-500">
        Un squad cuenta en un mes (Control de Horas y Capacidades) si la persona estuvo vigente en él al menos un día.
      </p>

      {puedeActuar && (
        <section className="space-y-2 border-t border-slate-100 pt-4">
          <h3 className="text-2xs font-bold uppercase tracking-wider text-slate-500">Estado general</h3>
          <p className="text-xs text-slate-500">
            Si se desactiva, se cierran todos sus squads abiertos con la misma fecha de efecto.
          </p>
          <Boton variante="peligro-suave" onClick={() => setDialogo({ tipo: 'persona' })}>
            Desactivar persona…
          </Boton>
        </section>
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
      {dialogo?.tipo === 'abrir' && (
        <ModalAbrirSquad
          persona={persona}
          opciones={dialogo.squadFijo ? aplicaciones.filter((a) => a.codigo === dialogo.squadFijo) : opcionesAgregar}
          squadFijo={dialogo.squadFijo}
          onCerrar={() => setDialogo(null)}
          onAbierta={alCambiar}
        />
      )}
      {dialogo?.tipo === 'persona' && (
        <ModalDesactivarPersona
          persona={persona}
          onCerrar={() => setDialogo(null)}
          onDesactivada={onPersonaDesactivada}
        />
      )}
    </div>
  )
}
