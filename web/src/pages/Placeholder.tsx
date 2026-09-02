export default function Placeholder({ titulo }: { titulo: string }) {
  return (
    <div>
      <h1 className="titulo-pagina mb-2">{titulo}</h1>
      <div className="tarjeta p-6 text-slate-500">
        Módulo pendiente de implementación. Se construye al portar el dominio del Liquidador y
        del Workload Manager (fases 3–5 del documento de arquitectura).
      </div>
    </div>
  )
}
