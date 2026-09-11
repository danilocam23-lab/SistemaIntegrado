import { Aviso, Boton, Campo, TablaScroll } from '../../components/ui'
import type { CategoriasState } from './useCategorias'

type Props = CategoriasState

export function SeccionCategorias({
  categorias,
  cNombre,
  setCNombre,
  cColor,
  setCColor,
  cAviso,
  cEditCell,
  cEditValue,
  setCEditValue,
  cCancelarBlur,
  cIniciarEdicion,
  cCancelarEdicion,
  cGuardarEdicion,
  cCrear,
  cEliminar,
}: Props) {
  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">
        Categorías globales para clasificar los requerimientos del proyecto.
      </p>
      <form onSubmit={cCrear} className="barra-filtros mb-4">
        <Campo
          etiqueta="Nombre"
          value={cNombre}
          onChange={(e) => setCNombre(e.target.value)}
          required
        />
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Color</span>
          <input value={cColor} onChange={(e) => setCColor(e.target.value)} type="color"
            className="h-10 w-16 rounded border" />
        </label>
        <Boton type="submit" variante="primario">Crear</Boton>
      </form>

      {cAviso && <Aviso tono="error" className="mb-3">{cAviso}</Aviso>}

      <TablaScroll>
      <table className="tabla">
        <thead>
          <tr>
            <th>Orden</th>
            <th>Categoría</th>
            <th>Color</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {categorias.map((c) => (
            <tr key={c.id}>
              <td className="cursor-pointer" title="Doble clic para editar"
                onDoubleClick={() => cIniciarEdicion(c.id, 'orden', String(c.orden))}>
                {cEditCell?.id === c.id && cEditCell.campo === 'orden' ? (
                  <Campo autoFocus type="number" value={cEditValue}
                    onChange={(e) => setCEditValue(e.target.value)}
                    // INVARIANTE 17: cCancelarBlur evita que Escape dispare el guardado del onBlur.
                    onBlur={() => { if (cCancelarBlur.current) { cCancelarBlur.current = false; return } void cGuardarEdicion(c) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } if (e.key === 'Escape') { e.preventDefault(); cCancelarEdicion() } }}
                    compacto
                    className="w-20" />
                ) : c.orden}
              </td>
              <td className="cursor-pointer" title="Doble clic para editar"
                onDoubleClick={() => cIniciarEdicion(c.id, 'nombre', c.nombre)}>
                {cEditCell?.id === c.id && cEditCell.campo === 'nombre' ? (
                  <Campo autoFocus value={cEditValue}
                    onChange={(e) => setCEditValue(e.target.value)}
                    onBlur={() => { if (cCancelarBlur.current) { cCancelarBlur.current = false; return } void cGuardarEdicion(c) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } if (e.key === 'Escape') { e.preventDefault(); cCancelarEdicion() } }}
                    compacto
                    className="w-full" />
                ) : c.nombre}
              </td>
              <td className="cursor-pointer" title="Doble clic para editar"
                onDoubleClick={() => cIniciarEdicion(c.id, 'color', c.color)}>
                {cEditCell?.id === c.id && cEditCell.campo === 'color' ? (
                  <input autoFocus type="color" value={cEditValue}
                    onChange={(e) => setCEditValue(e.target.value)}
                    onBlur={() => { if (cCancelarBlur.current) { cCancelarBlur.current = false; return } void cGuardarEdicion(c) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } if (e.key === 'Escape') { e.preventDefault(); cCancelarEdicion() } }}
                    className="h-10 w-16 rounded border" />
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-4 w-4 rounded" style={{ background: c.color }} />
                    {c.color}
                  </span>
                )}
              </td>
              <td className="text-center">
                <button onClick={() => void cEliminar(c)} className="enlace-accion enlace-accion-peligro">Eliminar</button>
              </td>
            </tr>
          ))}
          {categorias.length === 0 && (
            <tr><td colSpan={4} className="text-center text-slate-400">Sin categorías.</td></tr>
          )}
        </tbody>
      </table>
      </TablaScroll>
    </div>
  )
}
