import { useRef, useState } from 'react'
import type React from 'react'
import client from '../../api/client'
import { mensajeError } from '../../api/hooks'

/** Carga de un Excel de estimación para un requerimiento. Expone el `ref` del
 *  `<input type="file">` y sus handlers; el `<input>` en sí sigue montado en el shell,
 *  fuera de todo condicional (invariante 2 del ADR 0005) — este hook NO lo renderiza.
 *  Se invoca sin condición en el shell (regla de oro del ADR 0005). */
export function useCargaEstimacion(
  puedeGestionarEstimaciones: boolean,
  setAviso: (v: string) => void,
  refreshEstimacionIds: () => Promise<void>,
  openEstimationModal: (reqId: string) => Promise<void>,
) {
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  // INVARIANTE 2 (riesgo nº1 del troceo completo): hay DOS disparadores del mismo
  // <input> — el botón de carga de la fila y "Reemplazar" del modal. El input debe
  // seguir montado siempre en el shell, nunca condicional. `handleFileSelected` hace
  // `await openEstimationModal(reqId)` DESPUÉS de subir: el input debe seguir vivo
  // mientras el modal se reabre.
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadTargetRef = useRef<string | null>(null)

  function handleUploadClick(reqId: string): void {
    if (!puedeGestionarEstimaciones) return
    uploadTargetRef.current = reqId
    fileInputRef.current?.click()
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    if (!puedeGestionarEstimaciones) return
    const file = e.target.files?.[0]
    if (!file || !uploadTargetRef.current) return
    const reqId = uploadTargetRef.current
    // INVARIANTE 3: e.target.value = '' va ANTES del await (permite re-elegir el mismo
    // archivo). uploadTargetRef.current se lee al inicio (arriba) y se limpia en el
    // finally, más abajo. No convertir el ref en estado, no reordenar estas líneas.
    e.target.value = ''

    setAviso('')
    setUploadingId(reqId)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      let binary = ''
      for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
      const base64 = btoa(binary)

      await client.post(`/estimaciones/upload/${reqId}`, {
        file_base64: base64,
        file_name: file.name,
      })

      await refreshEstimacionIds()
      await openEstimationModal(reqId)
    } catch (err) {
      setAviso(mensajeError(err))
    } finally {
      setUploadingId(null)
      uploadTargetRef.current = null
    }
  }

  return {
    fileInputRef,
    uploadTargetRef,
    uploadingId,
    handleUploadClick,
    handleFileSelected,
  }
}
