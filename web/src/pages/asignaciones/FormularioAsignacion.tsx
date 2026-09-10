import type { FormEvent } from 'react'
import type { Categoria, Persona } from '../../types'
import { SelectorRequerimiento } from './SelectorRequerimiento'
import type { useFormularioAsignacion } from './useFormularioAsignacion'

interface Props {
  form: ReturnType<typeof useFormularioAsignacion>
  onSubmit: (e: FormEvent) => void
  categorias: Categoria[]
  personasDisponibles: Persona[]
  puedeEditar: boolean
}

/** Tarjeta del formulario "Nueva/Editar asignación". Controlada por `form`. */
export function FormularioAsignacion({ form, onSubmit, categorias, personasDisponibles, puedeEditar }: Props) {
  const { modoEdicion } = form
  return (
    <form onSubmit={onSubmit} className="mb-4 rounded-xl border bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-600">
          {modoEdicion ? '✏️ Editando asignación' : 'Nueva asignación'}
        </span>
        {modoEdicion && (
          <button
            type="button"
            onClick={form.limpiarFormulario}
            className="enlace-accion-sutil"
          >
            Cancelar edición ✕
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Persona</span>
          <select
            value={form.personaId}
            onChange={(e) => form.onPersonaChange(e.target.value)}
            required
            className="campo"
          >
            <option value="">— Seleccionar —</option>
            {personasDisponibles.map((persona) => (
              <option key={persona.id} value={persona.id}>
                {persona.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Categoría</span>
          <select
            value={form.categoriaId}
            onChange={(e) => form.setCategoriaId(e.target.value)}
            required
            className="campo"
          >
            <option value="">— Seleccionar —</option>
            {categorias
              .slice()
              .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'))
              .map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nombre}
                </option>
              ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-slate-600">% de carga</span>
          <input
            value={form.porcentaje}
            onChange={(e) => form.setPorcentaje(e.target.value)}
            type="number"
            min="0"
            max="100"
            required
            className="campo w-28"
          />
          {!modoEdicion && form.personaId && form.porcentaje === form.porcentajeSugerido && form.porcentaje && (
            <span className="mt-1 block text-xs text-emerald-700">{form.porcentajeSugerido}% (sugerido)</span>
          )}
        </label>

        <SelectorRequerimiento form={form} />

        <button
          disabled={!puedeEditar}
          className={`btn ${modoEdicion ? 'btn-exito' : 'btn-primario'}`}
        >
          {modoEdicion ? 'Actualizar' : 'Crear'}
        </button>
      </div>
    </form>
  )
}
