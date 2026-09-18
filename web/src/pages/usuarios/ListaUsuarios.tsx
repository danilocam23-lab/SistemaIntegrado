// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Aviso, BarraFiltros, Boton, Campo, Selector } from '../../components/ui'
import type { Rol, Usuario } from '../../types'
import FilaUsuario from './FilaUsuario'

interface OpcionFiltro {
  clave: string
  etiqueta: string
}

interface Props {
  usuariosPagina: Usuario[]
  totalFiltrados: number
  totalSinFiltrar: number
  pagina: number
  totalPaginas: number
  onCambiarPagina: (pagina: number) => void
  busqueda: string
  onCambiarBusqueda: (v: string) => void
  filtroRol: string
  onCambiarFiltroRol: (v: string) => void
  opcionesRol: OpcionFiltro[]
  filtroSquad: string
  onCambiarFiltroSquad: (v: string) => void
  opcionesSquad: OpcionFiltro[]
  puedeCrearUsuarios: boolean
  onNuevoUsuario: () => void
  aviso: string
  rolesDisponibles: Rol[]
  puedeEditarUsuarios: boolean
  yoId?: string
  nombresSquadsUsuario: (u: Usuario) => string
  onCambiarRol: (u: Usuario, rolId: string) => void
  onAlternarActivo: (u: Usuario) => void
  onEditar: (u: Usuario) => void
  onResetPassword: (u: Usuario) => void
  onEliminar: (u: Usuario) => void
}

export default function ListaUsuarios({
  usuariosPagina, totalFiltrados, totalSinFiltrar, pagina, totalPaginas, onCambiarPagina,
  busqueda, onCambiarBusqueda, filtroRol, onCambiarFiltroRol, opcionesRol,
  filtroSquad, onCambiarFiltroSquad, opcionesSquad,
  puedeCrearUsuarios, onNuevoUsuario, aviso,
  rolesDisponibles, puedeEditarUsuarios, yoId, nombresSquadsUsuario,
  onCambiarRol, onAlternarActivo, onEditar, onResetPassword, onEliminar,
}: Props) {
  return (
    <div className="space-y-4">
      <BarraFiltros>
        <label className="grupo-filtro min-w-56">
          <span className="etiqueta">Buscar</span>
          <Campo
            value={busqueda}
            onChange={(e) => onCambiarBusqueda(e.target.value)}
            placeholder="Nombre o correo…"
            compacto
          />
        </label>
        <Selector etiqueta="Rol" value={filtroRol} onChange={(e) => onCambiarFiltroRol(e.target.value)} compacto>
          <option value="">Todos los roles</option>
          {opcionesRol.map((o) => <option key={o.clave} value={o.clave}>{o.etiqueta}</option>)}
        </Selector>
        <Selector etiqueta="Squad" value={filtroSquad} onChange={(e) => onCambiarFiltroSquad(e.target.value)} compacto>
          <option value="">Todos los squads</option>
          {opcionesSquad.map((o) => <option key={o.clave} value={o.clave}>{o.etiqueta}</option>)}
        </Selector>
        {puedeCrearUsuarios && (
          <Boton variante="primario" className="ml-auto" onClick={onNuevoUsuario}>
            + Nuevo usuario
          </Boton>
        )}
      </BarraFiltros>

      {aviso && <Aviso tono="error">{aviso}</Aviso>}

      <div className="tarjeta overflow-hidden">
        <div className="hidden items-center gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-2xs font-bold uppercase tracking-wider text-slate-500 sm:grid sm:grid-cols-[minmax(0,1.4fr)_10rem_minmax(0,1fr)_4.5rem_14rem]">
          <span>Usuario</span>
          <span>Rol</span>
          <span>Squads</span>
          <span className="text-center">Activo</span>
          <span>Acciones</span>
        </div>

        {usuariosPagina.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-400">
            {totalSinFiltrar === 0 ? 'Sin usuarios.' : 'Ningún usuario coincide con los filtros.'}
          </p>
        ) : (
          usuariosPagina.map((u) => (
            <FilaUsuario
              key={u.id}
              usuario={u}
              rolesDisponibles={rolesDisponibles}
              nombresSquads={nombresSquadsUsuario(u)}
              puedeEditarUsuarios={puedeEditarUsuarios}
              esUsuarioActual={u.id === yoId}
              onCambiarRol={(rolId) => onCambiarRol(u, rolId)}
              onAlternarActivo={() => onAlternarActivo(u)}
              onEditar={() => onEditar(u)}
              onResetPassword={() => onResetPassword(u)}
              onEliminar={() => onEliminar(u)}
            />
          ))
        )}
      </div>

      {totalPaginas > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Boton variante="secundario" tamano="sm" onClick={() => onCambiarPagina(1)} disabled={pagina <= 1}>
            «
          </Boton>
          <Boton variante="secundario" tamano="sm" onClick={() => onCambiarPagina(pagina - 1)} disabled={pagina <= 1}>
            ‹ Anterior
          </Boton>
          <span className="text-sm font-medium text-slate-700">
            {pagina} / {totalPaginas} · {totalFiltrados} usuarios
          </span>
          <Boton variante="secundario" tamano="sm" onClick={() => onCambiarPagina(pagina + 1)} disabled={pagina >= totalPaginas}>
            Siguiente ›
          </Boton>
          <Boton variante="secundario" tamano="sm" onClick={() => onCambiarPagina(totalPaginas)} disabled={pagina >= totalPaginas}>
            »
          </Boton>
        </div>
      )}
    </div>
  )
}
