// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import type { ParametroEndpoint } from '../../types'

/** Resultado de una invocación real contra el backend (F4.7/F4.8, ADR-0008). */
export interface ResultadoInvocacion {
  estadoHttp: number | null
  estadoTexto: string
  latenciaMs: number
  cuerpo: unknown
  esError: boolean
}

export type TipoCampoInvocacion = 'texto' | 'numero' | 'boolean' | 'enum'

/** Nombres de los path params de una ruta OpenAPI, ej. `{codigo_req}` -> `codigo_req`. */
export function pathParamsDeRuta(ruta: string): string[] {
  const coincidencias = ruta.match(/\{([^}]+)\}/g) ?? []
  return coincidencias.map((m) => m.slice(1, -1))
}

/** Reemplaza los `{param}` de una ruta por los valores capturados en el formulario. */
export function construirUrlConPath(ruta: string, valoresPath: Record<string, string>): string {
  return pathParamsDeRuta(ruta).reduce(
    (acc, nombre) => acc.replace(`{${nombre}}`, encodeURIComponent(valoresPath[nombre]?.trim() ?? '')),
    ruta,
  )
}

/** Qué tipo de campo tipado usar para un parametro OpenAPI (F4.6). */
export function tipoDeCampo(parametro: ParametroEndpoint): TipoCampoInvocacion {
  const schema = parametro.schema
  if (!schema) return 'texto'
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return 'enum'
  if (schema.type === 'boolean') return 'boolean'
  if (schema.type === 'integer' || schema.type === 'number') return 'numero'
  return 'texto'
}

export function opcionesEnum(parametro: ParametroEndpoint): string[] {
  const schema = parametro.schema
  if (!schema || !Array.isArray(schema.enum)) return []
  return schema.enum.map((v) => String(v))
}

/** `true` si el `requestBody` espera un archivo (multipart/form-data): el probador no lo soporta (F4.6). */
export function esMultipart(esquemaDeCuerpo: Record<string, unknown> | null): boolean {
  if (!esquemaDeCuerpo) return false
  const contenido = esquemaDeCuerpo.content
  if (!contenido || typeof contenido !== 'object') return false
  return Object.keys(contenido as Record<string, unknown>).some((tipo) => tipo.includes('multipart'))
}

function schemaJsonDelCuerpo(esquemaDeCuerpo: Record<string, unknown> | null): Record<string, unknown> | null {
  const contenido = esquemaDeCuerpo?.content as Record<string, { schema?: unknown }> | undefined
  const schema = contenido?.['application/json']?.schema
  return schema && typeof schema === 'object' ? (schema as Record<string, unknown>) : null
}

/**
 * Valor de ejemplo mínimo para un schema de OpenAPI. No resuelve `$ref` contra
 * `components/schemas` (F4.1 lo deja crudo a propósito): si el schema es un `$ref`
 * sin resolver, cae en `{}` como placeholder razonable en vez de una interfaz inventada.
 */
function valorDeEjemplo(schema: unknown): unknown {
  if (!schema || typeof schema !== 'object') return null
  const s = schema as Record<string, unknown>
  if ('$ref' in s) return {}
  if ('example' in s) return s.example
  if (Array.isArray(s.enum) && s.enum.length > 0) return s.enum[0]
  switch (s.type) {
    case 'string':
      return ''
    case 'integer':
    case 'number':
      return 0
    case 'boolean':
      return false
    case 'array':
      return []
    case 'object':
      return objetoDeEjemplo(s)
    default:
      return s.properties ? objetoDeEjemplo(s) : {}
  }
}

function objetoDeEjemplo(schema: Record<string, unknown>): Record<string, unknown> {
  const propiedades = schema.properties
  if (!propiedades || typeof propiedades !== 'object') return {}
  const resultado: Record<string, unknown> = {}
  for (const [clave, sub] of Object.entries(propiedades as Record<string, unknown>)) {
    resultado[clave] = valorDeEjemplo(sub)
  }
  return resultado
}

/** JSON de ejemplo precargado en el `AreaTexto` del cuerpo (F4.6). Cadena vacía si no aplica. */
export function generarEjemploCuerpo(esquemaDeCuerpo: Record<string, unknown> | null): string {
  const schema = schemaJsonDelCuerpo(esquemaDeCuerpo)
  if (!schema) return ''
  return JSON.stringify(valorDeEjemplo(schema), null, 2)
}

/** `curl` equivalente a la invocación, con el token sustituido por un placeholder (F4.8). */
export function construirCurl(opciones: {
  metodo: string
  urlCompleta: string
  headers: Record<string, string>
  cuerpo?: string
}): string {
  const partes = [`curl -X ${opciones.metodo}`, `'${opciones.urlCompleta}'`]
  for (const [clave, valor] of Object.entries(opciones.headers)) {
    if (!valor) continue
    partes.push(`-H '${clave}: ${valor}'`)
  }
  if (opciones.cuerpo) {
    partes.push(`-d '${opciones.cuerpo.replace(/'/g, "'\\''")}'`)
  }
  return partes.join(' \\\n  ')
}
