import { TablaScroll } from '../../components/ui/primitivos'
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
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Nombre</span>
          <input value={cNombre} onChange={(e) => setCNombre(e.target.value)} required
            className="campo" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Color</span>
          <input value={cColor} onChange={(e) => setCColor(e.target.value)} type="color"
            className="h-10 w-16 rounded border" />
        </label>
        <button className="btn btn-primario">Crear</button>
      </form>

      {cAviso && <div className="aviso aviso-error mb-3">{cAviso}</div>}

      <TablaScroll>
      <table className="text-sm">
        <thead className="bg-marca-osc text-white">
          <tr>
            <th className="p-2 text-left">Orden</th>
            <th className="p-2 text-left">Categoría</th>
            <th className="p-2 text-left">Color</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {categorias.map((c) => (
            <tr key={c.id} className="border-t">
              <td className="cursor-pointer p-2" title="Doble clic para editar"
                onDoubleClick={() => cIniciarEdicion(c.id, 'orden', String(c.orden))}>
                {cEditCell?.id === c.id && cEditCell.campo === 'orden' ? (
                  <input autoFocus type="number" value={cEditValue}
                    onChange={(e) => setCEditValue(e.target.value)}
                    // INVARIANTE 17: cCancelarBlur evita que Escape dispare el guardado del onBlur.
                    onBlur={() => { if (cCancelarBlur.current) { cCancelarBlur.current = false; return } void cGuardarEdicion(c) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } if (e.key === 'Escape') { e.preventDefault(); cCancelarEdicion() } }}
                    className="campo campo-sm w-20" />
                ) : c.orden}
              </td>
              <td className="cursor-pointer p-2" title="Doble clic para editar"
                onDoubleClick={() => cIniciarEdicion(c.id, 'nombre', c.nombre)}>
                {cEditCell?.id === c.id && cEditCell.campo === 'nombre' ? (
                  <input autoFocus value={cEditValue}
                    onChange={(e) => setCEditValue(e.target.value)}
                    onBlur={() => { if (cCancelarBlur.current) { cCancelarBlur.current = false; return } void cGuardarEdicion(c) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } if (e.key === 'Escape') { e.preventDefault(); cCancelarEdicion() } }}
                    className="campo campo-sm w-full" />
                ) : c.nombre}
              </td>
              <td className="cursor-pointer p-2" title="Doble clic para editar"
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
              <td className="p-2 text-center">
                <button onClick={() => void cEliminar(c)} className="enlace-accion enlace-accion-peligro">Eliminar</button>
              </td>
            </tr>
          ))}
          {categorias.length === 0 && (
            <tr><td colSpan={4} className="p-4 text-center text-slate-400">Sin categorías.</td></tr>
          )}
        </tbody>
      </table>
      </TablaScroll>
    </div>
  )
}
