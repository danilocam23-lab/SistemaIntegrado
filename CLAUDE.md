# CLAUDE.md

Guía para trabajar en este repositorio. El proyecto es la **plataforma unificada
multi-aplicación HITSS**: integra el Sistema Liquidador EPM-HITSS y el Workload
Manager sobre una sola base MongoDB, un backend FastAPI y un frontend React.

## Estructura del repositorio

Monorepo sin `package.json` en la raíz. Cada sub-proyecto se maneja por separado:

```
api/        Backend FastAPI + Beanie (MongoDB)
web/        Frontend React + TypeScript + Vite
scripts/    Migración y utilidades de datos (SQLite -> MongoDB, fixes puntuales)
deploy/     Publicación en IIS (web.config + publicar-iis.bat)
docs/       Documentos HTML generados (arquitectura, modelo de datos, grafos)
```

## Comandos

### Backend (`api/`)

```bash
cd api
python -m venv .venv
.venv\Scripts\pip install -e ".[dev]"
copy .env.example .env
.venv\Scripts\python -m uvicorn app.main:app --reload   # API en :8000, docs en /docs
```

- Lint / formato: `ruff check .` (line-length 100, reglas `E,F,I,B,UP,N`)
- Tipos: `mypy app`
- Tests: `pytest` (`asyncio_mode = auto`)

### Frontend (`web/`)

```bash
cd web
npm install
npm run dev       # :5173, proxy /api -> http://localhost:8000
npm run build     # tsc && vite build  -> web/dist
npm run preview
```

TypeScript en modo `strict` con `noUnusedLocals` / `noUnusedParameters`: el build
falla ante imports o variables sin usar.

### Arranque completo (Windows)

`arrancar.bat` en la raíz: crea el venv, instala backend y frontend, genera
`api\.env`, verifica/instala/arranca MongoDB y abre backend y frontend en ventanas
separadas. `iniciar-mongodb.bat` hace solo el paso de MongoDB.

## Stack real

### Backend

- **FastAPI** >= 0.115, **Python** >= 3.11
- **Beanie** >= 1.27 como ODM sobre MongoDB, usando `pymongo.AsyncMongoClient`
  (Motor quedó descartado; Beanie reciente ya no lo soporta)
- **Pydantic** 2 + **pydantic-settings** para configuración
- **python-jose** para JWT (HS256), **bcrypt** para contraseñas
- **APScheduler** para auto-sync de Azure DevOps
- **httpx** cliente de Azure DevOps; **openpyxl** import/export Excel; **aiosmtplib** correo
- Gestión de dependencias: **pip + `pyproject.toml`** (build con hatchling), no Poetry ni uv

### Frontend

- **React** 18.3 + **TypeScript** 5.7, empaquetado con **Vite** 6
- **react-router-dom** 6 (rutas en `src/App.tsx`, con `basename={import.meta.env.BASE_URL}`)
- **Tailwind CSS** 3.4 (+ postcss, autoprefixer)
- **Recharts** 3 para gráficos
- **axios** para HTTP; **xlsx** para exportar; **@tanstack/react-virtual** para tablas largas
- Gestor de paquetes: **npm** (`package-lock.json`)

## Arquitectura backend (`api/app/`)

```
main.py         App FastAPI: lifespan (init_db -> bootstrap -> scheduler), CORS,
                GZip, y servido del SPA desde web/dist en produccion
config.py       Settings (pydantic-settings) leidos de api/.env
db.py           AsyncMongoClient + init_beanie(ALL_DOCUMENTS)
bootstrap.py    Crea la aplicacion inicial (epm-hitss) y el superadmin al arrancar
documents/      Modelos Beanie = colecciones MongoDB (una clase por archivo)
schemas/        DTOs Pydantic de entrada/salida
security/       hashing (bcrypt), jwt, rbac (roles/permisos), deps (dependencias FastAPI)
middleware/     Resolucion de la aplicacion activa (multi-tenant)
services/       Logica de dominio: ans, liquidacion, state_machine, azure_devops,
                azdo_sync, scheduler, provision_aplicacion, fecha_limite, sync_catalogo
repositories/   Acceso a datos especializado (p.ej. soporte solicitudes de fabrica)
importer/       Importacion de datos
api/            Routers REST; se agregan en api/router.py
```

### Multi-aplicación (multi-tenant)

Toda petición a recursos operativos exige la cabecera **`X-Aplicacion`** con el
código de la aplicación. Los roles `superadmin` y `admin_app` pueden enviar
`X-Aplicacion: __todas__` para el **modo consolidado** (solo lectura). Las
colecciones operativas llevan `aplicacion_id`.

### Integración externa (Power Automate)

Cada endpoint bajo `/api/integracion/*` usa su **propia** API Key independiente
(header `X-API-Key`), nunca se reutiliza entre endpoints. Claves actuales:
`API_KEY` (entregas), `API_KEY_REQUERIMIENTOS`, `API_KEY_SOLICITUDES`. El detalle
del patrón para añadir una nueva está en `api/README.md`.

