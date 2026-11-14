import { buscarOperacion } from './catalogo'
import type { ServicioAnalitica } from './servicio'

interface PeticionAnalitica {
  method?: string
  url?: string
}

// Adaptador puro de Axios. No lee headers, params, data, respuestas ni errores crudos.
export function crearAdaptadorOperaciones(servicio: ServicioAnalitica) {
  const pendientes = new WeakMap<object, string | null>()
  return {
    solicitar(config: PeticionAnalitica) {
      const catalogo = buscarOperacion(config.method ?? 'GET', config.url ?? '')
      if (catalogo) pendientes.set(config, servicio.iniciarOperacion(catalogo))
    },
    finalizar(config: object | undefined, estado?: number, cancelado = false) {
      if (!config) return
      const id = pendientes.get(config)
      pendientes.delete(config)
      servicio.terminarOperacion(id ?? null, estado, cancelado)
    },
  }
}
