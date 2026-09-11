import { fmtFechaCo } from './utilidades'
import type { CargaExcelState } from './useCargaExcel'

type Props = CargaExcelState

export function SeccionCargaExcel({
  rutaCargaExcel,
  setRutaCargaExcel,
  rutaCargaExcelAviso,
  rutaCargaExcelOk,
  probandoCargaExcel,
  resultadoPruebaCargaExcel,
  ultimaEjecucionAuto,
  cargandoUltimaEjecucion,
  consultarUltimaEjecucionAuto,
  guardarRutaCargaExcel,
  probarCargaAutomatica,
}: Props) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Ruta local (en el servidor) donde el proceso automático busca el archivo
        <code className="mx-1 rounded bg-slate-100 px-1">Solicitudes Fabrica soporte.xlsx</code>
        y lo sincroniza 3 veces al día (6:00, 12:00 y 18:00), sin pedir confirmación. Solo se cargan
        los registros sin error; si hay registros con error, quedan disponibles para revisión y carga
        manual desde la vista "Soporte — Solicitudes Fábrica".
      </p>

      <form onSubmit={guardarRutaCargaExcel} className="tarjeta tarjeta-pad flex flex-wrap items-end gap-3">
        <label className="min-w-[320px] flex-1 text-sm">
          <span className="mb-1 block text-slate-600">Ruta de la carpeta</span>
          <input
            value={rutaCargaExcel}
            onChange={(e) => setRutaCargaExcel(e.target.value)}
            placeholder="C:\Users\usuario\HITSS\Storage 01 Colombia - Sabana de seguimiento"
            className="campo w-full"
          />
        </label>
        <button className="btn btn-primario">Guardar</button>
      </form>

      {rutaCargaExcelAviso && <div className="aviso aviso-error">{rutaCargaExcelAviso}</div>}
      {rutaCargaExcelOk && <div className="aviso aviso-exito">{rutaCargaExcelOk}</div>}

      <div className="tarjeta tarjeta-pad space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="etiqueta-sup">Estado de la última ejecución (automática o manual)</h2>
          <button
            type="button"
            className="btn btn-secundario"
            onClick={() => void consultarUltimaEjecucionAuto()}
            disabled={cargandoUltimaEjecucion}
          >
            🔄 {cargandoUltimaEjecucion ? 'Consultando…' : 'Consultar estado'}
          </button>
        </div>
        {!ultimaEjecucionAuto && (
          <p className="text-sm text-slate-500">
            {cargandoUltimaEjecucion ? 'Consultando…' : 'Todavía no se ha ejecutado ninguna carga.'}
          </p>
        )}
        {ultimaEjecucionAuto && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded border p-3 text-sm">
              <div className="text-slate-500">Archivo</div>
              <div className="font-semibold text-slate-700">{ultimaEjecucionAuto.archivo ?? '—'}</div>
            </div>
            <div className="rounded border p-3 text-sm">
              <div className="text-slate-500">Estado</div>
              <div className={`font-semibold ${ultimaEjecucionAuto.estado === 'exitoso' ? 'text-emerald-700' : 'text-red-700'}`}>
                {ultimaEjecucionAuto.estado === 'exitoso' ? '✅ Exitoso' : `❌ ${ultimaEjecucionAuto.estado}`}
              </div>
            </div>
            <div className="rounded border p-3 text-sm">
              <div className="text-slate-500">Ejecutado</div>
              <div className="font-semibold text-slate-700">{fmtFechaCo(ultimaEjecucionAuto.finalizado_en)}</div>
            </div>
            <div className="rounded border p-3 text-sm">
              <div className="text-slate-500">Filas</div>
              <div className="font-semibold text-slate-700">
                {ultimaEjecucionAuto.total_encontrados} encontradas, {ultimaEjecucionAuto.cargados} cargadas,{' '}
                {ultimaEjecucionAuto.con_error} con error
              </div>
            </div>
            {ultimaEjecucionAuto.error_general && (
              <div className="sm:col-span-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {ultimaEjecucionAuto.error_general}
              </div>
            )}
          </div>
        )}
        <p className="text-xs text-slate-400">
          Este estado se actualiza automáticamente 3 veces al día (6:00, 12:00 y 18:00, hora Colombia) y
          también cada vez que uses "Probar ahora" más abajo.
        </p>
      </div>

      <div className="tarjeta tarjeta-pad space-y-2">
        <p className="text-sm text-slate-600">
          Probar ahora: ejecuta manualmente el mismo proceso automático (buscar el archivo en la ruta
          guardada y sincronizarlo) sin esperar al próximo horario. Útil para confirmar que la ruta y
          el archivo están correctamente configurados.
        </p>
        <button
          type="button"
          className="btn btn-secundario"
          onClick={probarCargaAutomatica}
          disabled={probandoCargaExcel}
        >
          {probandoCargaExcel ? 'Ejecutando…' : '▶️ Probar ahora'}
        </button>
        {resultadoPruebaCargaExcel && (
          <div className="aviso aviso-info">{resultadoPruebaCargaExcel}</div>
        )}
      </div>
    </div>
  )
}