Recordatorio: `api/.env` está en `.gitignore`. Editar solo `.env.example` no
habilita una clave en ejecución; hay que pegar el valor real en `api/.env`.

## Arquitectura frontend (`web/src/`)

```
main.tsx        Punto de entrada
App.tsx         Rutas (react-router). Login publico; el resto bajo ProtectedRoute
                + Layout, cada ruta envuelta en RoleRoute permiso="..."
pages/          ~35 pantallas (dashboards, requerimientos, facturacion, soporte,
                asignaciones, capacidades, roadmap, administracion, ...)
components/     Layout, Sidebar, Modal, ProtectedRoute, RoleRoute, SelectorAplicacion
components/ui/  Primitivos del sistema de diseno (primitivos.tsx, FiltroDesplegable)
context/        AuthContext (sesion/JWT), AplicacionContext (aplicacion activa)
api/            client.ts (axios: base URL, token, header X-Aplicacion), hooks.ts
types/          Tipos compartidos
constantes.ts   Constantes de UI/negocio
```

### Sistema de diseño

Las clases utilitarias propias están en español y viven en el `safelist` de
`web/tailwind.config.js`: `btn` (+ variantes), `tarjeta`, `kpi`, `chip`, `aviso`,
`campo`, `pestana`, `tabla`, `barra-filtros`, etc. Color de marca: `marca`
(azul corporativo HITSS, con escala 50–900). Escala tipográfica y radios
redefinidos en el mismo config. Al crear UI, reutilizar estas clases antes de
escribir Tailwind crudo.

## Deploy

IIS con HttpPlatformHandler. Ejecutar `deploy\publicar-iis.bat` como
Administrador: compila el frontend, publica el backend, configura la
sub-aplicación IIS `/SistemaIntegrado` y ajusta permisos. En producción,
`VITE_APP_BASE` define el sub-path y `main.py` sirve `web/dist` como SPA.
Detalles en `deploy/README.md`.

## Convenciones

- Código, comentarios, nombres de variable, mensajes de commit y documentación
  en **español**.
- Backend: seguir el estilo de `ruff` (E, F, I, B, UP, N) con líneas de 100.
- Frontend: componentes en PascalCase, un componente de página por archivo en
  `pages/`; reutilizar `components/ui/` y las clases del sistema de diseño.
- No commitear `api/.env`, `web/dist/`, `node_modules/`, `.venv/`.

## Grafo del proyecto (graphify)

`graphify-out/` contiene un grafo de conocimiento del repo (código + docs) generado con
`/graphify`: `graph.json`, `GRAPH_REPORT.md` (god nodes, comunidades, puentes) y `graph.html`.

**Regla — consultar el grafo primero.** Ante cualquier consulta, pregunta o análisis sobre el
código (dónde vive algo, qué llama a qué, radio de impacto de un cambio, cómo fluye X), si
existe `graphify-out/graph.json` empieza por el grafo antes de explorar a mano:

- `graphify query "<pregunta>"` — contexto amplio (BFS).
- `graphify path "<A>" "<B>"` — camino más corto entre dos conceptos.
- `graphify explain "<símbolo>"` — explicación de un nodo.
- Sin `Bash` (p. ej. `verificacion`): leer `graphify-out/GRAPH_REPORT.md` y `Grep` en
  `graphify-out/graph.json` por el id del símbolo.

Lee a fondo solo los archivos que el grafo señale; `Grep`/`Glob` a mano solo para lo que no
cubra o si `graphify-out/` no existe. Vale para el hilo principal y para todos los agentes.
Tras cambios grandes en el repo, refrescar con `/graphify . --update`.

## Equipo de agentes

Subagentes definidos en `.claude/agents/`. Ficha explicada de cada uno en el vault:
`30-componentes/agentes/` (índice en `30-componentes/agentes/indice.md`).

| name | Cuándo usarlo |
|---|---|
| `frontend` | Integrar/terminar en `web/` código que produjo Codex; o cambio pequeño directo de React/TS/UI: filtros, estados, render, estilos, gráficas Recharts, troceo de vistas grandes, adopción del sistema de diseño. Verifica con `tsc`/`build`. |
| `backend` | Integrar/terminar en `api/` código que produjo Codex; o cambio pequeño directo: endpoint, campo de documento, servicio, script de datos. Aplica multi-tenant (`ctx.filtro()`), RBAC (`requiere_permiso`), `MongoDecimal`, alta en `router.py`. Verifica con `ruff`/`mypy`/`uvicorn`. |
| `arquitectura` | Decisiones de estructura: en qué capa vive la lógica (`router` vs `services/` vs `repositories/`), capa nueva, rediseño del modelo Beanie o del aislamiento multi-tenant, patrón/librería transversal, redactar un ADR, **diagramar o modelar**. Entrega el ADR en texto para `20-decisiones/` y genera los diagramas **siempre con la skill `archify`**, en `<vault>/90-generado/diagramas/`. No toca código de producción. |
| `verificacion` | Revisar un cambio ya hecho (diff, rama, archivos) antes de darlo por bueno: correctitud, casos borde, fugas de `aplicacion_id`, permisos RBAC, regresiones, test faltante. **Solo lee y reporta**, no corrige. |
| `depuracion` | Bug difícil y **reproducible**: intermitente, "antes funcionaba", excepción de causa no obvia. Hipótesis → bisección con git → instrumentación temporal → causa raíz demostrada antes de parchear. |

