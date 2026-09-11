import { Aviso, Boton, Campo, Selector, TablaScroll } from '../../components/ui'
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
        <Campo
          etiqueta="Año"
          value={tAnio}
          onChange={(e) => setTAnio(e.target.value)}
          type="number"
          required
          className="w-24"
        />
        <Campo
          etiqueta="Valor hora"
          value={tValorHora}
          onChange={(e) => setTValorHora(e.target.value)}
          type="number"
          required
          className="w-32"
        />
        <Selector
          etiqueta="Ramificación"
          value={tRamificacion}
          onChange={(e) => setTRamificacion(e.target.value)}
        >
          {RAMIFICACIONES.map((r) => <option key={r} value={r}>{r}</option>)}
        </Selector>
        <Boton type="submit" variante="primario">Crear</Boton>
      </form>

      {tAviso && <Aviso tono="error" className="mb-3">{tAviso}</Aviso>}

      <TablaScroll>
      <table className="tabla">
        <thead>
          <tr>
            <th>Año</th>
            <th className="text-right">Valor hora</th>
            <th>Ramificación</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {tarifas.map((t) => (
            <tr key={t.id}>
              <td>{t.anio}</td>
              <td className="text-right">{t.valor_hora}</td>
              <td>{t.ramificacion ?? '—'}</td>
              <td className="text-center">
                <div className="flex justify-center gap-2">
                  <button onClick={() => abrirEdicionTarifa(t)} className="enlace-accion enlace-accion-alerta">Editar</button>
                  <button onClick={() => eliminarTarifa(t)} className="enlace-accion enlace-accion-peligro">Eliminar</button>
                </div>
              </td>
            </tr>
          ))}
          {tarifas.length === 0 && (
            <tr><td colSpan={4} className="text-center text-slate-400">Sin tarifas.</td></tr>
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
