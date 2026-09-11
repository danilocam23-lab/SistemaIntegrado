import { TablaScroll } from '../../components/ui/primitivos'
import { ModalEditarTarifa } from './ModalEditarTarifa'
import { RAMIFICACIONES } from './useTarifas'
import type { TarifasState } from './useTarifas'

type Props = TarifasState

export function SeccionTarifas({
  tarifas,
  tAnio,
  setTAnio,
  tValorHora,
  setTValorHora,
  tRamificacion,
  setTRamificacion,
  tAviso,
  tEditItem,
  setTEditItem,
  tEditAnio,
  setTEditAnio,
  tEditValorHora,
  setTEditValorHora,
  tEditRamificacion,
  setTEditRamificacion,
  abrirEdicionTarifa,
  guardarPopupTarifa,
  crearTarifa,
  eliminarTarifa,
}: Props) {
  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">
        Valores hora globales del proyecto. No dependen de un squad específico.
      </p>
      <form onSubmit={crearTarifa} className="barra-filtros mb-4">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Año</span>
          <input value={tAnio} onChange={(e) => setTAnio(e.target.value)} type="number" required
            className="campo w-24" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Valor hora</span>
          <input value={tValorHora} onChange={(e) => setTValorHora(e.target.value)} type="number" required
            className="campo w-32" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Ramificación</span>
          <select value={tRamificacion} onChange={(e) => setTRamificacion(e.target.value)}
            className="campo">
            {RAMIFICACIONES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <button className="btn btn-primario">Crear</button>
      </form>

      {tAviso && <div className="aviso aviso-error mb-3">{tAviso}</div>}

      <TablaScroll>
      <table className="text-sm">
        <thead className="bg-marca-osc text-white">
          <tr>
            <th className="p-2 text-left">Año</th>
            <th className="p-2 text-right">Valor hora</th>
            <th className="p-2 text-left">Ramificación</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {tarifas.map((t) => (
            <tr key={t.id} className="border-t">
              <td className="p-2">{t.anio}</td>
              <td className="p-2 text-right">{t.valor_hora}</td>
              <td className="p-2">{t.ramificacion ?? '—'}</td>
              <td className="p-2 text-center">
                <div className="flex justify-center gap-2">
                  <button onClick={() => abrirEdicionTarifa(t)} className="enlace-accion enlace-accion-alerta">Editar</button>
                  <button onClick={() => eliminarTarifa(t)} className="enlace-accion enlace-accion-peligro">Eliminar</button>
                </div>
              </td>
            </tr>
          ))}
          {tarifas.length === 0 && (
            <tr><td colSpan={4} className="p-4 text-center text-slate-400">Sin tarifas.</td></tr>
          )}
        </tbody>
      </table>
      </TablaScroll>

      {/* Modal edición tarifa */}
      {tEditItem && (
        <ModalEditarTarifa
          tEditAnio={tEditAnio}
          setTEditAnio={setTEditAnio}
          tEditValorHora={tEditValorHora}
          setTEditValorHora={setTEditValorHora}
          tEditRamificacion={tEditRamificacion}
          setTEditRamificacion={setTEditRamificacion}
          setTEditItem={setTEditItem}
          guardarPopupTarifa={guardarPopupTarifa}
        />
      )}
    </div>
  )
}
