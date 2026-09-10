---
name: motion-react
description: >-
  Cómo usar Motion (la librería antes llamada Framer Motion) en el frontend del Sistema
  Integrado HITSS: React 18 + TypeScript strict + Vite 6 + Tailwind 3 + Recharts 3, con un
  sistema de diseño propio en español. Úsala cuando una tarea de web/ pida animación no
  trivial con Motion / framer-motion: transiciones de entrada/salida, AnimatePresence,
  variants, animaciones de layout, reveal de secciones o de tarjetas. NO la uses para
  hover/focus/estados simples que Tailwind (`transition`, `animate-*`) ya resuelve.
---

# Motion en el Sistema Integrado HITSS

## 0. Antes de nada: la dependencia es decisión de arquitectura

Motion **no** está en `web/package.json`. Añadirlo es una decisión de `arquitectura`, no del
agente `frontend`. Si la tarea implica instalar la librería y aún no está aprobada: dilo en una
línea y deriva esa parte. Esta skill asume que ya está aprobada e instalada.

- Paquete correcto: **`motion`** (Motion 11+). Se importa de **`motion/react`**.
  `npm i motion`. **No** uses el paquete legacy `framer-motion` en proyecto nuevo.
- Import de tipos también desde `motion/react` (`Variants`, `Transition`, `MotionProps`).

## 1. El sistema de diseño sigue mandando

Motion **envuelve y anima**, no sustituye a `src/components/ui`. Reglas:

- Los estilos estáticos siguen en Tailwind / clases del sistema (`btn`, `tarjeta`, `kpi`…).
  Motion solo toca las props que se animan (normalmente `opacity` y `transform`).
- Para animar un primitivo existente: envuélvelo en un `motion.div` contenedor, **no**
  reescribas el primitivo. Si necesitas que el propio componente reciba props de motion, usa
  `motion.create(MiComponente)` (antes `motion(MiComponente)`), no lo dupliques.
- Nombres en español como en todo el frontend: `variantesTarjeta`, `transicionSuave`,
  `estaAbierto`, `alSalir`.

## 2. Accesibilidad: `prefers-reduced-motion` es obligatorio

Toda animación que desplace, escale o mueva contenido debe degradarse a un simple
fundido (o a nada) cuando el usuario pide menos movimiento.

```tsx
import { useReducedMotion } from "motion/react"

const menosMovimiento = useReducedMotion()
const desplazamiento = menosMovimiento ? 0 : 12

<motion.div
  initial={{ opacity: 0, y: desplazamiento }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.2 }}
/>
```

No dejes `layout` ni animaciones de posición activas cuando `useReducedMotion()` es `true`.

## 3. Tamaño de bundle: `LazyMotion` + `m`

Vite ya vigila el peso. Usa la API reducida:

```tsx
import { LazyMotion, domAnimation, m } from "motion/react"

// una vez, alto en el árbol de la vista animada
<LazyMotion features={domAnimation}>
  <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
</LazyMotion>
```

- `m` en vez de `motion` dentro de `LazyMotion`.
- `domAnimation` para lo normal; `domMax` solo si necesitas drag o layout animations.
- No importes `motion` completo en una vista si `m` + `LazyMotion` cubre el caso.

## 4. Encaje con el stack

- **Recharts** ya anima solo (`isAnimationActive`). No animes el interior de una gráfica con
  Motion; como mucho, un `motion.div` para el *reveal* del contenedor de la gráfica. Evita
  doble animación (queda tembloroso).
- **`@tanstack/react-virtual`**: nunca pongas `layout` ni `AnimatePresence` por fila en listas
  virtualizadas de cientos/miles de filas. Anima el contenedor o el bloque de filtros, no cada
  fila.
- **`tsc` es el único gate** (strict, `noUnusedLocals`/`noUnusedParameters`): tipa las props,
  no dejes imports de `motion/react` sin usar, no dejes `Variants` a medias.
- Preferir animar `opacity` y `transform` (`x`, `y`, `scale`). Evita animar `width`, `height`,
  `top`, `left` salvo con `layout`.

## 5. Patrones frecuentes

**Entrada/salida de un modal o panel (con el `Modal` del sistema):**

```tsx
import { AnimatePresence, m, LazyMotion, domAnimation } from "motion/react"

<LazyMotion features={domAnimation}>
  <AnimatePresence>
    {estaAbierto && (
      <m.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.15 }}
      >
        {/* contenido del Modal existente */}
      </m.div>
    )}
  </AnimatePresence>
</LazyMotion>
```

**Reveal escalonado de tarjetas (`variants`):**

```tsx
const contenedor: Variants = {
  visible: { transition: { staggerChildren: 0.05 } },
}
const item: Variants = {
  oculto: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
}
```

## 6. Cuándo NO usar Motion

- Hover, focus, `active`, cambio de color, aparición simple → Tailwind (`transition-colors`,
  `duration-150`, `animate-pulse`, etc.).
- Un `disabled` que cambia opacidad, un spinner, un skeleton → clases del sistema.
- Transiciones de ruta completas: solo si la tarea lo pide explícitamente.

## 7. Al terminar

Reporta, además de lo habitual del agente `frontend`:

- Si esta tarea introdujo `motion` en `web/package.json` por primera vez y con qué aprobación
  de `arquitectura`.
- Dónde quedó el `LazyMotion` (ámbito) y si añadiste manejo de `useReducedMotion`.
- `npx tsc --noEmit` limpio.
