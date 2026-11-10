// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Aviso, Boton } from '../../components/ui'
import { fmtNumero } from './utilidades'

interface Props {
  woSinSquad: { cantidad: number; horas: number }
  onCerrar: () => void
}

const REGLAS = [
  'Fuente: registros de soporte (solicitudes de fábrica) de la aplicación activa. Requiere el permiso de ver solicitudes de fábrica; el servidor no aplica otros filtros (estado, líder, etc.).',
  'El registro debe tener un Work Order ID no vacío.',
  'Debe tener una Fecha Fin Real válida y su mes (AAAA-MM) debe estar entre los periodos seleccionados en el filtro.',
  'Una WO cuenta una sola vez por mes y WO: sus horas son el máximo de (horas aprobadas + minutos aprobados / 60) entre sus registros; los duplicados no se suman.',
  'Se asigna al squad según el campo squad del registro. Las WO sin squad resoluble no aparecen en las filas de squad, pero sí cuentan en el KPI global «Horas aprobadas WO».',
]

/** Explica qué condiciones cumple un registro para sumar como WO en el detalle por squad. */
export default function ModalReglasWo({ woSinSquad, onCerrar }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Cómo se suman las WO"
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="titulo-seccion">Cómo se suman las WO</h2>
            <p className="mt-1 text-sm text-slate-500">Condiciones que cumple un registro para sumar en las horas WO.</p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar cómo se suman las WO"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[62vh] space-y-4 overflow-auto p-6">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
            {REGLAS.map((regla) => (
              <li key={regla}>{regla}</li>
            ))}
          </ol>
          <Aviso tono={woSinSquad.cantidad > 0 ? 'alerta' : 'info'}>
            {woSinSquad.cantidad > 0
              ? `${fmtNumero(woSinSquad.cantidad)} WO (${fmtNumero(woSinSquad.horas)}h) del periodo no tienen squad resoluble y quedaron fuera de las filas; sí cuentan en el KPI global.`
              : 'Todas las WO del periodo tienen squad resoluble: las filas cuadran con el KPI global.'}
          </Aviso>
        </div>
        <div className="flex justify-end border-t border-slate-200 px-6 py-3">
          <Boton variante="secundario" onClick={onCerrar}>Cerrar</Boton>
        </div>
      </div>
    </div>
  )
}
