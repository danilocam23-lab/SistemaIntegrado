import { Aviso, Boton, Campo, Chip } from '../../components/ui'
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
        <Campo
          etiqueta="Fecha"
          value={festFecha}
          onChange={(e) => setFestFecha(e.target.value)}
          type="date"
          required
        />
        <Boton type="submit" variante="primario" tamano="sm">+ Agregar</Boton>
      </form>
      <div className="space-y-3">
        {festivosAgrupados.map((grupo) => (
          <div key={grupo.clave}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{grupo.titulo}</h3>
            <ul className="flex flex-wrap gap-2">
              {grupo.items.map((f) => (
                <li key={f.id}>
                  <Chip tono="neutro">
                    {f.fecha?.slice(0, 10)}
                    <button onClick={() => eliminarFestivo(f)} className="enlace-accion enlace-accion-peligro ml-1" title="Quitar">✕</button>
                  </Chip>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {festivos.length === 0 && <div className="text-sm text-slate-400">Sin festivos registrados</div>}
      </div>
      {(aviso || error) && <Aviso tono="error" className="mt-3">{aviso || error}</Aviso>}
    </div>
  )
}
