// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useEffect, useMemo, useState } from 'react'
import client from '../api/client'
import { mensajeError, useLista } from '../api/hooks'
import type { Requerimiento, Tarifa } from '../types'
import { Aviso, EncabezadoPagina, Icono, Kpi, TablaScroll } from '../components/ui'
import {
  agruparPorMesAprobacion,
  horasSeguras,
  mapaTarifasPorRamificacion,
  tarifasDuplicadasConflicto,
  type FilaMesAprobacion,
} from './facturacion-valores/agruparPorMesAprobacion'
import ModalEntregasMes from './facturacion-valores/ModalEntregasMes'

interface RegistroSoporte {
  Work_Order_ID: string
  Fecha_Fin_Real: string
  Horas_Estimadas: string
}

interface ListadoResponse {
  registros: RegistroSoporte[]
}

function numero(valor: string | undefined): number {
  const texto = (valor ?? '').trim().replace(/\s/g, '')
  if (!texto) return 0
  const normalizado = texto.includes(',')
    ? texto.replace(/\./g, '').replace(',', '.')
    : texto
  const resultado = Number(normalizado)
  return Number.isFinite(resultado) ? resultado : 0
}

export default function FacturacionValoresProyecto() {
  const [registros, setRegistros] = useState<RegistroSoporte[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const { datos: tarifas, error: errorTarifas, cargando: cargandoTarifas } = useLista<Tarifa>('/tarifas')
  const { datos: requerimientos, error: errorRequerimientos, cargando: cargandoRequerimientos } = useLista<Requerimiento>('/requerimientos')

  useEffect(() => {
    client
      .get<ListadoResponse>('/soporte/solicitudes-fabrica/resumen')
      .then((respuesta) => setRegistros(respuesta.data.registros ?? []))
      .catch((err) => setError(mensajeError(err)))
      .finally(() => setCargando(false))
  }, [])

  const filasPorAno = useMemo(() => {
    const anoActual = String(new Date().getFullYear())
    const tarifasSoporte = mapaTarifasPorRamificacion(tarifas, 'soporte')
    const agrupadas = new Map<string, { wo: Set<string>; horas: number; valorHora: number | null }>()
    registros.forEach((registro) => {
      const workOrder = registro.Work_Order_ID?.trim()
      if (!workOrder) return

      const fecha = registro.Fecha_Fin_Real?.trim() ?? ''
      const tieneAno = /^\d{4}/.test(fecha)
      const ano = tieneAno ? fecha.slice(0, 4) : 'Sin fecha'
      const fila = agrupadas.get(ano) ?? {
        wo: new Set<string>(),
        horas: 0,
        valorHora: tarifasSoporte.get(tieneAno ? ano : anoActual) ?? null,
      }
      fila.wo.add(workOrder)
      fila.horas += numero(registro.Horas_Estimadas)
      agrupadas.set(ano, fila)
    })
    return Array.from(agrupadas.entries()).sort(([a], [b]) => {
      if (a === 'Sin fecha') return 1
      if (b === 'Sin fecha') return -1
      return b.localeCompare(a)
    })
  }, [registros, tarifas])

  const filasEntregasPorAno = useMemo(() => {
    const anoActual = String(new Date().getFullYear())
    const tarifasFabrica = mapaTarifasPorRamificacion(tarifas, 'fábrica')
    const agrupadas = new Map<string, { entregas: number; horas: number; valorHora: number | null }>()
    requerimientos.forEach((requerimiento) => {
      requerimiento.entregas?.forEach((entrega) => {
        const fecha = entrega.fecha_comprometida?.trim() ?? ''
        const tieneAno = /^\d{4}/.test(fecha)
        const ano = tieneAno ? fecha.slice(0, 4) : 'Sin fecha'
        const fila = agrupadas.get(ano) ?? {
          entregas: 0,
          horas: 0,
          valorHora: tarifasFabrica.get(tieneAno ? ano : anoActual) ?? null,
        }
        fila.entregas += 1
        fila.horas += horasSeguras(entrega.horas)
        agrupadas.set(ano, fila)
      })
    })
    return Array.from(agrupadas.entries()).sort(([a], [b]) => {
      if (a === 'Sin fecha') return 1
      if (b === 'Sin fecha') return -1
      return b.localeCompare(a)
    })
  }, [requerimientos, tarifas])

  const filasEntregasPorEstado = useMemo(() => {
    const anoActual = String(new Date().getFullYear())
    const tarifasFabrica = mapaTarifasPorRamificacion(tarifas, 'fábrica')
    const agrupadas = new Map<string, {
      division: string
      ano: string
      entregas: number
      horas: number
      valorHora: number | null
    }>()
    requerimientos.forEach((requerimiento) => {
      requerimiento.entregas?.forEach((entrega) => {
        const fecha = entrega.fecha_comprometida?.trim() ?? ''
        const tieneAno = /^\d{4}/.test(fecha)
        const ano = tieneAno ? fecha.slice(0, 4) : 'Sin fecha'
        const estado = (entrega.estado ?? '').trim().toUpperCase()
        const division = estado === 'APROBADA' ? 'APROBADA' : 'Resto de estados'
        const clave = `${division}|${ano}`
        const fila = agrupadas.get(clave) ?? {
          division,
          ano,
          entregas: 0,
          horas: 0,
          valorHora: tarifasFabrica.get(tieneAno ? ano : anoActual) ?? null,
        }
        fila.entregas += 1
        fila.horas += horasSeguras(entrega.horas)
        agrupadas.set(clave, fila)
      })
    })
    return Array.from(agrupadas.values()).sort((a, b) => {
      if (a.division !== b.division) return a.division === 'APROBADA' ? -1 : 1
      if (a.ano === 'Sin fecha') return 1
      if (b.ano === 'Sin fecha') return -1
      return b.ano.localeCompare(a.ano)
    })
  }, [requerimientos, tarifas])

  const [filaDetalle, setFilaDetalle] = useState<FilaMesAprobacion | null>(null)
  const filasPorMesAprobacion = useMemo(
    () => agruparPorMesAprobacion(requerimientos, tarifas),
    [requerimientos, tarifas],
  )
  const totalesMesAprobacion = useMemo(() => ({
    entregas: filasPorMesAprobacion.reduce((total, f) => total + f.entregas.length, 0),
    horas: filasPorMesAprobacion.reduce((total, f) => total + f.horas, 0),
    valorTotal: filasPorMesAprobacion.reduce(
      (total, f) => total + (f.valorHora === null ? 0 : f.horas * f.valorHora),
      0,
    ),
  }), [filasPorMesAprobacion])

  const duplicadosTarifas = useMemo(
    () => tarifasDuplicadasConflicto(tarifas, ['soporte', 'fábrica']),
    [tarifas],
  )

  const errorVisible = error || errorTarifas || errorRequerimientos
  const cargandoVisible = cargando || cargandoTarifas || cargandoRequerimientos
  const totales = useMemo(() => ({
    wo: filasPorAno.reduce((total, [, valores]) => total + valores.wo.size, 0),
    horas: filasPorAno.reduce((total, [, valores]) => total + valores.horas, 0),
    valorTotal: filasPorAno.reduce(
      (total, [, valores]) => total + (valores.valorHora === null ? 0 : valores.horas * valores.valorHora),
      0,
    ),
  }), [filasPorAno])
  const totalesEntregas = useMemo(() => ({
    entregas: filasEntregasPorAno.reduce((total, [, valores]) => total + valores.entregas, 0),
    horas: filasEntregasPorAno.reduce((total, [, valores]) => total + valores.horas, 0),
    valorTotal: filasEntregasPorAno.reduce(
      (total, [, valores]) => total + (valores.valorHora === null ? 0 : valores.horas * valores.valorHora),
      0,
    ),
  }), [filasEntregasPorAno])
  const totalesEntregasEstado = useMemo(() => ({
    entregas: filasEntregasPorEstado.reduce((total, valores) => total + valores.entregas, 0),
    horas: filasEntregasPorEstado.reduce((total, valores) => total + valores.horas, 0),
    valorTotal: filasEntregasPorEstado.reduce(
      (total, valores) => total + (valores.valorHora === null ? 0 : valores.horas * valores.valorHora),
      0,
    ),
  }), [filasEntregasPorEstado])
  const totalAprobadas = useMemo(
    () => filasEntregasPorEstado
      .filter((valores) => valores.division === 'APROBADA')
      .reduce((total, valores) => total + (valores.valorHora === null ? 0 : valores.horas * valores.valorHora), 0),
    [filasEntregasPorEstado],
  )
  const totalDinero = totales.valorTotal + totalesEntregasEstado.valorTotal
  const totalDineroIngresado = totales.valorTotal + totalAprobadas

  const formatoMoneda = (valor: number) => valor.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  })

  return (
    <div className="space-y-4">
      <EncabezadoPagina
        icono={<Icono nombre="facturacion" />}
        titulo="Facturación — Valores de proyecto"
        descripcion="Valores de proyecto."
      />
      {errorVisible && <Aviso tono="error">{errorVisible}</Aviso>}
      {duplicadosTarifas.length > 0 && (
        <Aviso tono="alerta">
          Hay tarifas duplicadas con valores distintos (se usa la última registrada):{' '}
          {duplicadosTarifas
            .map((d) => `${d.ramificacion === 'soporte' ? 'Soporte' : 'Fábrica'} ${d.anio} (${d.valores.join(' / ')})`)
            .join('; ')}.
        </Aviso>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        <Kpi rotulo="Dinero de soporte" valor={formatoMoneda(totales.valorTotal)} acento="#059669" />
        <Kpi
          rotulo="Dinero de entregas por estado"
          valor={formatoMoneda(totalesEntregasEstado.valorTotal)}
          acento="#2563eb"
        />
        <Kpi rotulo="Dinero entregas aprobadas" valor={formatoMoneda(totalAprobadas)} acento="#7c3aed" />
        <Kpi rotulo="Total dinero" valor={formatoMoneda(totalDinero)} acento="#d97706" />
        <Kpi
          rotulo="Total dinero ingresado"
          valor={formatoMoneda(totalDineroIngresado)}
          nota="Nota: falta validar horas de soporte."
          acento="#4f46e5"
        />
      </div>
      <div className="tarjeta overflow-hidden">
        <TablaScroll plano>
        <table className="tabla">
          <thead>
            <tr>
              <th className="text-center">Año</th>
              <th className="text-center">Cantidad de WO</th>
              <th className="text-center">Cantidad de horas</th>
              <th className="text-center">Valor hora</th>
              <th className="text-center">Valor total</th>
            </tr>
          </thead>
          <tbody>
            {cargandoVisible ? (
              <tr>
                <td colSpan={5} className="p-3 text-center text-slate-400">Cargando…</td>
              </tr>
            ) : filasPorAno.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-3 text-center text-slate-400">Sin registros</td>
              </tr>
            ) : (
              filasPorAno.map(([ano, valores]) => (
                <tr key={ano} className="text-center">
                  <td className="font-semibold">{ano}</td>
                  <td>{valores.wo.size}</td>
                  <td>{valores.horas.toLocaleString('es-CO', { maximumFractionDigits: 1 })}</td>
                  <td>
                    {valores.valorHora === null
                      ? '—'
                      : formatoMoneda(valores.valorHora)}
                  </td>
                  <td>
                    {valores.valorHora === null
                      ? '—'
                      : formatoMoneda(valores.horas * valores.valorHora)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {!cargandoVisible && filasPorAno.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-marca-osc bg-slate-100 text-center font-bold">
               <td>Totales</td>
               <td>{totales.wo}</td>
               <td>{totales.horas.toLocaleString('es-CO', { maximumFractionDigits: 1 })}</td>
               <td>—</td>
               <td>{formatoMoneda(totales.valorTotal)}</td>
              </tr>
            </tfoot>
          )}
        </table>
        </TablaScroll>
      </div>
      <p className="text-xs text-slate-500">
        Nota: los registros sin año se conservan en la fila <strong>Sin fecha</strong> y usan la tarifa del año actual.
      </p>
      <div>
        <h2 className="titulo-seccion mb-2">Valores de entregas</h2>
        <div className="tarjeta overflow-hidden">
          <TablaScroll plano>
          <table className="tabla">
            <thead>
              <tr>
                <th className="text-center">Año</th>
                <th className="text-center">Cantidad de entregas</th>
                <th className="text-center">Cantidad de horas</th>
                <th className="text-center">Valor hora</th>
                <th className="text-center">Valor total</th>
              </tr>
            </thead>
            <tbody>
              {cargandoVisible ? (
                <tr>
                  <td colSpan={5} className="p-3 text-center text-slate-400">Cargando…</td>
                </tr>
              ) : filasEntregasPorAno.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-3 text-center text-slate-400">Sin registros</td>
                </tr>
              ) : (
                filasEntregasPorAno.map(([ano, valores]) => (
                  <tr key={ano} className="text-center">
                    <td className="font-semibold">{ano}</td>
                    <td>{valores.entregas}</td>
                    <td>{valores.horas.toLocaleString('es-CO', { maximumFractionDigits: 1 })}</td>
                    <td>
                      {valores.valorHora === null ? '—' : formatoMoneda(valores.valorHora)}
                    </td>
                    <td>
                      {valores.valorHora === null ? '—' : formatoMoneda(valores.horas * valores.valorHora)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {!cargandoVisible && filasEntregasPorAno.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-marca-osc bg-slate-100 text-center font-bold">
                  <td>Totales</td>
                  <td>{totalesEntregas.entregas}</td>
                  <td>{totalesEntregas.horas.toLocaleString('es-CO', { maximumFractionDigits: 1 })}</td>
                  <td>—</td>
                  <td>{formatoMoneda(totalesEntregas.valorTotal)}</td>
                </tr>
              </tfoot>
            )}
          </table>
          </TablaScroll>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Nota: el año de las entregas se toma de <strong>F. Comprometida</strong>; las entregas sin fecha se conservan en <strong>Sin fecha</strong>.
        </p>
      </div>
      <div>
        <h2 className="titulo-seccion mb-2">Entregas por estado</h2>
        <div className="tarjeta overflow-hidden">
          <TablaScroll plano>
          <table className="tabla">
            <thead>
              <tr>
                <th className="text-center">División</th>
                <th className="text-center">Año</th>
                <th className="text-center">Cantidad de entregas</th>
                <th className="text-center">Cantidad de horas</th>
                <th className="text-center">Valor hora</th>
                <th className="text-center">Valor total</th>
              </tr>
            </thead>
            <tbody>
              {cargandoVisible ? (
                <tr>
                  <td colSpan={6} className="p-3 text-center text-slate-400">Cargando…</td>
                </tr>
              ) : filasEntregasPorEstado.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-3 text-center text-slate-400">Sin registros</td>
                </tr>
              ) : (
                filasEntregasPorEstado.map((valores) => (
                  <tr key={`${valores.division}-${valores.ano}`} className="text-center">
                    <td className="font-semibold">{valores.division}</td>
                    <td>{valores.ano}</td>
                    <td>{valores.entregas}</td>
                    <td>{valores.horas.toLocaleString('es-CO', { maximumFractionDigits: 1 })}</td>
                    <td>
                      {valores.valorHora === null ? '—' : formatoMoneda(valores.valorHora)}
                    </td>
                    <td>
                      {valores.valorHora === null ? '—' : formatoMoneda(valores.horas * valores.valorHora)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {!cargandoVisible && filasEntregasPorEstado.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-marca-osc bg-slate-100 text-center font-bold">
                  <td colSpan={2}>Totales</td>
                  <td>{totalesEntregasEstado.entregas}</td>
                  <td>{totalesEntregasEstado.horas.toLocaleString('es-CO', { maximumFractionDigits: 1 })}</td>
                  <td>—</td>
                  <td>{formatoMoneda(totalesEntregasEstado.valorTotal)}</td>
                </tr>
              </tfoot>
            )}
          </table>
          </TablaScroll>
        </div>
      </div>
      <div>
        <h2 className="titulo-seccion mb-2">Entregas por mes de aprobación</h2>
        <div className="tarjeta overflow-hidden">
          <TablaScroll plano>
          <table className="tabla">
            <thead>
              <tr>
                <th className="text-center">Año</th>
                <th className="text-center">Mes de aprobación</th>
                <th className="text-center">Cantidad de entregas</th>
                <th className="text-center">Cantidad de horas</th>
                <th className="text-center">Valor hora</th>
                <th className="text-center">Valor total</th>
              </tr>
            </thead>
            <tbody>
              {cargandoVisible ? (
                <tr>
                  <td colSpan={6} className="p-3 text-center text-slate-400">Cargando…</td>
                </tr>
              ) : filasPorMesAprobacion.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-3 text-center text-slate-400">Sin registros</td>
                </tr>
              ) : (
                filasPorMesAprobacion.map((fila) => (
                  <tr key={fila.clave} className="text-center tabular-nums">
                    <td className="font-semibold">{fila.ano}</td>
                    <td>{fila.mes}</td>
                    <td>
                      {fila.entregas.length > 0 ? (
                        <button
                          type="button"
                          className="enlace-accion"
                          aria-label={`Ver detalle de ${fila.entregas.length} entregas de ${fila.mes} ${fila.ano}`}
                          onClick={() => setFilaDetalle(fila)}
                        >
                          {fila.entregas.length}
                        </button>
                      ) : 0}
                    </td>
                    <td>{fila.horas.toLocaleString('es-CO', { maximumFractionDigits: 1 })}</td>
                    <td>{fila.valorHora === null ? '—' : formatoMoneda(fila.valorHora)}</td>
                    <td>{fila.valorHora === null ? '—' : formatoMoneda(fila.horas * fila.valorHora)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {!cargandoVisible && filasPorMesAprobacion.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-marca-osc bg-slate-100 text-center font-bold tabular-nums">
                  <td colSpan={2}>Totales</td>
                  <td>{totalesMesAprobacion.entregas}</td>
                  <td>{totalesMesAprobacion.horas.toLocaleString('es-CO', { maximumFractionDigits: 1 })}</td>
                  <td>—</td>
                  <td>{formatoMoneda(totalesMesAprobacion.valorTotal)}</td>
                </tr>
              </tfoot>
            )}
          </table>
          </TablaScroll>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Nota: el año se toma de <strong>F. aprobación</strong> (si falta, de F. comprometida). La fila <strong>Sin mes</strong> agrupa entregas APROBADA sin mes de aprobación.
        </p>
      </div>
      <ModalEntregasMes fila={filaDetalle} onCerrar={() => setFilaDetalle(null)} formatoMoneda={formatoMoneda} />
    </div>
  )
}
