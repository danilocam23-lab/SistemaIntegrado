import { Chip, Selector, cx } from '../../components/ui'
import type { Rol, Usuario } from '../../types'
import { colorAvatar, inicialesDe, squadsChipsUsuario } from './utilidades'

/** Interruptor visual para "Activo". No es un primitivo de `components/ui`
 *  porque hoy solo lo usa esta fila; si otra pantalla llega a necesitar el
 *  mismo control, vale la pena promoverlo a un `Interruptor` compartido. */
function InterruptorActivo({ activo, disabled, onClick }: { activo: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={activo ? 'Desactivar usuario' : 'Activar usuario'}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        activo ? 'bg-emerald-500' : 'bg-slate-300',
      )}
    >
      <span
        className={cx(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
          activo ? 'translate-x-4' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}

interface Props {
  usuario: Usuario
  rolesDisponibles: Rol[]
  nombresSquads: string
  puedeEditarUsuarios: boolean
  esUsuarioActual: boolean
  onCambiarRol: (nuevoRolId: string) => void
  onAlternarActivo: () => void
  onEditar: () => void
  onResetPassword: () => void
  onEliminar: () => void
}

export default function FilaUsuario({
  usuario: u, rolesDisponibles, nombresSquads, puedeEditarUsuarios, esUsuarioActual,
  onCambiarRol, onAlternarActivo, onEditar, onResetPassword, onEliminar,
}: Props) {
  const chipsSquads = squadsChipsUsuario(nombresSquads)

  return (
    <div className="grid grid-cols-1 items-start gap-x-3 gap-y-2 border-b border-slate-100 px-3 py-3 last:border-0 hover:bg-slate-50/70 sm:grid-cols-[minmax(0,1.4fr)_10rem_minmax(0,1fr)_4.5rem_14rem] sm:items-center sm:gap-y-0">
      {/* Usuario: avatar + nombre + correo */}
      <div className="flex min-w-0 items-center gap-3">
        <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold', colorAvatar(u.email || u.nombre))}>
          {inicialesDe(u.nombre)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">{u.nombre}</p>
          <p className="truncate text-xs text-slate-500">{u.email}</p>
        </div>
      </div>

      {/* Rol */}
      <div>
        <span className="etiqueta-sup sm:hidden">Rol</span>
        <Selector
          value={u.rol_id ?? ''}
          onChange={(e) => onCambiarRol(e.target.value)}
          disabled={!puedeEditarUsuarios}
          compacto
          className="w-full"
        >
          {rolesDisponibles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
        </Selector>
      </div>

      {/* Squads */}
      <div className="min-w-0">
        <span className="etiqueta-sup sm:hidden">Squads</span>
        {chipsSquads.length === 0 ? (
          <span className="text-xs text-slate-400">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {chipsSquads.map((nombre) => (
              <Chip key={nombre} tono={nombre === '★ Todos' ? 'marca' : 'neutro'}>{nombre}</Chip>
            ))}
          </div>
        )}
      </div>

      {/* Activo */}
      <div className="flex items-center gap-2 sm:justify-center">
        <span className="etiqueta-sup sm:hidden">Activo</span>
        <InterruptorActivo activo={u.activo} disabled={!puedeEditarUsuarios} onClick={onAlternarActivo} />
      </div>

      {/* Acciones */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs sm:pt-0">
        <button onClick={onEditar} disabled={!puedeEditarUsuarios} className="enlace-accion text-xs">
          Editar
        </button>
        <button onClick={onResetPassword} disabled={!puedeEditarUsuarios} className="enlace-accion text-xs">
          Resetear clave
        </button>
        <button
          onClick={onEliminar}
          disabled={!puedeEditarUsuarios || esUsuarioActual}
          className="enlace-accion enlace-accion-peligro text-xs"
          title={esUsuarioActual ? 'No puedes eliminar tu propio acceso' : 'Elimina definitivamente el registro del usuario'}
        >
          Eliminar acceso
        </button>
      </div>
    </div>
  )
}
