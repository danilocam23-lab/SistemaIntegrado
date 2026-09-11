import type { FestivosState } from './useFestivos'

type Props = FestivosState & {
  aviso: string
  error: string | null
}

export function SeccionFestivos({
  festivos,
  festFecha,
  setFestFecha,
  festivosAgrupados,
  crearFestivo,
  eliminarFestivo,
  aviso,
  error,
}: Props) {
  return (
    <div className="tarjeta tarjeta-pad">
      <h2 className="etiqueta-sup mb-1">Festivos</h2>
      <p className="mb-3 text-xs text-slate-500">Se usan para el cálculo de ANS por días hábiles.</p>
      <form onSubmit={crearFestivo} className="mb-3 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Fecha</span>
          <input value={festFecha} onChange={(e) => setFestFecha(e.target.value)} type="date" required
            className="campo" />
        </label>
        <button className="btn btn-primario btn-sm">+ Agregar</button>
      </form>
      <div className="space-y-3">
        {festivosAgrupados.map((grupo) => (
          <div key={grupo.clave}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{grupo.titulo}</h3>
            <ul className="flex flex-wrap gap-2">
              {grupo.items.map((f) => (
                <li key={f.id} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm">
                  <span className="font-medium">{f.fecha?.slice(0, 10)}</span>
                  <button onClick={() => eliminarFestivo(f)} className="text-red-400 hover:text-red-600" title="Quitar">✕</button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {festivos.length === 0 && <div className="text-sm text-slate-400">Sin festivos registrados</div>}
      </div>
      {(aviso || error) && <div className="aviso aviso-error mt-3">{aviso || error}</div>}
    </div>
  )
}
