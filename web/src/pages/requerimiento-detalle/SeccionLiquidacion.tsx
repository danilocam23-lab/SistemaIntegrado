import type { Liquidacion } from '../../types'

interface Props {
  liquidacion: Liquidacion | null
}

export default function SeccionLiquidacion({ liquidacion }: Props) {
  return (
    <div className="tarjeta tarjeta-pad">
      <h2 className="etiqueta-sup mb-3">
        Liquidación
      </h2>
      {liquidacion ? (
        <>
          <p className="mb-2 text-sm">
            Total: <b className="text-marca-osc">{liquidacion.total.toLocaleString()}</b>
          </p>
          <ul className="text-sm text-slate-600">
            {liquidacion.entregas.map((le) => (
              <li key={le.numero}>
                Entrega {le.numero}:{' '}
                {le.error ? <span className="text-amber-600">{le.error}</span> : le.valor?.toLocaleString()}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-slate-400">Sin datos de liquidación.</p>
      )}
    </div>
  )
}
