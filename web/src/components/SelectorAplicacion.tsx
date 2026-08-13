import { CONSOLIDADO } from '../api/client'
import { useAplicacion } from '../context/AplicacionContext'
import { useAuth } from '../context/AuthContext'

export default function SelectorAplicacion() {
  const { aplicaciones, activa, setActiva } = useAplicacion()
  const { tienePermiso } = useAuth()
  const puedeVerTodos = tienePermiso('consolidado.ver') || aplicaciones.length > 1

  function cambiar(codigo: string): void {
    setActiva(codigo)
    // Cambiar de aplicación recarga el contexto completo.
    window.location.reload()
  }

  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <span className="shrink-0 text-slate-500">Squad:</span>
      <select
        id="selector-squad-principal"
        value={activa}
        onChange={(e) => cambiar(e.target.value)}
        className="min-w-0 max-w-full flex-1 rounded border px-2 py-1 sm:flex-none"
      >
        {aplicaciones.map((a) => (
          <option key={a.codigo} value={a.codigo}>
            {a.nombre}
          </option>
        ))}
        {puedeVerTodos && <option value={CONSOLIDADO}>★ Todos los squads</option>}
      </select>
    </div>
  )
}
