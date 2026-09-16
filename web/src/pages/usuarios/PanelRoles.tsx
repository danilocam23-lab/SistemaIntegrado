import type { ComponentProps } from 'react'
import { Aviso, Boton, Chip, cx } from '../../components/ui'
import type { Rol } from '../../types'
import FormularioRol from './FormularioRol'

/** Maestro-detalle de "Roles y permisos": lista de roles a la izquierda
 *  (con "Nuevo rol" arriba) y a la derecha el mismo `FormularioRol`, tanto
 *  para crear como para editar el rol seleccionado. Usuarios.tsx arma
 *  `propsFormulario` según el modo activo; aquí solo se decide qué mostrar. */
interface Props {
  roles: Rol[]
  rolSeleccionadoId: string | null
  puedeCrearRoles: boolean
  puedeEditarRoles: boolean
  onNuevoRol: () => void
  onSeleccionarRol: (rol: Rol) => void
  errorRoles: string
  propsFormulario: ComponentProps<typeof FormularioRol> | null
}

export default function PanelRoles({
  roles, rolSeleccionadoId, puedeCrearRoles, puedeEditarRoles,
  onNuevoRol, onSeleccionarRol, errorRoles, propsFormulario,
}: Props) {
  return (
    <div className="space-y-4">
      {errorRoles && <Aviso tono="error">{errorRoles}</Aviso>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[18rem_1fr]">
        <div className="tarjeta tarjeta-pad space-y-3">
          {puedeCrearRoles && (
            <Boton variante="primario" bloque onClick={onNuevoRol}>
              + Nuevo rol
            </Boton>
          )}
          <div className="space-y-1">
            {roles.map((rol) => (
              <button
                key={rol.id}
                type="button"
                onClick={() => onSeleccionarRol(rol)}
                disabled={!puedeEditarRoles}
                className={cx(
                  'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                  rolSeleccionadoId === rol.id ? 'bg-marca-50 text-marca-800' : 'text-slate-700 hover:bg-slate-50',
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{rol.nombre}</span>
                  <span className="block truncate font-mono text-2xs text-slate-400">{rol.clave}</span>
                </span>
                <Chip tono={rol.activo ? 'exito' : 'neutro'}>{rol.activo ? 'Activo' : 'Inactivo'}</Chip>
              </button>
            ))}
            {roles.length === 0 && <p className="p-3 text-center text-sm text-slate-400">Sin roles.</p>}
          </div>
        </div>

        <div className="tarjeta tarjeta-pad">
          {propsFormulario ? (
            <FormularioRol {...propsFormulario} />
          ) : (
            <div className="flex min-h-48 flex-col items-center justify-center text-center text-sm text-slate-400">
              Selecciona un rol de la lista{puedeCrearRoles ? ' o crea uno nuevo.' : '.'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
