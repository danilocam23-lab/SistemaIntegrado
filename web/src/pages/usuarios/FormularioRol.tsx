// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import type { FormEvent } from 'react'
import { Aviso, Boton, Campo } from '../../components/ui'
import { permisoInfo } from './utilidades'
import type { GrupoPermisos } from './utilidades'

/** Panel derecho del maestro-detalle de roles: sirve tanto para crear un rol
 *  (modo 'nuevo') como para editar el seleccionado en la lista (modo
 *  'editar'). El catálogo de permisos se muestra agrupado por módulo, cada
 *  grupo colapsable con un checkbox "seleccionar todos" y un contador. */
interface Props {
  modo: 'nuevo' | 'editar'
  clave: string
  onCambiarClave?: (v: string) => void
  nombre: string
  onCambiarNombre: (v: string) => void
  descripcion: string
  onCambiarDescripcion: (v: string) => void
  activo?: boolean
  onCambiarActivo?: (v: boolean) => void
  esSistema?: boolean
  permisosSeleccionados: string[]
  grupos: GrupoPermisos[]
  onTogglePermiso: (permiso: string) => void
  onToggleModulo: (permisosModulo: string[], marcar: boolean) => void
  puedeGuardar: boolean
  puedeEliminar?: boolean
  aviso: string
  onSubmit: (e: FormEvent) => void | Promise<void>
  onEliminar?: () => void
}

export default function FormularioRol({
  modo, clave, onCambiarClave, nombre, onCambiarNombre, descripcion, onCambiarDescripcion,
  activo, onCambiarActivo, esSistema, permisosSeleccionados, grupos,
  onTogglePermiso, onToggleModulo, puedeGuardar, puedeEliminar, aviso, onSubmit, onEliminar,
}: Props) {
  const soloLectura = !puedeGuardar

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h2 className="titulo-seccion">{modo === 'nuevo' ? 'Nuevo rol' : nombre || 'Editar rol'}</h2>

      {aviso && <Aviso tono="error">{aviso}</Aviso>}

      <div className="flex flex-wrap gap-3">
        <label className="grupo-filtro min-w-40">
          <span className="etiqueta">Clave</span>
          <Campo
            placeholder="ej: auditor"
            value={clave}
            onChange={(e) => onCambiarClave?.(e.target.value)}
            disabled={modo === 'editar' || soloLectura}
            required={modo === 'nuevo'}
          />
        </label>
        <label className="grupo-filtro min-w-40 flex-1">
          <span className="etiqueta">Nombre</span>
          <Campo
            value={nombre}
            onChange={(e) => onCambiarNombre(e.target.value)}
            disabled={soloLectura}
            required
          />
        </label>
        <label className="grupo-filtro min-w-64 flex-1">
          <span className="etiqueta">Descripción</span>
          <Campo
            value={descripcion}
            onChange={(e) => onCambiarDescripcion(e.target.value)}
            disabled={soloLectura}
          />
        </label>
        {modo === 'editar' && (
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input
              type="checkbox"
              checked={activo ?? true}
              onChange={(e) => onCambiarActivo?.(e.target.checked)}
              disabled={soloLectura}
            />
            <span>Activo</span>
          </label>
        )}
      </div>

      <div className="space-y-2">
        {grupos.map((grupo) => {
          const marcados = grupo.permisos.filter((p) => permisosSeleccionados.includes(p)).length
          const todosMarcados = marcados === grupo.permisos.length
          return (
            <details key={grupo.modulo} open className="rounded-lg border border-slate-200">
              <summary className="flex cursor-pointer select-none items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={todosMarcados}
                    disabled={soloLectura}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onToggleModulo(grupo.permisos, e.target.checked)}
                  />
                  {grupo.modulo}
                </span>
                <span className="text-2xs font-bold text-slate-400">{marcados}/{grupo.permisos.length}</span>
              </summary>
              <div className="grid grid-cols-1 gap-2 border-t border-slate-100 p-2 md:grid-cols-2">
                {grupo.permisos.map((permiso) => {
                  const info = permisoInfo(permiso)
                  return (
                    <label key={permiso} className="flex cursor-pointer items-start gap-2 rounded border border-slate-100 p-2 text-xs hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={permisosSeleccionados.includes(permiso)}
                        onChange={() => onTogglePermiso(permiso)}
                        disabled={soloLectura}
                        className="mt-1"
                      />
                      <span>
                        <span className="block font-semibold text-slate-800">{info.nombre}</span>
                        <span className="block text-[11px] text-slate-500">{info.descripcion}</span>
                        <span className="block font-mono text-[10px] text-slate-400">{permiso}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </details>
          )
        })}
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
        {modo === 'editar' && onEliminar && (
          <Boton type="button" variante="peligro-suave" onClick={onEliminar} disabled={!puedeEliminar || esSistema}
            title={esSistema ? 'Los roles del sistema no se pueden eliminar' : undefined}>
            Eliminar rol
          </Boton>
        )}
        <Boton variante="primario" type="submit" disabled={soloLectura}>
          {modo === 'nuevo' ? 'Crear rol' : 'Guardar cambios'}
        </Boton>
      </div>
    </form>
  )
}
