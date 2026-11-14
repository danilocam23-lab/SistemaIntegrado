import { buscarControl } from './catalogo'
import type { ServicioAnalitica } from './servicio'

// Política explícita: el elemento más específico gana, incluso si su ID es desconocido.
// Nada de texto, aria-label, href, nombre de campo ni valor.
export function controlDeEvento(objetivo: Element) {
  if (objetivo.closest('[disabled], [aria-disabled="true"], [inert]')) return null
  if (objetivo.closest('input[type="password"], input[type="hidden"], [data-analytics-private]')) return null
  const elemento = objetivo.closest('[data-analytics-id]')
  if (!elemento) return null
  if (Array.from(elemento.attributes).some(atributo =>
    atributo.name.startsWith('data-analytics-') && atributo.name !== 'data-analytics-id')) return null
  const id = elemento.getAttribute('data-analytics-id')
  if (!id || !buscarControl(id)) return null
  if (id === 'modal.fondo' && objetivo !== elemento) return null
  return { elemento, id }
}

export function instalarDelegacion(
  servicio: ServicioAnalitica,
  documento: Document,
  ventana: Window,
) {
  const busquedas = new Map<Element, number>()
  const obtenerElemento = (evento: Event) => evento.target instanceof Element ? evento.target : null
  function interactuar(evento: Event) {
    if (!servicio.habilitado()) return
    if (evento.type === 'input' || evento.type === 'change') iniciarFormulario(evento)
    const objetivo = obtenerElemento(evento)
    if (!objetivo) return
    const control = controlDeEvento(objetivo)
    if (!control) return
    if (evento.type === 'click') {
      const etiqueta = objetivo.closest('label')
      const campo = etiqueta?.querySelector('input[data-analytics-id], select[data-analytics-id], textarea[data-analytics-id]')
      // El click en la etiqueta reenviará click/change al campo: no contar el padre.
      if (campo && campo !== control.elemento && control.elemento.contains(campo) &&
        buscarControl(campo.getAttribute('data-analytics-id'))) return
    }
    // Inputs/selects: solo cambio; botones/links/summary: solo click.
    const catalogado = buscarControl(control.id)
    const esCampo = control.elemento.matches('input, select, textarea') && catalogado?.[1] !== 'boton'
    if (esCampo && evento.type === 'click') return
    if (!esCampo && evento.type !== 'click') return
    if (catalogado?.[1] === 'busqueda') {
      if (evento.type !== 'input') return
      const anterior = busquedas.get(control.elemento)
      if (anterior !== undefined) ventana.clearTimeout(anterior)
      busquedas.set(control.elemento, ventana.setTimeout(() => {
        busquedas.delete(control.elemento)
        if (control.elemento.isConnected) servicio.interaccion(control.id, 'input')
      }, 700))
    } else if (evento.type === 'click' || evento.type === 'change') {
      servicio.interaccion(control.id, evento.type)
      if (evento.type === 'click' && ['usuarios.cancelar', 'entrega.cancelar', 'modal.cerrar', 'modal.fondo'].includes(control.id)) {
        const contenedor = control.elemento.closest('form[data-analytics-form], [data-analytics-id="modal.fondo"]')
        if (contenedor) {
          for (const formulario of servicio.formulariosActivos()) {
            if (formulario instanceof Element && contenedor.contains(formulario)) {
              servicio.finalizarFormulario(formulario, 'cancelled')
            }
          }
        }
      }
    }
  }
  function iniciarFormulario(evento: Event) {
    const objetivo = obtenerElemento(evento)
    if (!objetivo || !objetivo.matches('input, select, textarea') ||
      objetivo.closest('[disabled], [inert], input[type="password"], input[type="hidden"], [data-analytics-private]')) return
    const formulario = objetivo.closest('form[data-analytics-form]')
    const id = formulario?.getAttribute('data-analytics-form')
    if (formulario && id) servicio.iniciarFormulario(formulario, id)
  }
  function vaciarBusquedas() {
    for (const temporizador of busquedas.values()) ventana.clearTimeout(temporizador)
    busquedas.clear()
  }
  // La retirada del modal/panel sucio equivale a abandono, nunca a éxito.
  const observador = new MutationObserver(() => {
    for (const formulario of servicio.formulariosActivos()) {
      if (formulario instanceof Element && !formulario.isConnected) servicio.finalizarFormulario(formulario, 'abandoned')
    }
  })
  observador.observe(documento.documentElement, { childList: true, subtree: true })
  function visibilidad() { servicio.visibilidad(); if (documento.visibilityState !== 'visible') vaciarBusquedas() }
  function salir() { vaciarBusquedas(); servicio.salir() }
  documento.addEventListener('click', interactuar, true)
  documento.addEventListener('change', interactuar, true)
  documento.addEventListener('input', interactuar, true)
  documento.addEventListener('visibilitychange', visibilidad)
  ventana.addEventListener('pagehide', salir)
  return {
    vaciarBusquedas,
    desinstalar() {
      vaciarBusquedas()
      observador.disconnect()
      documento.removeEventListener('click', interactuar, true)
      documento.removeEventListener('change', interactuar, true)
      documento.removeEventListener('input', interactuar, true)
      documento.removeEventListener('visibilitychange', visibilidad)
      ventana.removeEventListener('pagehide', salir)
    },
  }
}
