import { useEffect, useMemo, useState } from 'react'
import client from '../api/client'
import { mensajeError, useLista } from '../api/hooks'
import type { Requerimiento, Tarifa } from '../types'
import { TablaScroll } from '../components/ui/primitivos'

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
    const tarifasSoporte = new Map(
      tarifas
        .filter((tarifa) => tarifa.ramificacion?.trim().toLowerCase() === 'soporte')
        .map((tarifa) => [String(tarifa.anio), tarifa.valor_hora]),
    )
    const agrupadas = new Map<string, { wo: Set<string>; horas: number; valorHora: number | null }>()
    registros.forEach((registro, indice) => {
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
      fila.wo.add(workOrder || `registro-${indice}`)
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
    const tarifasFabrica = new Map(
      tarifas
        .filter((tarifa) => tarifa.ramificacion?.trim().toLowerCase() === 'fábrica')
        .map((tarifa) => [String(tarifa.anio), tarifa.valor_hora]),
    )
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
        fila.horas += Number(entrega.horas ?? 0)
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
    const tarifasFabrica = new Map(
      tarifas
        .filter((tarifa) => tarifa.ramificacion?.trim().toLowerCase() === 'fábrica')
        .map((tarifa) => [String(tarifa.anio), tarifa.valor_hora]),
    )
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
        fila.horas += Number(entrega.horas ?? 0)
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
      <div>
        <h1 className="titulo-pagina">Facturación — Valores de proyecto</h1>
        <p className="mt-1 text-sm text-slate-500">Valores de proyecto.</p>
      </div>
      {errorVisible && <div className="aviso aviso-error">{errorVisible}</div>}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="aviso aviso-exito">
          <p className="text-sm font-medium text-emerald-800">Dinero de soporte</p>
          <p className="mt-1 text-2xl font-bold text-emerald-900">{formatoMoneda(totales.valorTotal)}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-medium text-blue-800">Dinero de entregas por estado</p>
          <p className="mt-1 text-2xl font-bold text-blue-900">{formatoMoneda(totalesEntregasEstado.valorTotal)}</p>
        </div>
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
          <p className="text-sm font-medium text-violet-800">Dinero entregas aprobadas</p>
          <p className="mt-1 text-2xl font-bold text-violet-900">{formatoMoneda(totalAprobadas)}</p>
        </div>
        <div className="aviso aviso-alerta">
          <p className="text-sm font-medium text-amber-800">Total dinero</p>
          <p className="mt-1 text-2xl font-bold text-amber-900">{formatoMoneda(totalDinero)}</p>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <p className="text-sm font-medium text-indigo-800">Total dinero ingresado</p>
          <p className="mt-1 text-2xl font-bold text-indigo-900">{formatoMoneda(totalDineroIngresado)}</p>
          <p className="mt-2 text-xs text-indigo-700">Nota: falta validar horas de soporte.</p>
        </div>
      </div>
      <div className="tarjeta overflow-hidden">
        <TablaScroll plano>
        <table className="w-full text-sm">
          <thead className="bg-marca-osc text-left text-white">
            <tr>
              <th className="p-3 text-center">Año</th>
              <th className="p-3 text-center">Cantidad de WO</th>
              <th className="p-3 text-center">Cantidad de horas</th>
              <th className="p-3 text-center">Valor hora</th>
              <th className="p-3 text-center">Valor total</th>
            </tr>
          </thead>
          <tbody>
            {cargandoVisible ? (
              <tr className="border-t">
                <td colSpan={5} className="p-3 text-center text-slate-400">Cargando…</td>
              </tr>
            ) : filasPorAno.length === 0 ? (
              <tr className="border-t">
                <td colSpan={5} className="p-3 text-center text-slate-400">Sin registros</td>
              </tr>
            ) : (
              filasPorAno.map(([ano, valores]) => (
                <tr key={ano} className="border-t text-center">
                  <td className="p-3 font-semibold">{ano}</td>
                  <td className="p-3">{valores.wo.size}</td>
                  <td className="p-3">{valores.horas.toLocaleString('es-CO', { maximumFractionDigits: 1 })}</td>
                  <td className="p-3">
                    {valores.valorHora === null
                      ? '—'
                      : formatoMoneda(valores.valorHora)}
                  </td>
                  <td className="p-3">
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
               <td className="p-3">Totales</td>
               <td className="p-3">{totales.wo}</td>
               <td className="p-3">{totales.horas.toLocaleString('es-CO', { maximumFractionDigits: 1 })}</td>
               <td className="p-3">—</td>
               <td className="p-3">{formatoMoneda(totales.valorTotal)}</td>
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
          <table className="w-full text-sm">
            <thead className="bg-marca-osc text-left text-white">
              <tr>
                <th className="p-3 text-center">Año</th>
                <th className="p-3 text-center">Cantidad de entregas</th>
                <th className="p-3 text-center">Cantidad de horas</th>
                <th className="p-3 text-center">Valor hora</th>
                <th className="p-3 text-center">Valor total</th>
              </tr>
            </thead>
            <tbody>
              {cargandoVisible ? (
                <tr className="border-t">
                  <td colSpan={5} className="p-3 text-center text-slate-400">Cargando…</td>
                </tr>
              ) : filasEntregasPorAno.length === 0 ? (
                <tr className="border-t">
                  <td colSpan={5} className="p-3 text-center text-slate-400">Sin registros</td>
                </tr>
              ) : (
                filasEntregasPorAno.map(([ano, valores]) => (
                  <tr key={ano} className="border-t text-center">
                    <td className="p-3 font-semibold">{ano}</td>
                    <td className="p-3">{valores.entregas}</td>
                    <td className="p-3">{valores.horas.toLocaleString('es-CO', { maximumFractionDigits: 1 })}</td>
                    <td className="p-3">
                      {valores.valorHora === null ? '—' : formatoMoneda(valores.valorHora)}
                    </td>
                    <td className="p-3">
                      {valores.valorHora === null ? '—' : formatoMoneda(valores.horas * valores.valorHora)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {!cargandoVisible && filasEntregasPorAno.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-marca-osc bg-slate-100 text-center font-bold">
                  <td className="p-3">Totales</td>
                  <td className="p-3">{totalesEntregas.entregas}</td>
                  <td className="p-3">{totalesEntregas.horas.toLocaleString('es-CO', { maximumFractionDigits: 1 })}</td>
                  <td className="p-3">—</td>
                  <td className="p-3">{formatoMoneda(totalesEntregas.valorTotal)}</td>
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
          <table className="w-full text-sm">
            <thead className="bg-marca-osc text-left text-white">
              <tr>
                <th className="p-3 text-center">División</th>
                <th className="p-3 text-center">Año</th>
                <th className="p-3 text-center">Cantidad de entregas</th>
                <th className="p-3 text-center">Cantidad de horas</th>
                <th className="p-3 text-center">Valor hora</th>
                <th className="p-3 text-center">Valor total</th>
              </tr>
            </thead>
            <tbody>
              {cargandoVisible ? (
                <tr className="border-t">
                  <td colSpan={6} className="p-3 text-center text-slate-400">Cargando…</td>
                </tr>
              ) : filasEntregasPorEstado.length === 0 ? (
                <tr className="border-t">
                  <td colSpan={6} className="p-3 text-center text-slate-400">Sin registros</td>
                </tr>
              ) : (
                filasEntregasPorEstado.map((valores) => (
                  <tr key={`${valores.division}-${valores.ano}`} className="border-t text-center">
                    <td className="p-3 font-semibold">{valores.division}</td>
                    <td className="p-3">{valores.ano}</td>
                    <td className="p-3">{valores.entregas}</td>
                    <td className="p-3">{valores.horas.toLocaleString('es-CO', { maximumFractionDigits: 1 })}</td>
                    <td className="p-3">
                      {valores.valorHora === null ? '—' : formatoMoneda(valores.valorHora)}
                    </td>
                    <td className="p-3">
                      {valores.valorHora === null ? '—' : formatoMoneda(valores.horas * valores.valorHora)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {!cargandoVisible && filasEntregasPorEstado.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-marca-osc bg-slate-100 text-center font-bold">
                  <td className="p-3" colSpan={2}>Totales</td>
                  <td className="p-3">{totalesEntregasEstado.entregas}</td>
                  <td className="p-3">{totalesEntregasEstado.horas.toLocaleString('es-CO', { maximumFractionDigits: 1 })}</td>
                  <td className="p-3">—</td>
                  <td className="p-3">{formatoMoneda(totalesEntregasEstado.valorTotal)}</td>
                </tr>
              </tfoot>
            )}
          </table>
          </TablaScroll>
        </div>
      </div>
    </div>
  )
}
