import { useCallback, useMemo, useState } from 'react'
import { useLista } from '../api/hooks'
import client from '../api/client'
import type { Configuracion, Requerimiento, Tarifa } from '../types'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const MESES_ABREV: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
  jan: 1, apr: 4, aug: 8, dec: 12,
}

/**
 * Convierte `mes_aprobacion` al número de mes (1-12).
 * Después de la normalización del back, el valor es "Enero", "Febrero", etc.
 * También acepta formatos legados: "YYYY-MM", "Enero 2025", "ENE-2025", etc.
 */
function mesAprobacionANumero(raw: string): number | null {
  const s = raw.trim()
  if (!s) return null
  const norm3 = (txt: string) =>
    txt.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 3)
  // Caso normalizado: "Enero", "Febrero", etc. (solo texto)
  if (/^[A-Za-z\u00C0-\u024F]+$/.test(s)) return MESES_ABREV[norm3(s)] ?? null
  // Fecha ISO: "YYYY-MM-DD..."
  const iso = s.match(/^\d{4}-(\d{2})-\d{2}/)
  if (iso) return parseInt(iso[1], 10)
  // "YYYY-MM" o "YYYY/MM"
  const yyyymm = s.match(/^\d{4}[-/](\d{1,2})$/)
  if (yyyymm) return parseInt(yyyymm[1], 10)
  // "MM/YYYY" o "MM-YYYY"
  const mmyyyy = s.match(/^(\d{1,2})[-/]\d{4}$/)
  if (mmyyyy) return parseInt(mmyyyy[1], 10)
  // "Enero 2025", "ENE-2025"
  const textFirst = s.match(/^([A-Za-z\u00C0-\u024F]+)/)
  if (textFirst) return MESES_ABREV[norm3(textFirst[1])] ?? null
  return null
}

function formatearMes(yyyymm: string): string {
  const [anio, mes] = yyyymm.split('-')
  const idx = parseInt(mes, 10) - 1
  return `${MESES[idx] ?? mes} ${anio}`
}

function formatCOP(valor: number): string {
  return valor.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}

