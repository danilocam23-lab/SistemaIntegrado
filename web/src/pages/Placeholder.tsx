export default function Placeholder({ titulo }: { titulo: string }) {
  return (
    <div>
      <h1 className="mb-2 text-xl font-bold text-marca-osc">{titulo}</h1>
      <div className="rounded-xl border bg-white p-6 text-slate-500">
        Módulo pendiente de implementación. Se construye al portar el dominio del Liquidador y
        del Workload Manager (fases 3–5 del documento de arquitectura).
      </div>
    </div>
  )
}
