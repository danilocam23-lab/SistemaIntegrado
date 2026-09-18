// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

/** Llama a un endpoint de `/api/integracion/*` autenticado con `X-API-Key` (sin pasar por el cliente axios). */
export async function consultarIntegracion(
  ruta: string,
  apiKey: string,
  params?: Record<string, string>,
  nombreClave = "API Key",
): Promise<unknown> {
  const query = new URLSearchParams(params ?? {})
  const queryString = query.toString()
  const url = `${import.meta.env.BASE_URL}api${ruta}${queryString ? `?${queryString}` : ''}`
  const resp = await fetch(url, {
    headers: { 'X-API-Key': apiKey },
  })
  const texto = await resp.text()
  let data: unknown = texto
  if (texto) {
    try {
      data = JSON.parse(texto)
    } catch {
      data = texto
    }
  }
  if (!resp.ok) {
    const detalle = data && typeof data === 'object' && 'detail' in data
      ? String((data as { detail: unknown }).detail)
      : `HTTP ${resp.status}`
    const ayuda = resp.status === 401 ? ` Verifica que estés usando ${nombreClave}.` : ''
    throw new Error(`${detalle}.${ayuda}`)
  }
  return data
}
