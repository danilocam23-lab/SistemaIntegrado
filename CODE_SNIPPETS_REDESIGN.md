# 🎨 Snippets de Código - Rediseño Premium DashboardSquad

## 1️⃣ Header Premium con Gradiente

```tsx
<div className="sticky top-0 z-30 border-b border-slate-200/50 bg-white/80 backdrop-blur-xl shadow-sm">
  <div className="max-w-7xl mx-auto px-6 py-5">
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
            <span className="text-white font-bold text-lg">📊</span>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-slate-900 bg-clip-text text-transparent">
            Dashboard Squads
          </h1>
        </div>
        <p className="text-slate-600 text-sm">
          Métricas de capacidad y requerimientos en tiempo real
        </p>
      </div>
      
      {/* Filter con estilo mejorado */}
      <div className="relative group">
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
          📅 Mes de Capacidad
        </label>
        <input
          type="month"
          className="px-4 py-2.5 rounded-lg border-2 border-slate-200 bg-white font-semibold text-slate-900 focus:border-blue-500 focus:outline-none transition-colors cursor-pointer hover:border-slate-300"
        />
      </div>
    </div>
  </div>
</div>
```

**Características:**
- Sticky positioning (permanece al scroll)
- Backdrop blur (efecto vidrio)
- Título con gradiente de texto
- Badge con ícono redondeado
- Filtro con estados hover/focus

---

## 2️⃣ KPI Cards Premium

```tsx
function KpiCardPremium({
  icon,
  label,
  value,
  subtext,
  color,
  trend,
}: {
  icon: string
  label: string
  value: string | number
  subtext?: string
  color: 'blue' | 'purple' | 'amber' | 'green'
  trend?: string
}) {
  const colors = {
    blue: {
      bg: 'from-blue-600 to-blue-700',
      light: 'bg-blue-50',
      text: 'text-blue-900',
      border: 'border-blue-200',
    },
    purple: {
      bg: 'from-purple-600 to-purple-700',
      light: 'bg-purple-50',
      text: 'text-purple-900',
      border: 'border-purple-200',
    },
    amber: {
      bg: 'from-amber-500 to-amber-600',
      light: 'bg-amber-50',
      text: 'text-amber-900',
      border: 'border-amber-200',
    },
    green: {
      bg: 'from-green-600 to-green-700',
      light: 'bg-green-50',
      text: 'text-green-900',
      border: 'border-green-200',
    },
  }

  const theme = colors[color]

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-lg hover:border-slate-300 transition-all duration-300">
      <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-5 transition-opacity duration-300" />

      <div className="relative p-6">
        <div className="flex items-start justify-between mb-4">
          <div className={`text-4xl p-3 rounded-xl ${theme.light}`}>{icon}</div>
          {trend && (
            <div className="text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
              {trend}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <div className="text-sm font-medium text-slate-600 uppercase tracking-wider">{label}</div>
          <div className={`text-3xl font-bold ${theme.text}`}>{value}</div>
          {subtext && <div className="text-xs text-slate-500 mt-2">{subtext}</div>}
        </div>
      </div>
    </div>
  )
}
```

**Uso:**
```tsx
<KpiCardPremium
  icon="📊"
  label="Squads Activos"
  value={kpis.totalSquads}
  subtext="con requerimientos"
  color="blue"
  trend={kpis.totalSquads > 0 ? '+5%' : '0%'}
/>
```

**Características:**
- Colores temáticos por categoría
- Gradientes de fondo y texto
- Badges de tendencia
- Hover effects con sombra
- Iconos grandes y espaciados

---

## 3️⃣ Gráficos con Gradientes

