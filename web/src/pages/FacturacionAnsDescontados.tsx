import { useEffect, useMemo, useState } from 'react'
import client from '../api/client'
import { useLista } from '../api/hooks'
import { useAuth } from '../context/AuthContext'
import type { Configuracion } from '../types'

interface FilaGeneral {
  id: string
  periodo: string
  valorDescuento: string
  fabrica: string
  soporte: string
  fechaDescuento: string
  observacion: string
}

const CLAVE_FILAS = 'facturacion.ans_descontados.manual_rows'

function crearFila(): FilaGeneral {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    periodo: '',
    valorDescuento: '',
    fabrica: '',
    soporte: '',
    fechaDescuento: '',
    observacion: '',
  }
}

function aNumero(valor: string): number {
  const limpio = valor
    .replace(/\s/g, '')
    .replace(/[^\d,.-]/g, '')
  if (!limpio) return 0

  const esNegativo = limpio.includes('-')
  const base = limpio.replace(/-/g, '')
  const tieneComa = base.includes(',')
  const tienePunto = base.includes('.')
  let normalizado = base

  if (tieneComa && tienePunto) {
    // es-CO típico: 1.234,56
    normalizado = base.replace(/\./g, '').replace(',', '.')
  } else if (tieneComa) {
    // 1234,56
    normalizado = base.replace(',', '.')
  } else if (tienePunto) {
    const partes = base.split('.')
    if (partes.length > 2) {
      // 1.234.567
      normalizado = partes.join('')
    } else {
      const [izq, der] = partes
      // Si parece separador de miles (1.000 / 12.345), quita el punto.
      if (der.length === 3) normalizado = `${izq}${der}`
    }
  }

  const n = Number(normalizado)
  if (!Number.isFinite(n)) return 0
  return esNegativo ? -n : n
}

function formatoCOP(valor: number): string {
  return valor.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  })
}

