export type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface EndpointDoc {
  modulo: string
  metodo: Metodo
  ruta: string
  descripcion: string
  parametros?: string
  cuerpo?: string
  permisos?: string
}
