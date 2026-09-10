/**
 * Cabecera `X-Aplicacion` para las escrituras de asignaciones cuando el cliente
 * está en modo consolidado (`__todas__`) y el endpoint necesita el código real
 * de la aplicación. Copiado tal cual del antiguo `writeHeaders` de Asignaciones.
 */
export function cabecerasAplicacion(aplicacionId: string) {
  return { headers: { 'X-Aplicacion': aplicacionId } }
}
