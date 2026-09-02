# Sistema de diseño — Sistema Integrado HITSS

Todas las vistas usan las mismas clases. **No escribas clases sueltas de Tailwind
para botones, campos o filtros**: usa las clases o los componentes de abajo.

- Tokens (fuente, colores, radios, sombras, escala tipográfica): `web/tailwind.config.js`
- Clases del sistema: `web/src/index.css` (capa `@layer components`)
- Componentes React: `web/src/components/ui/`
- Referencia visual: abre `docs/sistema-diseno.html` en el navegador

## Tipografía

| Clase | Tamaño | Uso |
|---|---|---|
| `text-2xs` | 11 px | etiquetas en mayúsculas, contadores |
| `text-xs` | 12 px | texto secundario, celdas densas |
| `text-sm` | 13 px | cuerpo de tablas y formularios |
| `text-base` | 14 px | cuerpo por defecto |
| `text-lg` | 16 px | subtítulos |
| `text-2xl` | 22 px | título de página (`titulo-pagina`) |

Fuente: **Inter** (con respaldo a Segoe UI / system-ui).
Títulos: `titulo-pagina`, `titulo-seccion`, `subtitulo-pagina`, `etiqueta-sup`.

## Botones

```tsx
import { Boton } from '../components/ui'

<Boton variante="primario">Guardar</Boton>
<Boton variante="secundario" tamano="sm">Cancelar</Boton>
```

En HTML: `class="btn btn-primario"`.

Variantes: `btn-primario`, `btn-secundario`, `btn-suave`, `btn-fantasma`,
`btn-peligro`, `btn-peligro-suave`, `btn-exito`, `btn-alerta`.
Modificadores: `btn-sm`, `btn-lg`, `btn-icono`, `btn-bloque`.

Acciones en texto dentro de tablas: `enlace-accion`
(+ `enlace-accion-peligro` / `enlace-accion-alerta` / `enlace-accion-sutil`).

## Campos

`campo` para input / select / textarea; `campo-sm` para celdas densas.
Etiquetas con `etiqueta` (o el componente `Campo` / `Selector`, que ya la incluyen).

## Filtros

- Contenedor: `barra-filtros`
- Desplegable de selección múltiple: componente `FiltroDesplegable`
  (**único** filtro de este tipo; ya cierra al hacer clic fuera y con Escape)

```tsx
<FiltroDesplegable label="Año" icono="📅" opciones={anos}
  activos={anosActivos} setActivos={setAnosActivos} />
```

## Superficies

`tarjeta` + `tarjeta-pad`, `tarjeta-encabezado`, `tarjeta-titulo`,
`tabla-scroll` + `tabla`, `kpi` / `kpi-rotulo` / `kpi-valor` / `kpi-nota`,
`aviso` + `aviso-info|alerta|error|exito`, `chip` + `chip-neutro|marca|exito|alerta|error`,
`pestanas` + `pestana` / `pestana-activa`.

## Encabezado de página

```tsx
<EncabezadoPagina icono="📊" titulo="Backlog" descripcion="…" acciones={<>…</>} />
```

## Responsive

- Menú lateral: panel deslizante en móvil (botón ☰), colapsable en escritorio.
- Tablas: desplazamiento horizontal dentro de `tabla-scroll`; la página nunca
  se desplaza en horizontal.
- Formularios: los campos ocupan el ancho completo por debajo de 640 px.
- Botones con altura táctil mínima de 36 px en móvil.

## Reglas al añadir clases nuevas

Si compones un nombre de clase dinámicamente (`` `aviso-${tono}` ``) Tailwind no lo
detecta. Usa un mapa con nombres literales, o añade la clase a `safelist` en
`tailwind.config.js`.
