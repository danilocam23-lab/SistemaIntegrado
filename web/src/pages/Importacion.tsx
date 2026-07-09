import { useState } from 'react'
import type { ChangeEvent } from 'react'
import client from '../api/client'
import { mensajeError } from '../api/hooks'
import Modal from '../components/Modal'

interface Resultado {
  filas_procesadas: number
  requerimientos_creados: number
  requerimientos_actualizados: number
  entregas_creadas: number
  entregas_actualizadas: number
  festivos_cargados: number
  errores: string[]
}

interface CampoCambio {
  campo: string
  antes: string | null
  despues: string | null
}

interface DiffReg {
  clave: string
  nombre?: string
  cambios: CampoCambio[]
}

interface Previsualizacion {
  filas_requerimientos: number
  filas_entregas: number
  requerimientos_nuevos: number
  requerimientos_actualizados: number
  entregas_nuevas: number
  entregas_actualizadas: number
  detalle_requerimientos_nuevos?: string[]
  detalle_requerimientos_actualizados?: string[]
  detalle_entregas_nuevas?: string[]
  detalle_entregas_actualizadas?: string[]
  diff_requerimientos_actualizados?: DiffReg[]
  diff_entregas_actualizadas?: DiffReg[]
}

export default function Importacion() {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [cargando, setCargando] = useState(false)
  const [previsualizando, setPrevisualizando] = useState(false)
  const [descargando, setDescargando] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [preview, setPreview] = useState<Previsualizacion | null>(null)
  const [confirmacionAbierta, setConfirmacionAbierta] = useState(false)
  const [aviso, setAviso] = useState('')

  function elegir(e: ChangeEvent<HTMLInputElement>): void {
    setArchivo(e.target.files?.[0] ?? null)
    setResultado(null)
    setPreview(null)
    setConfirmacionAbierta(false)
    setAviso('')
  }

  async function previsualizarImportacion(): Promise<void> {
    if (!archivo) return
    setPrevisualizando(true)
    setAviso('')
    setResultado(null)
    try {
      const fd = new FormData()
      fd.append('archivo', archivo)
      const { data } = await client.post<Previsualizacion>('/importacion/excel/previsualizar', fd)
      setPreview(data)
      setConfirmacionAbierta(true)
    } catch (err) {
      setAviso(mensajeError(err))
    } finally {
      setPrevisualizando(false)
    }
  }

  async function confirmarImportacion(): Promise<void> {
    if (!archivo) return
    setCargando(true)
    setAviso('')
    try {
      const fd = new FormData()
      fd.append('archivo', archivo)
      const { data } = await client.post<Resultado>('/importacion/excel', fd)
      setResultado(data)
      setConfirmacionAbierta(false)
    } catch (err) {
      setAviso(mensajeError(err))
    } finally {
      setCargando(false)
    }
  }

  async function exportarPlantilla(): Promise<void> {
    setDescargando(true)
    setAviso('')
    try {
      const respuesta = await client.get<Blob>('/importacion/excel/plantilla', {
        responseType: 'blob',
      })
      const archivo = new Blob([respuesta.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = window.URL.createObjectURL(archivo)
      const enlace = document.createElement('a')
      enlace.href = url
      enlace.download = 'plantilla_requerimientos_entregas.xlsx'
      document.body.appendChild(enlace)
      enlace.click()
      enlace.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      const blobError = (err as { response?: { data?: unknown } })?.response?.data
      if (typeof Blob !== 'undefined' && blobError instanceof Blob) {
        try {
          const texto = await blobError.text()
          try {
            const detalle = JSON.parse(texto)?.detail
            if (typeof detalle === 'string') {
              setAviso(detalle)
              return
            }
          } catch {
            if (texto.trim()) {
              setAviso(texto.trim())
              return
            }
          }
        } catch {
          // Se usa el extractor estándar de mensajes.
        }
      }
      setAviso(mensajeError(err))
    } finally {
      setDescargando(false)
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-marca-osc">Importar / Exportar datos</h1>
      <p className="mb-4 text-sm text-slate-500">
        Exporta la plantilla con dos hojas: <b>REQUERIMIENTOS</b> y <b>ENTREGAS</b>. Luego
        importa el archivo y confirma el resumen de registros nuevos/actualizados.
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
        <button
          onClick={exportarPlantilla}
          disabled={descargando}
          className="rounded border border-marca px-4 py-2 text-marca hover:bg-marca/5 disabled:opacity-60"
        >
          {descargando ? 'Exportando…' : 'Exportar plantilla'}
        </button>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Archivo .xlsx</span>
          <input type="file" accept=".xlsx,.xlsm" onChange={elegir}
            className="text-sm" />
        </label>
        <button
          onClick={previsualizarImportacion}
          disabled={!archivo || cargando || previsualizando}
          className="rounded bg-marca px-4 py-2 text-white hover:bg-marca-osc disabled:opacity-60"
        >
          {previsualizando ? 'Verificando…' : 'Importar'}
        </button>
      </div>

      {aviso && <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{aviso}</div>}

      {resultado && (
        <div className="rounded-xl border bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Resultado
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Filas procesadas', resultado.filas_procesadas],
              ['Requerimientos creados', resultado.requerimientos_creados],
              ['Requerimientos actualizados', resultado.requerimientos_actualizados],
              ['Entregas creadas', resultado.entregas_creadas],
              ['Entregas actualizadas', resultado.entregas_actualizadas],
              ['Festivos cargados', resultado.festivos_cargados],
            ].map(([etiqueta, valor]) => (
              <div key={etiqueta} className="rounded border p-3">
                <div className="text-2xl font-bold text-marca-osc">{valor}</div>
                <div className="text-xs text-slate-500">{etiqueta}</div>
              </div>
            ))}
          </div>
          {resultado.errores.length > 0 && (
            <div className="mt-4">
              <div className="mb-1 text-sm font-semibold text-amber-700">
                {resultado.errores.length} fila(s) con error
              </div>
              <ul className="max-h-48 overflow-auto text-xs text-amber-700">
                {resultado.errores.map((err, i) => <li key={i}>• {err}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      <Modal
        titulo="Confirmar importación"
        abierto={confirmacionAbierta}
        onCerrar={() => {
          if (!cargando) setConfirmacionAbierta(false)
        }}
      >
        {!preview ? null : (
          <div className="space-y-3 text-sm">
            <p className="text-slate-600">
              Se verificó el archivo. Confirma para aplicar los cambios:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded border p-2">Requerimientos en archivo: <b>{preview.filas_requerimientos}</b></div>
              <div className="rounded border p-2">Entregas en archivo: <b>{preview.filas_entregas}</b></div>
              <div className="rounded border p-2 text-green-700">Req nuevos: <b>{preview.requerimientos_nuevos}</b></div>
              <div className="rounded border p-2 text-blue-700">Req actualizados: <b>{preview.requerimientos_actualizados}</b></div>
              <div className="rounded border p-2 text-green-700">Entregas nuevas: <b>{preview.entregas_nuevas}</b></div>
              <div className="rounded border p-2 text-blue-700">Entregas actualizadas: <b>{preview.entregas_actualizadas}</b></div>
            </div>
            <div className="max-h-64 space-y-3 overflow-auto rounded border bg-slate-50 p-2 text-xs">
              {/* Reqs nuevos */}
              {(preview.detalle_requerimientos_nuevos?.length ?? 0) > 0 && (
                <div>
                  <div className="mb-1 font-semibold text-green-700">Requerimientos nuevos</div>
                  {(preview.detalle_requerimientos_nuevos ?? []).map((x) => (
                    <div key={`rn-${x}`} className="text-slate-600">• {x}</div>
                  ))}
                </div>
              )}

              {/* Reqs con cambios: tabla antes/después por campo */}
              {(preview.diff_requerimientos_actualizados?.length ?? 0) > 0 && (
                <div>
                  <div className="mb-1 font-semibold text-blue-700">Requerimientos actualizados</div>
                  {(preview.diff_requerimientos_actualizados ?? []).map((d) => (
                    <details key={`ra-${d.clave}`} className="mb-1">
                      <summary className="cursor-pointer text-blue-600 hover:underline">
                        {d.nombre || d.clave}
                      </summary>
                      <table className="mt-1 w-full border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-200">
                            <th className="border px-1 py-0.5 text-left">Campo</th>
                            <th className="border px-1 py-0.5 text-left">Antes</th>
                            <th className="border px-1 py-0.5 text-left">Después</th>
                          </tr>
                        </thead>
                        <tbody>
                          {d.cambios.map((c, i) => (
                            <tr key={i} className="odd:bg-white even:bg-slate-50">
                              <td className="border px-1 py-0.5 font-medium">{c.campo}</td>
                              <td className="border px-1 py-0.5 text-red-600">{c.antes ?? <em className="text-slate-400">vacío</em>}</td>
                              <td className="border px-1 py-0.5 text-green-700">{c.despues ?? <em className="text-slate-400">vacío</em>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  ))}
                </div>
              )}

              {/* Entregas nuevas */}
              {(preview.detalle_entregas_nuevas?.length ?? 0) > 0 && (
                <div>
                  <div className="mb-1 font-semibold text-green-700">Entregas nuevas</div>
                  {(preview.detalle_entregas_nuevas ?? []).map((x) => (
                    <div key={`en-${x}`} className="text-slate-600">• {x}</div>
                  ))}
                </div>
              )}

              {/* Entregas con cambios: tabla antes/después */}
              {(preview.diff_entregas_actualizadas?.length ?? 0) > 0 && (
                <div>
                  <div className="mb-1 font-semibold text-blue-700">Entregas actualizadas</div>
                  {(preview.diff_entregas_actualizadas ?? []).map((d) => (
                    <details key={`ea-${d.clave}`} className="mb-1">
                      <summary className="cursor-pointer text-blue-600 hover:underline">
                        {d.clave}
                      </summary>
                      <table className="mt-1 w-full border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-200">
                            <th className="border px-1 py-0.5 text-left">Campo</th>
                            <th className="border px-1 py-0.5 text-left">Antes</th>
                            <th className="border px-1 py-0.5 text-left">Después</th>
                          </tr>
                        </thead>
                        <tbody>
                          {d.cambios.map((c, i) => (
                            <tr key={i} className="odd:bg-white even:bg-slate-50">
                              <td className="border px-1 py-0.5 font-medium">{c.campo}</td>
                              <td className="border px-1 py-0.5 text-red-600">{c.antes ?? <em className="text-slate-400">vacío</em>}</td>
                              <td className="border px-1 py-0.5 text-green-700">{c.despues ?? <em className="text-slate-400">vacío</em>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  ))}
                </div>
              )}

              {((preview.detalle_requerimientos_nuevos?.length ?? 0) +
                (preview.diff_requerimientos_actualizados?.length ?? 0) +
                (preview.detalle_entregas_nuevas?.length ?? 0) +
                (preview.diff_entregas_actualizadas?.length ?? 0)) === 0 && (
                <div className="py-2 text-center text-slate-500">No se detectaron cambios.</div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmacionAbierta(false)}
                disabled={cargando}
                className="rounded border px-3 py-2 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarImportacion}
                disabled={cargando}
                className="rounded bg-marca px-3 py-2 text-white hover:bg-marca-osc disabled:opacity-60"
              >
                {cargando ? 'Importando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