### Pipeline Codex-first (`frontend` y `backend`)

Para funcionalidad nueva o un cambio grande de código:

1. El hilo principal ejecuta `/codex:rescue --write "<tarea precisa>"` — Codex deja la
   implementación en el árbol de trabajo.
2. Se delega en `frontend` / `backend` para revisar ese diff, adaptarlo a las convenciones de
   este documento, corregir lo que haga falta y verificarlo.

Para cambios pequeños (un bug, un ajuste, un refactor de una función) se omite el paso 1 y el
agente edita directo. `arquitectura`, `verificacion` y `depuracion` nunca pasan por Codex.

### Enrutamiento visible (en cada turno, sin que el usuario lo pida)

1. Antes de actuar sobre cualquier petición, anuncia en una línea con qué agente(s) la vas a
   trabajar y por qué. Formato: `→ Agente: <name> — <motivo>` (o `→ Agentes: <a>, <b> — <motivo>`
   si son varios).
2. Puedes usar varios agentes a la vez (en paralelo o en secuencia) cuando la tarea lo pida. No
   pidas permiso para delegar ni esperes confirmación: anúncialo y procede.
3. **Errores y cambios de código: primero diagnosticar, luego delegar el arreglo.**
   1. Verifica el error: reproduce, ubícalo con el grafo de graphify, lee el/los archivo(s)
      implicados. El diagnóstico lo hace el hilo principal, o `depuracion` (bug difícil /
      intermitente) o `verificacion` (revisar un cambio ya hecho).
   2. Pasa la **corrección** a `frontend` y/o `backend` según las capas que toque el arreglo —
      una, otra o ambas. Anúncialo, p. ej.
      `→ Diagnóstico en hilo principal → Agente: frontend — corrige el disabled del botón`.
   3. El hilo principal **no edita** código de `web/`, `api/` ni `scripts/`, por pequeño que
      sea el cambio (un `disabled`, un import, una línea). Eso siempre es de un agente.
4. `→ Sin agente` es **solo** para lo que no toca código del proyecto: responder una pregunta,
   explicar, buscar, decidir proceso, operaciones de git o de entorno. Nunca para editar
   archivos de `web/`, `api/` o `scripts/`.
5. Si a mitad de tarea cambia el agente que corresponde, vuelve a anunciarlo.

## Vault (documentación viva)

La documentación viva del proyecto **no vive en este repo**, sino en un vault de
Obsidian en:

```
C:\SistemaIntegrado Boveda\SistemaIntegrado
```

(La carpeta que contiene `.obsidian/` es el vault; `...\SistemaIntegrado Boveda\`
es solo el contenedor.)

El repo guarda solo lo que acompaña al código (este `CLAUDE.md`, los `README.md`
de cada sub-proyecto, los HTML de `docs/`). Todo lo demás —decisiones de
arquitectura, fichas de componentes, notas de rendimiento, investigación— va al
vault.

### Estructura del vault

```
00-inbox/           Captura rapida sin clasificar. Contiene indice.md (mapa del vault)
10-arquitectura/    Vision de sistema, limites, integraciones, flujos de datos
20-decisiones/      ADRs: una decision por archivo. Plantilla: _plantilla-adr.md
30-componentes/     Fichas de componentes de UI y modulos backend.
                    Plantilla: _plantilla-ficha-componente.md
40-rendimiento/     Mediciones, perfiles, optimizaciones, presupuestos de rendimiento
90-generado/        Salida de Claude. Editable por el usuario; se puede regenerar
.obsidian/          Configuracion de Obsidian. NO TOCAR
```

### Reglas para escribir en el vault

- **Todo lo que genere Claude va en `90-generado/`.** Las demás carpetas son
  escritura del usuario; Claude solo escribe fuera de `90-generado/` si el
  usuario lo pide de forma explícita.
- **Nunca** crear, editar ni borrar nada dentro de `.obsidian/`.
- Formato **Markdown con frontmatter YAML** al inicio de cada nota:

  ```yaml
  ---
  title: Título legible de la nota
  tags: [arquitectura, cache]
  date: 2026-09-09
  estado: borrador        # borrador | activo | archivado (o el que aplique al tipo)
  ---
  ```

- Enlaces entre notas con **`[[wikilinks]]`** (por título o nombre de archivo),
  no rutas relativas Markdown.
- **Nombres de archivo en kebab-case y sin tildes ni eñes**:
  `decision-cache-requerimientos.md`, `ficha-selector-aplicacion.md`.
- Una idea por archivo: un ADR = una decisión; una ficha = un componente.
- Al añadir una nota en `90-generado/`, enlazarla desde `00-inbox/indice.md`.
