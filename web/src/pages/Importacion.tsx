import { useState } from 'react'
import type { ChangeEvent } from 'react'
import client from '../api/client'
import { mensajeError } from '../api/hooks'

interface Resultado {
  filas_procesadas: number
  requerimientos_creados: number
  requerimientos_actualizados: number
  entregas_creadas: number
  entregas_actualizadas: number
  festivos_cargados: number
  errores: string[]
}

export default function Importacion() {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [hoja, setHoja] = useState('')
  const [cargando, setCargando] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [aviso, setAviso] = useState('')

  function elegir(e: ChangeEvent<HTMLInputElement>): void {
    setArchivo(e.target.files?.[0] ?? null)
    setResultado(null)
    setAviso('')
  }

  async function importar(): Promise<void> {
    if (!archivo) return
    setCargando(true)
    setAviso('')
    setResultado(null)
    try {
      const fd = new FormData()
      fd.append('archivo', archivo)
      const url = hoja
        ? `/importacion/excel?hoja=${encodeURIComponent(hoja)}`
        : '/importacion/excel'
      const { data } = await client.post<Resultado>(url, fd)
      setResultado(data)
    } catch (err) {
      setAviso(mensajeError(err))
    } finally {
      setCargando(false)
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-marca-osc">Importar Excel</h1>
      <p className="mb-4 text-sm text-slate-500">
        Carga el archivo "BITÁCORA GENERAL". Cada fila crea o actualiza un requerimiento y
        su entrega; los catálogos (personas, squads, aplicativos, tarifas) se crean al vuelo.
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Archivo .xlsx</span>
          <input type="file" accept=".xlsx,.xlsm" onChange={elegir}
            className="text-sm" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Hoja (opcional)</span>
          <input value={hoja} onChange={(e) => setHoja(e.target.value)}
            placeholder="ESTIMACIONES 2026" className="rounded border px-3 py-2" />
        </label>
        <button
          onClick={importar}
          disabled={!archivo || cargando}
          className="rounded bg-marca px-4 py-2 text-white hover:bg-marca-osc disabled:opacity-60"
        >
          {cargando ? 'Importando…' : 'Importar'}
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
    </div>
  )
}
