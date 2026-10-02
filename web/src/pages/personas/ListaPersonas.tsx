// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Boton, Chip, cx } from '../../components/ui'
import type { Persona } from '../../types'
import { ChipRol } from './ChipRol'
import {
  COL_ACCIONES,
  COL_ACTIVA,
  COL_CONTRATACION,
  COL_ROL,
  COL_SQUADS,
  FilaPersona,
} from './FilaPersona'
import type { GrupoRol } from './useFiltrosPersonas'
import { TAMANIO_PAGINA } from './useFiltrosPersonas'
import type { VistaPersonas } from './tipos'

interface Props {
  vista: VistaPersonas
  filtradas: Persona[]
  paginaActual: Persona[]
  pagina: number
  totalPaginas: number
  onPagina: (pagina: number) => void
  grupos: GrupoRol[]
  colapsados: Set<string>
  onAlternarGrupo: (rol: string) => void
  verValores: boolean
  puedeEditar: boolean
  puedeEliminar: boolean
  idOcupada: string
  onAbrir: (persona: Persona) => void
  onEliminar: (persona: Persona) => void
  onAlternarActivo: (persona: Persona) => void
}

function EncabezadoColumnas() {
  return (
    <div
      aria-hidden="true"
      className="hidden gap-x-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-2xs font-bold uppercase tracking-wider text-slate-500 md:flex"
    >
      <span className="min-w-[220px] flex-1">Persona</span>
      <span className={COL_ROL}>Rol</span>
      <span className={COL_SQUADS}>Squads</span>
      <span className={COL_CONTRATACION}>Contratación</span>
      <span className={COL_ACTIVA}>Activa</span>
      <span className={COL_ACCIONES}>Acciones</span>
    </div>
  )
}

/** Lista densa paginada o agrupada por rol (colapsable). */
export function ListaPersonas(props: Props) {
  const { vista, filtradas, paginaActual, pagina, totalPaginas, onPagina, grupos, colapsados, onAlternarGrupo } = props

  function fila(p: Persona) {
    return (
      <FilaPersona
        key={p.id}
        persona={p}
        verValores={props.verValores}
        puedeEditar={props.puedeEditar}
        puedeEliminar={props.puedeEliminar}
        ocupada={props.idOcupada === p.id}
        onAbrir={props.onAbrir}
        onEliminar={props.onEliminar}
        onAlternarActivo={props.onAlternarActivo}
      />
    )
  }

  if (vista === 'por-rol') {
    return (
      <div className="space-y-3">
        {grupos.map(({ rol, personas }) => {
          const cerrado = colapsados.has(rol)
          const activas = personas.filter((p) => p.activo).length
          return (
            <section key={rol || 'sin-rol'} className="tarjeta overflow-hidden">
              <button
                type="button"
                aria-expanded={!cerrado}
                onClick={() => onAlternarGrupo(rol)}
                className="flex w-full flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-left hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-marca-500"
              >
                <span className="flex items-center gap-2">
                  <span aria-hidden="true" className="text-slate-500">{cerrado ? '▸' : '▾'}</span>
                  <ChipRol rol={rol} />
                </span>
                <span className="flex items-center gap-2 text-xs text-slate-500">
                  <Chip tono="neutro">{personas.length} persona{personas.length === 1 ? '' : 's'}</Chip>
                  <Chip tono="exito">{activas} activa{activas === 1 ? '' : 's'}</Chip>
                </span>
              </button>
              {!cerrado && <ul>{personas.map(fila)}</ul>}
            </section>
          )
        })}
        <p className="text-xs text-slate-500">
          {filtradas.length} persona{filtradas.length === 1 ? '' : 's'} en vista agrupada · pulsa un grupo para colapsarlo
        </p>
      </div>
    )
  }

  const desde = (pagina - 1) * TAMANIO_PAGINA + 1
  const hasta = Math.min(pagina * TAMANIO_PAGINA, filtradas.length)
  return (
    <div className="tarjeta overflow-hidden">
      <EncabezadoColumnas />
      <ul>{paginaActual.map(fila)}</ul>
      <div className={cx('flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-3 py-2 text-xs text-slate-500')}>
        <span>
          Mostrando {desde}–{hasta} de {filtradas.length}
        </span>
        {totalPaginas > 1 && (
          <nav aria-label="Paginación" className="flex items-center gap-1">
            <Boton tamano="sm" disabled={pagina <= 1} onClick={() => onPagina(pagina - 1)}>
              Anterior
            </Boton>
            <span className="px-2">Página {pagina} de {totalPaginas}</span>
            <Boton tamano="sm" disabled={pagina >= totalPaginas} onClick={() => onPagina(pagina + 1)}>
              Siguiente
            </Boton>
          </nav>
        )}
      </div>
    </div>
  )
}
