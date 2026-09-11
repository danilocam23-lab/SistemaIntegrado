import type { FormEvent } from 'react'
import { Boton, Campo, Icono, Selector } from '../../components/ui'
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
    <form onSubmit={onSubmit} className="tarjeta tarjeta-pad mb-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600">
          {modoEdicion && <Icono nombre="lapiz" />}
          {modoEdicion ? 'Editando asignación' : 'Nueva asignación'}
        </span>
        {modoEdicion && (
          <button
            type="button"
            onClick={form.limpiarFormulario}
            className="enlace-accion-sutil inline-flex items-center gap-1"
          >
            Cancelar edición <Icono nombre="x" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Selector
          etiqueta="Persona"
          value={form.personaId}
          onChange={(e) => form.onPersonaChange(e.target.value)}
          required
        >
          <option value="">— Seleccionar —</option>
          {personasDisponibles.map((persona) => (
            <option key={persona.id} value={persona.id}>
              {persona.nombre}
            </option>
          ))}
        </Selector>

        <Selector
          etiqueta="Categoría"
          value={form.categoriaId}
          onChange={(e) => form.setCategoriaId(e.target.value)}
          required
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
        </Selector>

        <div>
          <Campo
            etiqueta="% de carga"
            value={form.porcentaje}
            onChange={(e) => form.setPorcentaje(e.target.value)}
            type="number"
            min="0"
            max="100"
            required
            className="w-28"
          />
          {!modoEdicion && form.personaId && form.porcentaje === form.porcentajeSugerido && form.porcentaje && (
            <span className="mt-1 block text-xs text-emerald-700">{form.porcentajeSugerido}% (sugerido)</span>
          )}
        </div>

        <SelectorRequerimiento form={form} />

        <Boton type="submit" variante={modoEdicion ? 'exito' : 'primario'} disabled={!puedeEditar}>
          {modoEdicion ? 'Actualizar' : 'Crear'}
        </Boton>
      </div>
    </form>
  )
}
