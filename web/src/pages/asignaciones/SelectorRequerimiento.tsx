import { Chip, Icono } from '../../components/ui'
import { tonoEstadoChip } from './estados'
import type { useFormularioAsignacion } from './useFormularioAsignacion'

interface Props {
  form: ReturnType<typeof useFormularioAsignacion>
}

/**
 * Combobox de selección única de requerimiento (SC - REQ - Nombre) con búsqueda.
 * No es `FiltroDesplegable` (ese es multi-selección). Controlado por `form`.
 */
export function SelectorRequerimiento({ form }: Props) {
  return (
    <div ref={form.reqBoxRef} className="relative min-w-0 flex-1 basis-full text-sm sm:min-w-[320px]">
      <span className="mb-1 block text-slate-600">
        Requerimiento <span className="text-slate-400">(opcional)</span>
      </span>
      <input
        value={form.busquedaReq}
        onChange={(e) => form.cambiarBusquedaReq(e.target.value)}
        onFocus={() => form.setDropdownReqAbierto(true)}
        placeholder="Buscar SC - REQ - Nombre"
        className="campo w-full"
      />
      {form.busquedaReq && (
        <button
          type="button"
          onClick={form.limpiarRequerimiento}
          className="absolute right-3 top-[34px] text-slate-400 hover:text-slate-700"
          aria-label="Limpiar requerimiento"
        >
          <Icono nombre="x" />
        </button>
      )}
      {form.dropdownReqAbierto && (
        <div className="panel-desplegable w-full p-0">
          {form.opcionesReqFiltradas.length > 0 ? (
            form.opcionesReqFiltradas.map((opcion) => (
              <button
                key={opcion.id}
                type="button"
                onClick={() => form.seleccionarReq(opcion)}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 ${form.requerimientoId === opcion.id ? 'bg-marca/10 text-marca-osc' : ''}`}
              >
                <span className="truncate">{opcion.label}</span>
                {opcion.estado && (
                  <Chip tono={tonoEstadoChip(opcion.estado)} className="shrink-0 px-1.5 py-0.5 text-[10px]">
                    {opcion.estado.length > 20 ? opcion.estado.slice(0, 20) + '…' : opcion.estado}
                  </Chip>
                )}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-slate-500">Sin coincidencias.</div>
          )}
        </div>
      )}
    </div>
  )
}