export default function FacturacionGeneral() {
  const { datos: requerimientos, cargando, error } = useLista<Requerimiento>('/requerimientos')
  const { datos: tarifas, cargando: cargandoTarifas } = useLista<Tarifa>('/tarifas')
  const { datos: configuraciones, recargar: recargarConfig } = useLista<Configuracion>('/configuracion')

  // Observaciones: mapa yyyymm → texto guardado en BD
  const obsGuardadas = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of configuraciones) {
      if (c.clave.startsWith('facturacion.obs.')) {
        m.set(c.clave.slice('facturacion.obs.'.length), c.valor)
      }
    }
    return m
  }, [configuraciones])

  // Estado local de edición: yyyymm → texto en curso
  const [obsLocal, setObsLocal] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState<Record<string, boolean>>({})
  const [obsMsg, setObsMsg] = useState<Record<string, string>>({})

  const textoObs = useCallback(
    (yyyymm: string) => obsLocal[yyyymm] ?? obsGuardadas.get(yyyymm) ?? '',
    [obsLocal, obsGuardadas],
  )

  const guardarObs = useCallback(async (yyyymm: string) => {
    const texto = obsLocal[yyyymm] ?? obsGuardadas.get(yyyymm) ?? ''
    setGuardando((g) => ({ ...g, [yyyymm]: true }))
    setObsMsg((m) => ({ ...m, [yyyymm]: '' }))
    try {
      await client.put(`/configuracion/facturacion.obs.${yyyymm}`, {
        valor: texto,
        grupo: 'facturacion',
      })
      recargarConfig()
      setObsMsg((m) => ({ ...m, [yyyymm]: 'ok' }))
      setTimeout(() => setObsMsg((m) => ({ ...m, [yyyymm]: '' })), 2000)
    } catch {
      setObsMsg((m) => ({ ...m, [yyyymm]: 'error' }))
    } finally {
      setGuardando((g) => ({ ...g, [yyyymm]: false }))
    }
  }, [obsLocal, obsGuardadas, recargarConfig])

  /** Mapa año → valor_hora (primera tarifa encontrada por año) */
  const tarifaPorAnio = useMemo(() => {
    const mapa = new Map<number, number>()
    for (const t of tarifas) {
      if (!mapa.has(t.anio)) mapa.set(t.anio, Number(t.valor_hora))
    }
    return mapa
  }, [tarifas])

  /** Mapa tarifaId → valor_hora para resolución precisa por requerimiento */
  const tarifaPorId = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const t of tarifas) mapa.set(t.id, Number(t.valor_hora))
    return mapa
  }, [tarifas])

  const { comprometido, facturado, mesesUnion, sinParsear } = useMemo(() => {
    const comp = new Map<string, { horas: number; total: number }>()
    const fact = new Map<string, { horas: number; total: number }>()
    const noParseados = new Set<string>()

    for (const req of requerimientos) {
      const valorHoraReq =
        (req.solicitud?.tarifa_id ? tarifaPorId.get(req.solicitud.tarifa_id) : undefined) ??
        (req.solicitud?.anio_tarifa ? tarifaPorAnio.get(req.solicitud.anio_tarifa) : undefined)

      for (const en of req.entregas ?? []) {
        const horas = en.horas == null ? null : Number(en.horas)

        // ── Comprometido: por fecha_comprometida ──
        if (en.fecha_comprometida && horas != null) {
          const yyyymm = en.fecha_comprometida.slice(0, 7)
          const anio = parseInt(yyyymm.slice(0, 4), 10)
          const vh = valorHoraReq ?? tarifaPorAnio.get(anio) ?? 0
          const prev = comp.get(yyyymm) ?? { horas: 0, total: 0 }
          comp.set(yyyymm, { horas: prev.horas + horas, total: prev.total + horas * vh })
        }

        // ── Facturado: por mes_aprobacion (año derivado de fecha_comprometida o anio_tarifa) ──
        if (en.mes_aprobacion && horas != null) {
          const mesNum = mesAprobacionANumero(en.mes_aprobacion)
          if (mesNum) {
            // Año: prioridad → fecha_comprometida → anio_tarifa → null
            const anioBase =
              en.fecha_comprometida
                ? parseInt(en.fecha_comprometida.slice(0, 4), 10)
                : req.solicitud?.anio_tarifa ?? null
            if (anioBase) {
              const yyyymm = `${anioBase}-${String(mesNum).padStart(2, '0')}`
              const vh = valorHoraReq ?? tarifaPorAnio.get(anioBase) ?? 0
              const prev = fact.get(yyyymm) ?? { horas: 0, total: 0 }
              fact.set(yyyymm, { horas: prev.horas + horas, total: prev.total + horas * vh })
            }
          } else {
            noParseados.add(en.mes_aprobacion)
          }
        }
      }
    }

    const todos = new Set([...comp.keys(), ...fact.keys()])
    const orden = Array.from(todos).sort((a, b) => a.localeCompare(b))

    return { comprometido: comp, facturado: fact, mesesUnion: orden, sinParsear: Array.from(noParseados) }
  }, [requerimientos, tarifaPorId, tarifaPorAnio])

  const filas = useMemo(() =>
    mesesUnion.map((yyyymm) => {
      const anio = parseInt(yyyymm.slice(0, 4), 10)
      const valorHora = tarifaPorAnio.get(anio) ?? null
      const c = comprometido.get(yyyymm) ?? { horas: 0, total: 0 }
      const f = facturado.get(yyyymm) ?? { horas: 0, total: 0 }
      return { yyyymm, valorHora, ...c, horasFacturadas: f.horas, totalFacturado: f.total }
    }), [mesesUnion, comprometido, facturado, tarifaPorAnio])

  const totales = useMemo(() =>
    filas.reduce((s, f) => ({
      horas: s.horas + f.horas,
      total: s.total + f.total,
      horasFacturadas: s.horasFacturadas + f.horasFacturadas,
      totalFacturado: s.totalFacturado + f.totalFacturado,
    }), { horas: 0, total: 0, horasFacturadas: 0, totalFacturado: 0 }),
    [filas])

  const estaCargando = cargando || cargandoTarifas

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-bold text-marca-osc">Facturación — General</h1>
        <p className="mt-1 text-sm text-slate-500">
          Resumen mensual de horas comprometidas y facturadas con su valor total.
        </p>
      </div>

      {error && (
        <div className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>
      )}

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-marca-osc text-white">
            <tr>
              <th className="p-3 text-left" rowSpan={2}>Mes</th>
              <th className="p-3 text-right" rowSpan={2}>Valor hora</th>
              <th className="p-2 text-center border-b border-white/30" colSpan={2}>Comprometido</th>
              <th className="p-2 text-center border-b border-white/30" colSpan={2}>Facturado</th>
              <th className="p-3 text-right" rowSpan={2}>Deuda</th>
              <th className="p-3 text-left" rowSpan={2}>Observaciones</th>
            </tr>
            <tr>
              <th className="p-3 text-right border-l border-white/20">Horas</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3 text-right border-l border-white/20">Horas</th>
              <th className="p-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {estaCargando && (
              <tr>
                <td colSpan={8} className="p-4 text-center text-slate-400">Cargando…</td>
              </tr>
            )}
            {!estaCargando && filas.length === 0 && (
              <tr>
                <td colSpan={8} className="p-4 text-center text-slate-400">Sin datos.</td>
              </tr>
            )}
            {filas.map((f) => {
              const deuda = f.total - f.totalFacturado
              const msg = obsMsg[f.yyyymm]
              return (
                <tr key={f.yyyymm} className="border-t hover:bg-slate-50 align-top">
                  <td className="p-3 font-medium text-slate-700 whitespace-nowrap">{formatearMes(f.yyyymm)}</td>
                  <td className="p-3 text-right tabular-nums text-slate-500 text-xs whitespace-nowrap">
                    {f.valorHora != null ? formatCOP(f.valorHora) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="p-3 text-right tabular-nums text-slate-800 border-l border-slate-100 whitespace-nowrap">
                    {f.horas > 0 ? f.horas.toLocaleString('es-CO') : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="p-3 text-right tabular-nums font-semibold text-slate-800 whitespace-nowrap">
                    {f.total > 0 ? formatCOP(f.total) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="p-3 text-right tabular-nums text-slate-800 border-l border-slate-100 whitespace-nowrap">
                    {f.horasFacturadas > 0 ? f.horasFacturadas.toLocaleString('es-CO') : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="p-3 text-right tabular-nums font-semibold text-emerald-700 whitespace-nowrap">
                    {f.totalFacturado > 0 ? formatCOP(f.totalFacturado) : <span className="text-slate-300">—</span>}
                  </td>
                  {/* ── DEUDA ── */}
                  <td className="p-3 text-right tabular-nums font-bold whitespace-nowrap border-l border-slate-100">
                    {deuda !== 0 ? (
                      <span className={deuda > 0 ? 'text-red-600' : 'text-emerald-600'}>
                        {formatCOP(Math.abs(deuda))}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  {/* ── OBSERVACIONES ── */}
                  <td className="p-2 border-l border-slate-100 min-w-[220px]">
                    <div className="flex flex-col gap-1">
                      <textarea
                        rows={2}
                        value={textoObs(f.yyyymm)}
                        onChange={(e) =>
                          setObsLocal((prev) => ({ ...prev, [f.yyyymm]: e.target.value }))
                        }
                        placeholder="Agregar observación…"
                        className="w-full resize-none rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:border-marca focus:outline-none"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => void guardarObs(f.yyyymm)}
                          disabled={guardando[f.yyyymm]}
                          className="rounded bg-marca px-3 py-0.5 text-xs font-medium text-white hover:bg-marca-osc disabled:opacity-50"
                        >
                          {guardando[f.yyyymm] ? 'Guardando…' : 'Guardar'}
                        </button>
                        {msg === 'ok' && <span className="text-xs text-emerald-600">✓ Guardado</span>}
                        {msg === 'error' && <span className="text-xs text-red-500">Error al guardar</span>}
                      </div>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          {!estaCargando && filas.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-marca-osc bg-slate-50 font-semibold text-slate-700">
                <td className="p-3">Total ({filas.length} meses)</td>
                <td className="p-3" />
                <td className="p-3 text-right tabular-nums border-l border-slate-200">
                  {totales.horas.toLocaleString('es-CO')}
                </td>
                <td className="p-3 text-right tabular-nums text-marca-osc">
                  {formatCOP(totales.total)}
                </td>
                <td className="p-3 text-right tabular-nums border-l border-slate-200">
                  {totales.horasFacturadas.toLocaleString('es-CO')}
                </td>
                <td className="p-3 text-right tabular-nums text-emerald-700">
                  {formatCOP(totales.totalFacturado)}
                </td>
                <td className="p-3 text-right tabular-nums font-bold border-l border-slate-200">
                  {(() => {
                    const deudaTotal = totales.total - totales.totalFacturado
                    return deudaTotal !== 0
                      ? <span className={deudaTotal > 0 ? 'text-red-600' : 'text-emerald-600'}>{formatCOP(Math.abs(deudaTotal))}</span>
                      : <span className="text-slate-300">—</span>
                  })()}
                </td>
                <td className="p-3" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Diagnóstico: valores de mes_aprobacion que no se pudieron parsear */}
      {!estaCargando && sinParsear.length > 0 && (
        <details className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <summary className="cursor-pointer font-semibold">
            ⚠ {sinParsear.length} formato(s) de "Mes de aprobación" no reconocido(s) — no aparecen en Facturado
          </summary>
          <ul className="mt-2 space-y-0.5 pl-4">
            {sinParsear.map((v) => (
              <li key={v} className="font-mono">{v}</li>
            ))}
          </ul>
          <p className="mt-2 text-amber-600">
            Formatos soportados: "Enero", "ENE-2025", "2025-01", "01/2025", "2025-01-15".
          </p>
        </details>
      )}
    </div>
  )
}
