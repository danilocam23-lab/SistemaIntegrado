import type { ListaEncoladaState } from './useListaEncolada'

type Props = ListaEncoladaState & {
  titulo: string
  placeholder: string
  textoVacio: string
  ok: string
}

export function SeccionListaChips({
  titulo,
  placeholder,
  textoVacio,
  ok,
  items,
  nuevo,
  setNuevo,
  agregar,
  quitar,
}: Props) {
  return (
    <div className="tarjeta tarjeta-pad">
      <h2 className="etiqueta-sup mb-3">{titulo}</h2>
      <div className="mb-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item} className="chip chip-marca">
            {item}
            <button onClick={() => quitar(item)} className="enlace-accion enlace-accion-peligro ml-1" title="Quitar">✕</button>
          </span>
        ))}
        {items.length === 0 && <span className="text-sm text-slate-400">{textoVacio}</span>}
      </div>
      <div className="flex items-center gap-2">
        <input value={nuevo} onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), agregar())}
          placeholder={placeholder} className="campo" />
        <button onClick={agregar} className="btn btn-primario btn-sm">Agregar</button>
      </div>
      {ok && <div className="aviso aviso-exito mt-3">{ok}</div>}
    </div>
  )
}
