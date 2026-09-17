import { useMemo } from 'react'
import { Boton, Chip, cx, Tarjeta } from '../../components/ui'
import type { BacklogFuturo, Requerimiento } from '../../types'
import { ESTADOS, ESTADO_BORDE, ESTADO_LABEL, ESTADO_TONO } from './constantes'

interface Props {
  datos: BacklogFuturo[]
  puedeEditar: boolean
  squadPorCodigo: Map<string, string>
  personaPorId: Map<string, string>
  actaPorId: Map<string, Requerimiento>
  onEditar: (item: BacklogFuturo) => void
  onEliminar: (item: BacklogFuturo) => void
  onAgregarEnEstado: (estado: string) => void
}

export default function TableroKanban({
  datos,
  puedeEditar,
  squadPorCodigo,
  personaPorId,
  actaPorId,
  onEditar,
  onEliminar,
  onAgregarEnEstado,
}: Props) {
  const columnas = useMemo(() => {
    const porEstado = new Map<string, BacklogFuturo[]>()
    ESTADOS.forEach((estado) => porEstado.set(estado, []))
    datos.forEach((item) => {
      const lista = porEstado.get(item.estado)
      if (lista) lista.push(item)
      else porEstado.set(item.estado, [item])
    })
    return ESTADOS.map((estado) => ({ estado, items: porEstado.get(estado) ?? [] }))
  }, [datos])

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {columnas.map(({ estado, items }) => (
        <Tarjeta
          key={estado}
          padding={false}
          className={cx('flex min-w-0 flex-col border-t-4', ESTADO_BORDE[estado] ?? 'border-t-slate-300')}
        >
          <div className="tarjeta-encabezado">
            <div className="flex items-center gap-2">
              <h3 className="tarjeta-titulo">{ESTADO_LABEL[estado] ?? estado}</h3>
              <Chip tono={ESTADO_TONO[estado] ?? 'neutro'}>{items.length}</Chip>
            </div>
            {puedeEditar && (
              <Boton
                variante="fantasma"
                tamano="sm"
                onClick={() => onAgregarEnEstado(estado)}
                title={`Agregar en ${ESTADO_LABEL[estado] ?? estado}`}
              >
                +
              </Boton>
            )}
          </div>

          <div className="flex flex-col gap-3 p-3">
            {items.length === 0 && (
              <p className="p-2 text-center text-sm text-slate-400">Sin iniciativas.</p>
            )}
            {items.map((item) => {
              const acta = item.volvio_acta && item.acta_id ? actaPorId.get(item.acta_id) : undefined
              const metadatos = [
                item.tipo_demanda || null,
                squadPorCodigo.get(item.squad_id) ?? item.squad_id,
                personaPorId.get(item.responsable_id ?? '') ?? null,
                `${item.horas_aproximadas ?? 0} h`,
                item.fecha_tentativa_inicio || null,
              ].filter(Boolean)

              return (
                <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="font-semibold text-slate-900">{item.nombre_iniciativa}</p>
                  <p className="mt-1 text-xs text-slate-500">{metadatos.join(' · ')}</p>
                  {item.volvio_acta && (
                    <p className="mt-1">
                      <Chip tono="exito" title="Acta en la que se creó">
                        Acta {acta?.codigo_req ?? item.acta_id}
                      </Chip>
                    </p>
                  )}
                  {puedeEditar && (
                    <div className="mt-2 flex gap-3">
                      <button onClick={() => onEditar(item)} className="enlace-accion text-xs">
                        Editar
                      </button>
                      <button onClick={() => onEliminar(item)} className="enlace-accion enlace-accion-peligro text-xs">
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Tarjeta>
      ))}
    </div>
  )
}