export default function FacturacionAnsDescontados() {
  const { tienePermiso } = useAuth()
  const puedeEditarFacturacion = tienePermiso('admin.configuracion.editar')
  const { datos: configuraciones, cargando, error, recargar } = useLista<Configuracion>('/configuracion')
  const [filas, setFilas] = useState<FilaGeneral[]>([])
  const [inicializado, setInicializado] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<'ok' | 'error' | ''>('')

  const configFilas = useMemo(
    () => configuraciones.find((c) => c.clave === CLAVE_FILAS),
    [configuraciones],
  )

  useEffect(() => {
    if (inicializado || cargando) return
    if (!configFilas?.valor) {
      setFilas([crearFila()])
      setInicializado(true)
      return
    }
    try {
      const parsed = JSON.parse(configFilas.valor) as FilaGeneral[]
      setFilas(Array.isArray(parsed) && parsed.length > 0 ? parsed : [crearFila()])
    } catch {
      setFilas([crearFila()])
    } finally {
      setInicializado(true)
    }
  }, [configFilas, inicializado, cargando])

  function actualizar(id: string, campo: keyof FilaGeneral, valor: string): void {
    if (!puedeEditarFacturacion) return
    setFilas((prev) => prev.map((f) => (f.id === id ? { ...f, [campo]: valor } : f)))
  }

  function agregarFila(): void {
    if (!puedeEditarFacturacion) return
    setFilas((prev) => [...prev, crearFila()])
  }

  function eliminarFila(id: string): void {
    if (!puedeEditarFacturacion) return
    setFilas((prev) => {
      const next = prev.filter((f) => f.id !== id)
      return next.length > 0 ? next : [crearFila()]
    })
  }

  async function guardarCambios(): Promise<void> {
    if (!puedeEditarFacturacion) {
      setMensaje('error')
      return
    }
    setGuardando(true)
    setMensaje('')
    try {
      await client.put(`/configuracion/${CLAVE_FILAS}`, {
        valor: JSON.stringify(filas),
        grupo: 'facturacion',
      })
      await recargar()
      setMensaje('ok')
      setTimeout(() => setMensaje(''), 2000)
    } catch {
      setMensaje('error')
    } finally {
      setGuardando(false)
    }
  }

  const totales = useMemo(() => {
    let valorDescuento = 0
    let fabrica = 0
    let soporte = 0

    for (const f of filas) {
      valorDescuento += aNumero(f.valorDescuento)
      fabrica += aNumero(f.fabrica)
      soporte += aNumero(f.soporte)
    }

    return {
      valorDescuento,
      fabrica,
      soporte,
    }
  }, [filas])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="titulo-pagina">Facturación — ANS descontados</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tabla manual: sin funciones automáticas en horas.
          </p>
        </div>
        {puedeEditarFacturacion && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={agregarFila}
              className="btn btn-primario btn-sm"
            >
              Agregar fila
            </button>
            <button
              onClick={() => void guardarCambios()}
              disabled={guardando || !inicializado}
              className="btn btn-primario btn-sm"
            >
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        )}
      </div>

      {error && <div className="aviso aviso-error">{error}</div>}
      {mensaje === 'ok' && <div className="aviso aviso-exito">Cambios guardados.</div>}
      {mensaje === 'error' && <div className="aviso aviso-error">Error al guardar.</div>}

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-marca-osc text-white">
            <tr>
              <th className="p-2 text-left">Periodo de incumplimiento</th>
              <th className="p-2 text-right">Valor descuento</th>
              <th className="p-2 text-right">Fábrica</th>
              <th className="p-2 text-right">Soporte</th>
              <th className="p-2 text-left">Fecha de Descuento</th>
              <th className="p-2 text-left">Observaciones</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {(cargando || !inicializado) && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-slate-400">Cargando…</td>
              </tr>
            )}
            {!cargando && inicializado && filas.map((f) => (
              <tr key={f.id} className="border-t align-top">
                <td className="p-2">
                  <input
                    value={f.periodo}
                    onChange={(e) => actualizar(f.id, 'periodo', e.target.value)}
                    readOnly={!puedeEditarFacturacion}
                    placeholder="Enero - Febrero"
                    className="campo campo-sm w-44"
                  />
                </td>
                <td className="p-2">
                  <input
                    value={f.valorDescuento}
                    onChange={(e) => actualizar(f.id, 'valorDescuento', e.target.value)}
                    onBlur={(e) => {
                      const n = aNumero(e.target.value)
                      actualizar(f.id, 'valorDescuento', e.target.value ? formatoCOP(n) : '')
                    }}
                    readOnly={!puedeEditarFacturacion}
                    placeholder="$ 0"
                    className="campo campo-sm w-32 text-right"
                  />
                </td>
                <td className="p-2">
                  <input
                    value={f.fabrica}
                    onChange={(e) => actualizar(f.id, 'fabrica', e.target.value)}
                    onBlur={(e) => {
                      const n = aNumero(e.target.value)
                      actualizar(f.id, 'fabrica', e.target.value ? formatoCOP(n) : '')
                    }}
                    readOnly={!puedeEditarFacturacion}
                    placeholder="$ 0"
                    className="campo campo-sm w-32 text-right"
                  />
                </td>
                <td className="p-2">
                  <input
                    value={f.soporte}
                    onChange={(e) => actualizar(f.id, 'soporte', e.target.value)}
                    onBlur={(e) => {
                      const n = aNumero(e.target.value)
                      actualizar(f.id, 'soporte', e.target.value ? formatoCOP(n) : '')
                    }}
                    readOnly={!puedeEditarFacturacion}
                    placeholder="$ 0"
                    className="campo campo-sm w-32 text-right"
                  />
                </td>
                <td className="p-2">
                  <input
                    type="date"
                    value={f.fechaDescuento}
                    onChange={(e) => actualizar(f.id, 'fechaDescuento', e.target.value)}
                    readOnly={!puedeEditarFacturacion}
                    className="campo campo-sm w-40"
                  />
                </td>
                <td className="p-2 min-w-[260px]">
                  <textarea
                    rows={2}
                    value={f.observacion}
                    onChange={(e) => actualizar(f.id, 'observacion', e.target.value)}
                    readOnly={!puedeEditarFacturacion}
                    className="campo campo-sm w-full resize-none"
                  />
                </td>
                <td className="p-2 text-center">
                  {puedeEditarFacturacion && (
                    <button
                      onClick={() => eliminarFila(f.id)}
                      className="btn btn-peligro btn-sm"
                    >
                      Quitar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          {!cargando && inicializado && filas.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-marca-osc bg-slate-50 font-semibold text-slate-700">
                <td className="p-2">Total</td>
                <td className="p-2 text-right">{formatoCOP(totales.valorDescuento)}</td>
                <td className="p-2 text-right">{formatoCOP(totales.fabrica)}</td>
                <td className="p-2 text-right">{formatoCOP(totales.soporte)}</td>
                <td className="p-2" />
                <td className="p-2" />
                <td className="p-2" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
