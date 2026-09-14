import type { Metodo } from './tipos'

/**
 * Excepcion categorica ADR-0007: el color identifica el verbo, no un estado.
 * La forma la da `.chip` via <Chip tono="categoria">; aqui solo el par bg/text.
 *
 * F4.5 (ADR-0008): la lista a mano de 113 endpoints (`ENDPOINTS`) se elimino;
 * el catalogo real sale de `GET /api/admin/endpoints/catalogo` (ver
 * `useAdminEndpoints.ts`). Este mapa de estilos por metodo HTTP no es un dato
 * derivable de OpenAPI (es una decision visual del sistema de diseno), asi que
 * se conserva aqui.
 */
export const metodoClase: Record<Metodo, string> = {
  GET: 'bg-emerald-50 text-emerald-700',
  POST: 'bg-blue-50 text-blue-700',
  PUT: 'bg-amber-50 text-amber-700',
  PATCH: 'bg-purple-50 text-purple-700',
  DELETE: 'bg-red-50 text-red-700',
}