```tsx
<ResponsiveContainer width="100%" height={400}>
  <BarChart data={filasCapacidadSquad} layout="vertical" margin={{ left: 140, right: 60, top: 20, bottom: 20 }}>
    <defs>
      <linearGradient id="gradientBar" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.8} />
        <stop offset="100%" stopColor="#2563EB" stopOpacity={1} />
      </linearGradient>
    </defs>
    <CartesianGrid strokeDasharray="3 3" stroke={PALETA.gris_borde} horizontal={false} />
    <XAxis type="number" tick={{ fontSize: 12, fill: PALETA.texto_sec }} />
    <YAxis type="category" dataKey="squad" width={130} tick={{ fontSize: 12, fill: PALETA.texto_sec }} />
    <Tooltip content={<TooltipPersonalizado />} />
    <Bar dataKey="horas" fill="url(#gradientBar)" radius={[0, 12, 12, 0]} barSize={32}>
      <LabelList
        dataKey="horas"
        position="right"
        formatter={(valor: unknown) => `${fmtNumero(Number(valor ?? 0))}h`}
        fill={PALETA.texto}
        fontSize={13}
        fontWeight={600}
      />
    </Bar>
  </BarChart>
</ResponsiveContainer>
```

**Características:**
- Gradientes lineales en barras
- Bordes redondeados (radius={[0, 12, 12, 0]})
- Labels claros al final
- Grid sutil horizontal
- Tooltip personalizado

---

## 4️⃣ Tooltip Personalizado

```tsx
function TooltipPersonalizado({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    const value = payload[0].value

    return (
      <div className="rounded-lg bg-slate-900 p-3 shadow-xl border border-slate-700">
        <p className="text-sm font-semibold text-slate-100">
          {data.squad || 'Valor'}
        </p>
        <p className="text-base font-bold text-blue-300 mt-1">
          {typeof value === 'number' ? fmtNumero(value) : value}{payload[0].dataKey === 'horas' ? 'h' : ''}
        </p>
      </div>
    )
  }
  return null
}
```

**Características:**
- Fondo oscuro profesional (slate-900)
- Texto claro y legible
- Sombra y borde suave
- Formatos dinámicos

---

## 5️⃣ Tabla Moderna con Badges

```tsx
<table className="w-full text-sm">
  <thead>
    <tr className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100/50">
      <th className="px-6 py-4 text-left font-semibold text-slate-900">Squad</th>
      <th className="px-6 py-4 text-center font-semibold text-slate-900">Reqs</th>
      <th className="px-6 py-4 text-center font-semibold text-slate-900">Horas</th>
      <th className="px-6 py-4 text-center font-semibold text-slate-900">ANS Acta</th>
    </tr>
  </thead>
  <tbody className="divide-y divide-slate-100">
    {filas.map((fila) => (
      <tr
        key={fila.squadId}
        className="hover:bg-blue-50/40 transition-colors duration-200 group"
      >
        <td className="px-6 py-4 font-semibold text-slate-900 group-hover:text-blue-700">
          {fila.squad}
        </td>
        <td className="px-6 py-4 text-center">
          <Badge variant="blue" value={fila.reqs} />
        </td>
        <td className="px-6 py-4 text-center">
          <Badge variant="amber" value={`${fmtNumero(fila.horas)}h`} />
        </td>
        <td className="px-6 py-4 text-center">
          <ProgressBadge 
            percentage={Math.round((fila.ansActaCumple / (fila.ansActaTotal || 1)) * 100)} 
          />
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

**Características:**
- Header con gradiente sutil
- Filas con hover effect azul
- Badges coloreados por tipo
- Progress badges para porcentajes
- Divisiones sutiles entre filas

---

## 6️⃣ Componentes Badge

```tsx
function Badge({ variant, value }: { variant: 'blue' | 'amber' | 'green' | 'red'; value: string | number }) {
  const variants = {
    blue: 'bg-blue-100 text-blue-700',
    amber: 'bg-amber-100 text-amber-700',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
  }

  return (
    <span className={`inline-flex items-center px-3 py-2 rounded-lg font-semibold text-sm ${variants[variant]}`}>
      {value}
    </span>
  )
}

