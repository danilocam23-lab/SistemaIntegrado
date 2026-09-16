import type { Dispatch, FormEvent, SetStateAction } from 'react'
import Modal from '../../components/Modal'
import { Aviso, Boton, Campo, Selector } from '../../components/ui'
import type { Aplicacion, Rol } from '../../types'

/** Modal de alta/edición de usuario: mismo formulario para "Nuevo usuario"
 *  (con contraseña) y para "Editar" (sin contraseña) — cambia según se
 *  reciba `password`/`setPassword` o no. No decide nada por sí mismo: el
 *  envío y los valores viven en Usuarios.tsx (`crear` / `guardarEdicion`). */
interface Props {
  abierto: boolean
  onCerrar: () => void
  titulo: string
  onSubmit: (e: FormEvent) => void | Promise<void>
  aviso: string
  nombre: string
  setNombre: (v: string) => void
  email: string
  setEmail: (v: string) => void
  password?: string
  setPassword?: (v: string) => void
  rolId: string
  setRolId: (v: string) => void
  rolesDisponibles: Rol[]
  squads: string[]
  setSquads: Dispatch<SetStateAction<string[]>>
  onToggleSquad: (codigo: string) => void
  appsActivasDisponibles: Aplicacion[]
  textoSubmit: string
}

export default function ModalUsuario({
  abierto, onCerrar, titulo, onSubmit, aviso,
  nombre, setNombre, email, setEmail, password, setPassword,
  rolId, setRolId, rolesDisponibles,
  squads, setSquads, onToggleSquad, appsActivasDisponibles,
  textoSubmit,
}: Props) {
  return (
    <Modal titulo={titulo} abierto={abierto} onCerrar={onCerrar}>
      <form onSubmit={onSubmit} className="space-y-3">
        {aviso && <Aviso tono="error">{aviso}</Aviso>}
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Nombre</span>
          <Campo value={nombre} onChange={(e) => setNombre(e.target.value)} required className="w-full" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Correo</span>
          <Campo value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="w-full" />
        </label>
        {setPassword && (
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Contraseña</span>
            <Campo value={password ?? ''} onChange={(e) => setPassword(e.target.value)} type="password" required className="w-full" />
          </label>
        )}
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Rol</span>
          <Selector value={rolId} onChange={(e) => setRolId(e.target.value)} className="w-full">
            <option value="">Seleccione</option>
            {rolesDisponibles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </Selector>
        </label>
        <div className="block text-sm">
          <div className="mb-1 flex items-center justify-between gap-3">
            <span className="block text-slate-600">Squads</span>
            <div className="flex gap-2 text-[11px] font-semibold">
              <button type="button" className="enlace-accion" onClick={() => setSquads(appsActivasDisponibles.map((a) => a.codigo))}>
                Todos
              </button>
              <button type="button" className="enlace-accion-sutil" onClick={() => setSquads([])}>
                Limpiar
              </button>
            </div>
          </div>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded border px-3 py-2">
            <label className="mb-1 flex cursor-pointer items-center gap-2 rounded px-1 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={appsActivasDisponibles.length > 0 && appsActivasDisponibles.every((a) => squads.includes(a.codigo))}
                onChange={(e) => setSquads(e.target.checked ? appsActivasDisponibles.map((a) => a.codigo) : [])}
              />
              <span>★ Todos los squads</span>
            </label>
            {appsActivasDisponibles.map((a) => (
              <label key={a.codigo} className="flex cursor-pointer items-center gap-2 rounded px-1 text-sm hover:bg-slate-50">
                <input type="checkbox" checked={squads.includes(a.codigo)} onChange={() => onToggleSquad(a.codigo)} />
                <span>{a.nombre}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Boton type="button" variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton variante="primario" type="submit">
            {textoSubmit}
          </Boton>
        </div>
      </form>
    </Modal>
  )
}
