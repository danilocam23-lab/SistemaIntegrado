import { useEffect, useMemo, useState } from 'react'
import client from '../api/client'
import { useLista } from '../api/hooks'
import { useAuth } from '../context/AuthContext'
import type { Configuracion, Tarifa } from '../types'
import { Boton, EncabezadoPagina, Icono, TablaScroll } from '../components/ui'

interface FilaGeneral {
  id: string
  periodo: string
  valorHora: string
  horasComprometidas: string
  totalComprometido: string
  horasFacturadas: string
  totalFacturado: string
  deuda: string
  observacion: string
}

const CLAVE_FILAS = 'facturacion.general.manual_rows'

function crearFila(): FilaGeneral {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    periodo: '',
    valorHora: '',
    horasComprometidas: '',
    totalComprometido: '',
    horasFacturadas: '',
    totalFacturado: '',
    deuda: '',
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

function formatoNumero(valor: number): string {
  return valor.toLocaleString('es-CO', { maximumFractionDigits: 2 })
}

export default function FacturacionGeneral() {
  const { tienePermiso } = useAuth()
  const puedeEditarFacturacion = tienePermiso('admin.configuracion.editar')
  const { datos: configuraciones, cargando, error, recargar } = useLista<Configuracion>('/configuracion')
  const { datos: tarifas } = useLista<Tarifa>('/tarifas')
  const [filas, setFilas] = useState<FilaGeneral[]>([])
  const [inicializado, setInicializado] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<'ok' | 'error' | ''>('')

  const configFilas = useMemo(
    () => configuraciones.find((c) => c.clave === CLAVE_FILAS),
    [configuraciones],
  )

  const valorHoraAutomatico = useMemo(() => {
    const cfg = configuraciones.find((c) => c.clave === 'facturacion.valor_hora')
    if (cfg?.valor) {
      const n = Number(cfg.valor.replace(',', '.'))
      if (Number.isFinite(n)) return n
    }
    const anioActual = new Date().getFullYear()
    const tarifaAnioActual = tarifas.find((t) => t.anio === anioActual)
    if (tarifaAnioActual) return Number(tarifaAnioActual.valor_hora)
    const ordenadas = [...tarifas].sort((a, b) => b.anio - a.anio)
    if (ordenadas.length > 0) return Number(ordenadas[0].valor_hora)
    return null
  }, [configuraciones, tarifas])

  const valorHoraAutomaticoTexto = useMemo(
    () => (valorHoraAutomatico != null ? String(valorHoraAutomatico) : ''),
    [valorHoraAutomatico],
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
  }, [configFilas, inicializado])

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
      const filasParaGuardar = filas.map((f) => {
        const totalComprometidoNum = aNumero(valorHoraAutomaticoTexto) * aNumero(f.horasComprometidas)
        const totalFacturadoNum = aNumero(valorHoraAutomaticoTexto) * aNumero(f.horasFacturadas)
        return {
          ...f,
          valorHora: valorHoraAutomaticoTexto,
          totalComprometido: totalComprometidoNum.toString(),
          totalFacturado: totalFacturadoNum.toString(),
          deuda: f.deuda,
        }
      })
      await client.put(`/configuracion/${CLAVE_FILAS}`, {
        valor: JSON.stringify(filasParaGuardar),
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
    const valorHora = aNumero(valorHoraAutomaticoTexto)
    let horasComprometidas = 0
    let totalComprometido = 0
    let horasFacturadas = 0
    let totalFacturado = 0
    let deuda = 0

    for (const f of filas) {
      const hc = aNumero(f.horasComprometidas)
      const hf = aNumero(f.horasFacturadas)
      horasComprometidas += hc
      horasFacturadas += hf
      totalComprometido += valorHora * hc
      totalFacturado += valorHora * hf
      deuda += aNumero(f.deuda)
    }

    return {
      horasComprometidas,
      totalComprometido,
      horasFacturadas,
      totalFacturado,
      deuda,
    }
  }, [filas, valorHoraAutomaticoTexto])

  return (
    <div className="space-y-4">
      <EncabezadoPagina
        icono={<Icono nombre="facturacion" />}
        titulo="Facturación — General"
        descripcion="Tabla manual: sin funciones automáticas en horas. El valor hora viene automático de configuración."
        acciones={
          puedeEditarFacturacion ? (
            <>
              <Boton variante="primario" tamano="sm" onClick={agregarFila}>
                Agregar fila
              </Boton>
              <Boton
                variante="primario"
                tamano="sm"
                onClick={() => void guardarCambios()}
                disabled={guardando || !inicializado}
              >
                {guardando ? 'Guardando…' : 'Guardar cambios'}
              </Boton>
            </>
          ) : undefined
        }
      />

      {error && <div className="aviso aviso-error">{error}</div>}
      {mensaje === 'ok' && <div className="aviso aviso-exito">Cambios guardados.</div>}
      {mensaje === 'error' && <div className="aviso aviso-error">Error al guardar.</div>}

      <TablaScroll>
        <table className="tabla min-w-[1200px]">
          <thead>
            <tr>
              <th>Periodo (15 a 15)</th>
              <th className="text-right">Valor hora</th>
              <th className="text-right">Horas comprometidas</th>
              <th className="text-right">Total comprometido</th>
              <th className="text-right">Horas facturadas</th>
              <th className="text-right">Total facturado</th>
              <th className="text-right">Deuda</th>
              <th>Observaciones</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(cargando || !inicializado) && (
              <tr>
                <td colSpan={9} className="p-4 text-center text-slate-400">Cargando…</td>
              </tr>
            )}
            {!cargando && inicializado && filas.map((f) => (
              <tr key={f.id} className="align-top">
                {(() => {
                  const totalComprometidoNum = aNumero(valorHoraAutomaticoTexto) * aNumero(f.horasComprometidas)
                  const totalFacturadoNum = aNumero(valorHoraAutomaticoTexto) * aNumero(f.horasFacturadas)
                  return (
                    <>
                <td>
                  <input
                    value={f.periodo}
                    onChange={(e) => actualizar(f.id, 'periodo', e.target.value)}
                    readOnly={!puedeEditarFacturacion}
                    placeholder="Enero - Febrero"
                    className="campo campo-sm w-44"
                  />
                </td>
                <td>
                  <input
                    value={valorHoraAutomaticoTexto ? formatoCOP(aNumero(valorHoraAutomaticoTexto)) : ''}
                    readOnly
                    className="campo campo-sm w-32 text-right"
                  />
                </td>
                <td>
                  <input
                    value={f.horasComprometidas}
                    onChange={(e) => actualizar(f.id, 'horasComprometidas', e.target.value)}
                    readOnly={!puedeEditarFacturacion}
                    className="campo campo-sm w-32 text-right"
                  />
                </td>
                <td>
                  <input
                    value={formatoCOP(totalComprometidoNum)}
                    readOnly
                    className="campo campo-sm w-36 text-right"
                  />
                </td>
                <td>
                  <input
                    value={f.horasFacturadas}
                    onChange={(e) => actualizar(f.id, 'horasFacturadas', e.target.value)}
                    readOnly={!puedeEditarFacturacion}
                    className="campo campo-sm w-32 text-right"
                  />
                </td>
                <td>
                  <input
                    value={formatoCOP(totalFacturadoNum)}
                    readOnly
                    className="campo campo-sm w-36 text-right"
                  />
                </td>
                <td>
                  <input
                    value={f.deuda}
                    onChange={(e) => actualizar(f.id, 'deuda', e.target.value)}
                    onBlur={(e) => {
                      const n = aNumero(e.target.value)
                      if (e.target.value.trim() === '') return
                      actualizar(f.id, 'deuda', formatoCOP(n))
                    }}
                    readOnly={!puedeEditarFacturacion}
                    className={`w-32 rounded border border-slate-200 px-2 py-1 text-right read-only:bg-slate-50 ${
                      aNumero(f.deuda) < 0 ? 'text-emerald-600' : aNumero(f.deuda) > 0 ? 'text-red-600' : 'text-slate-600'
                    }`}
                  />
                </td>
                <td className="min-w-[260px]">
                  <textarea
                    rows={2}
                    value={f.observacion}
                    onChange={(e) => actualizar(f.id, 'observacion', e.target.value)}
                    readOnly={!puedeEditarFacturacion}
                    className="campo campo-sm w-full resize-none"
                  />
                </td>
                <td className="text-center">
                  {puedeEditarFacturacion && (
                    <Boton variante="peligro" tamano="sm" onClick={() => eliminarFila(f.id)}>
                      Quitar
                    </Boton>
                  )}
                </td>
                    </>
                  )
                })()}
              </tr>
            ))}
          </tbody>
          {!cargando && inicializado && filas.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-marca-osc bg-slate-50 font-semibold text-slate-700">
                <td>Total</td>
                <td className="text-right">—</td>
                <td className="text-right">{formatoNumero(totales.horasComprometidas)}</td>
                <td className="text-right">{formatoCOP(totales.totalComprometido)}</td>
                <td className="text-right">{formatoNumero(totales.horasFacturadas)}</td>
                <td className="text-right">{formatoCOP(totales.totalFacturado)}</td>
                <td className={`text-right ${totales.deuda < 0 ? 'text-emerald-700' : totales.deuda > 0 ? 'text-red-700' : ''}`}>
                  {formatoCOP(Math.abs(totales.deuda))}
                </td>
                <td />
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </TablaScroll>
    </div>
  )
}