function ProgressBadge({ percentage }: { percentage: number }) {
  let color = 'bg-red-100 text-red-700'
  if (percentage >= 75) color = 'bg-green-100 text-green-700'
  else if (percentage >= 50) color = 'bg-amber-100 text-amber-700'

  return (
    <div className="flex items-center gap-2 justify-center">
      <span className={`inline-block px-3 py-1.5 rounded-lg font-semibold text-sm ${color}`}>
        {percentage}%
      </span>
    </div>
  )
}
```

**Características:**
- Colores semánticos
- Padding consistente
- Bordes redondeados suaves
- Cambios de color por percentaje

---

## 7️⃣ ChartCardPremium

```tsx
function ChartCardPremium({
  titulo,
  descripcion,
  children,
}: {
  titulo: string
  descripcion?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-slate-900">{titulo}</h3>
        {descripcion && <p className="text-sm text-slate-500 mt-1">{descripcion}</p>}
      </div>
      <div className="relative">{children}</div>
    </div>
  )
}
```

**Uso:**
```tsx
<ChartCardPremium
  titulo="Capacidad Mensual por Squad"
  descripcion={`Distribución de horas disponibles · Festivos: ${festivosMesSeleccionado.size}`}
>
  {/* Gráfico aquí */}
</ChartCardPremium>
```

**Características:**
- Card con bordes redondeados (rounded-2xl)
- Sombra suave con hover effect
- Título y descripción integrados
- Padding equilibrado

---

## 8️⃣ Empty State Mejorado

```tsx
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="text-6xl mb-4 opacity-20">📭</div>
      <p className="text-slate-600 font-semibold">Sin datos disponibles</p>
      <p className="text-slate-400 text-sm mt-1">No hay información para mostrar en este período</p>
    </div>
  )
}
```

**Características:**
- Emoji descriptivo grande
- Mensaje claro
- Subtexto informativo
- Espaciado generoso

---

## 9️⃣ Spinner de Carga Premium

```tsx
<div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
  <div className="text-center">
    <div className="mb-6 flex justify-center">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-600 animate-spin" />
      </div>
    </div>
    <p className="text-lg font-semibold text-slate-900">Cargando dashboard</p>
    <p className="text-sm text-slate-500 mt-2">Obteniendo datos del equipo…</p>
  </div>
</div>
```

**Características:**
- Border gradient spinner
- Fondo con gradiente sutil
- Mensajes informativos
- Centrado perfecto

---

## 🎨 Paleta de Colores

```typescript
const PALETA = {
  azul_profundo: '#0F172A',      // Texto principal
  azul_primario: '#2563EB',      // Elementos clave
  azul_brillante: '#3B82F6',     // Gráficos
  morado: '#7C3AED',             // Variación
  verde: '#16A34A',              // Éxito
  naranja: '#F59E0B',            // Alerta
  rojo: '#DC2626',               // Error
  gris_fondo: '#F8FAFC',         // Fondo
  gris_borde: '#E2E8F0',         // Bordes
  texto: '#0F172A',              // Texto
  texto_sec: '#64748B',          // Texto secundario
}
```

---

## 📊 Grid Responsive

```tsx
{/* KPI Cards - 4 columnas en desktop, 2 en tablet, 1 en mobile */}
<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
  {/* Cards aquí */}
</div>

{/* Gráficos - 2 columnas en desktop, 1 en tablet/mobile */}
<div className="grid gap-6 lg:grid-cols-2">
  {/* Charts aquí */}
</div>
```

---

## 🎯 Clases Tailwind Clave

```
rounded-2xl         → Bordes extra redondeados
border-slate-200    → Border suave
bg-gradient-to-*    → Gradientes
shadow-sm/md        → Sombras sutiles
hover:shadow-lg     → Sombra en hover
transition-all      → Animación suave
duration-300        → Velocidad de transición
backdrop-blur-xl    → Efecto vidrio
bg-clip-text        → Gradiente en texto
text-slate-900      → Texto principal
text-slate-600      → Texto secundario
```

---

**Fecha:** 17 de Junio de 2026
**Versión:** 2.0 Premium Redesign
