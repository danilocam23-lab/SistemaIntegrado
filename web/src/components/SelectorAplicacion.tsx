import { CONSOLIDADO } from '../api/client'
import { useAplicacion } from '../context/AplicacionContext'
import { useAuth } from '../context/AuthContext'

export default function SelectorAplicacion() {
  const { aplicaciones, activa, setActiva } = useAplicacion()
  const { esAdmin } = useAuth()

  function cambiar(codigo: string): void {
    setActiva(codigo)
    // Cambiar de aplicación recarga el contexto completo.
    window.location.reload()
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-slate-500">Squad:</span>
      <select
        id="selector-squad-principal"
        value={activa}
        onChange={(e) => cambiar(e.target.value)}
        className="rounded border px-2 py-1"
      >
        {aplicaciones.map((a) => (
          <option key={a.codigo} value={a.codigo}>
            {a.nombre}
          </option>
        ))}
        {esAdmin && <option value={CONSOLIDADO}>★ Todos los squads</option>}
      </select>
    </div>
  )
}
