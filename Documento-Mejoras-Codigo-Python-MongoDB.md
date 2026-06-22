# Documento Técnico: Mejoras de Código y Limpieza Funcional

**Sistema Integrado — Backend Python/FastAPI + MongoDB/Beanie + Frontend React/TypeScript**

**Fecha:** 2026-06-18  
**Enfoque:** Programador Senior Python & MongoDB  
**Base de datos:** `tecnoinsights_unificado` (19 colecciones, ~20 índices)

---

## 1. Diagnóstico Ejecutivo del Estado Actual

### Arquitectura general

| Capa | Tecnología | Estado |
|------|-----------|--------|
| Backend | FastAPI + Beanie (ODM) + Pydantic v2 | Funcional, con deuda técnica moderada |
| Base de datos | MongoDB (servicio local / IIS en producción) | Índices definidos, esquemas parcialmente tipados |
| Frontend | React 18 + TypeScript + Vite + Tailwind | Funcional, tipos espejo del backend |
| Integración | Azure DevOps (httpx + PAT) | Módulo complejo, sin logging |
| Despliegue | IIS + HttpPlatformHandler + Uvicorn | Operativo con script `publicar-iis.bat` |

### Fortalezas observadas

- Separación clara de documentos Beanie por archivo.
- Multi-tenancy vía header `X-Aplicacion` con middleware dedicado.
- Enumeraciones tipadas (`StrEnum`) para estados, roles y permisos.
- Máquina de estados bien definida (`services/state_machine.py`).
- Índices únicos correctos en colecciones clave.

### Debilidades principales

1. **Defaults mutables** en modelos Beanie/Pydantic (`list[str] = []`) — riesgo de compartir estado entre instancias.
2. **Manejo de errores inconsistente** — `except Exception` en servicios críticos sin logging.
3. **Endpoint muerto** — `asignaciones.eliminar()` sin decorador de ruta (inalcanzable).
4. **State machine no integrada** — el endpoint `/transicion` no invoca `validar_transicion_requerimiento`.
5. **Scripts de BD desincronizados** — conteos e índices no coinciden con los modelos actuales.
6. **Secret JWT hardcodeado** en configuración por defecto.
7. **Código duplicado** en CRUD de routers (actas, categorías, capacidades, tarifas).
8. **Páginas frontend huérfanas** — `Actas.tsx`, `Categorias.tsx`, `DashboardUnificado.tsx`, `Importacion.tsx`, `Placeholder.tsx` sin ruta en `App.tsx`.

---

## 2. Campos Obsoletos o Sospechosos de Obsolescencia

### 2.1 Backend (Documentos Beanie)

| Colección | Campo | Sospecha | Criterio de validación |
|-----------|-------|----------|----------------------|
| `requerimientos` | `acta_trabajo: str \| None` | Legacy: las actas ahora se gestionan en `actas_trabajo` como colección separada con `acta_trabajo_id` en `Entrega`. | Verificar si algún endpoint o frontend lee este campo directamente (vs `entregas[].acta_trabajo_id`). |
| `requerimientos` | `reemplaza_a_id: str \| None` | Solo se escribe en transición a estado `REQUERIMIENTO_REEMPLAZADO`; no se consulta en ningún endpoint o vista. | `grep -r "reemplaza_a_id"` en frontend y verificar si se muestra en UI. |
| `requerimientos` | `seguimiento: str \| None` | Campo de texto libre sin uso visible en endpoints de lectura/dashboards. | Confirmar con producto si se expone en algún reporte. |
| `requerimientos` | `monto_pactado: Decimal \| None` | Podría ser derivable de `total_horas_estimadas * tarifa`. | Validar si se usa independientemente o si es cache precomputado. |
| `personas` | `usuario_id: str \| None` | Relación inversa a `Usuario`; no se usa en queries observados. | Verificar si es lookup manual o si Beanie/link lo usa. |
| `squads` | `lt_hitss_id: str \| None` | Legacy del Sistema Liquidador; ahora la relación se hace via `Solicitud.lt_hitss_id`. | Confirmar si se sincroniza/actualiza. |
| `capacidades` | `scope: str = "persona"` | Polimorfismo por string; el campo debería ser enum o la colección dividirse. | Validar distribución: `db.capacidades.aggregate([{$group:{_id:"$scope",n:{$sum:1}}}])` |
| `azdo_config` | `learned_fields: dict \| None` | Cache de campos descubiertos en Azure DevOps; nunca se limpia. | Verificar si afecta rendimiento con configuraciones antiguas. |
| `azdo_work_items` | `asignacion_id`, `proyecto_id`, `sprint_id` | Cross-links que replican jerarquía ya presente en `Asignacion.proyectos[].sprints[]`. | Verificar si el frontend o algún servicio los consulta directamente. |
| `estimaciones` | `created_task_hitss`, `created_task_epm`, `created_hu_hitss`, `created_feature_hitss` | Flags de creación en Azure DevOps; podrían estar en log separado. | Verificar si se usan para prevenir duplicados (idempotencia). |

### 2.2 Frontend (Tipos TypeScript)

| Interfaz | Campo | Sospecha |
|----------|-------|----------|
| `Solicitud` | `aplicativo_id` | Nombre inconsistente con `aplicacion_id` del resto del sistema. Es legacy del Sistema Liquidador original. |
| `Persona` | `permite_sobrecarga?` | Solo se lee en `Asignaciones.tsx` para un tooltip; valor por defecto `false`. Posible feature no terminada. |
| `Persona` | `es_lider_tecnico?` | Se muestra como badge pero no impacta lógica de negocio observable. |
| `Tarifa` | `ramificacion` | Campo usado en un solo lugar del Excel importer; frontend lo muestra sin interacción. |
| `Requerimiento` | `acta_trabajo` | Misma sospecha que backend — campo string suelto vs relación en `Entrega`. |

### 2.3 Payloads/API

| Endpoint | Campo en payload | Sospecha |
|----------|-----------------|----------|
| `POST /requerimientos` | `seguimiento` | Se envía pero no se renderiza en ninguna vista. |
| `PUT /requerimientos/{id}` | `monto_pactado` | Editable pero no se usa en dashboards ni liquidación. |
| `GET /cifras/*` | Respuestas incluyen `ans_estimacion`, `ans_acta` | Pueden ser `null` en >50% de registros. Verificar utilidad vs ruido. |

### Criterio general para validar antes de eliminar

```
1. grep/búsqueda en todo el repo (backend + frontend + scripts).
2. Query en MongoDB para distribución de valores: db.coleccion.aggregate([{$group:{_id:"$campo",n:{$sum:1}}}])
3. Si >95% es null/vacío Y no se lee en UI → candidato a deprecar.
4. Marcar con @deprecated en docstring + feature flag antes de borrar.
5. Período de gracia: 2 sprints (4 semanas) sin uso → eliminar.
```

---

## 3. Funcionalidades Potencialmente Obsoletas o Redundantes

### 3.1 Funcionalidades sin ruta activa

| Funcionalidad | Archivo(s) | Evidencia |
|---------------|-----------|-----------|
| Página de Actas independiente | `web/src/pages/Actas.tsx` | No aparece en `App.tsx` routes. Las actas se gestionan dentro de `EntregasActas.tsx`. |
| Página de Categorías independiente | `web/src/pages/Categorias.tsx` | Ruta `/categorias` redirige a `/configuracion`. |
| Dashboard Unificado | `web/src/pages/DashboardUnificado.tsx` | No enroutado; posible prototipo abandonado. |
| Página de Importación | `web/src/pages/Importacion.tsx` | No enroutado; la importación se hace vía `/api/importacion/excel`. |
| Placeholder | `web/src/pages/Placeholder.tsx` | Página genérica de desarrollo; no debería existir en producción. |

### 3.2 Endpoints con funcionalidad solapada

| Endpoint A | Endpoint B | Solapamiento |
|-----------|-----------|--------------|
| `GET /api/dashboard/consolidado` | `GET /api/cifras/estado` + `cifras/squad` + `cifras/ans` | Dashboard consolidado agrega lo que cifras entrega por separado. Posible redundancia. |
| `GET /api/tarifas` (global, router `tarifas.py`) | Sección tarifas en `Configuracion.tsx` | Misma data, dos puntos de acceso en UI. |
| `DELETE /api/bitacora/{id}` | No hay `POST /api/bitacora` manual | Solo se puede borrar bitácora, no crearla manualmente. Evaluar si el delete es necesario. |

### 3.3 Servicios infrautilizados

| Servicio | Estado |
|----------|--------|
| `services/state_machine.py` | **Definido pero no invocado** en el endpoint `/transicion`. El endpoint acepta cualquier estado sin validar. |
| `services/sync_catalogo.py` | Solo se invoca desde `POST /asignaciones/sincronizar/{codigo_req}`. Funcionalidad limitada. |
| `services/scheduler.py` | Scheduler global APScheduler; arranca sync cada 30 min pero el error handling es genérico. |

### 3.4 Sidebar con enlaces legacy

- `/tarifas` y `/categorias` en el Sidebar redirigen a `/configuracion`. Limpiar los enlaces o eliminar las redirecciones.

---

## 4. Campos/Modelos en MongoDB — Recomendaciones de Normalización

### 4.1 Documentos embebidos vs colecciones separadas

| Caso | Estado actual | Recomendación | Justificación |
|------|--------------|---------------|---------------|
| `Requerimiento.entregas[]` | Array embebido de `Entrega` (hasta ~10 items) | **Mantener embebido** | Cardinalidad baja, siempre se lee junto con el requerimiento. |
| `Asignacion.proyectos[].sprints[]` | Doble anidamiento (Proyecto → Sprint → AzdoSprint) | **Evaluar extracción** | Si un proyecto tiene >20 sprints, el documento crece; actualización parcial requiere `$set` con path profundo. |
| `Estimacion.filas[]` | Array con potencialmente cientos de filas | **Candidato a colección separada** | Un requerimiento grande puede tener 200+ filas de estimación. Documentos >1MB causan problemas. Verificar con `db.estimaciones.find().forEach(d => print(d.filas.length))`. |
| `Solicitud` embebido en `Requerimiento` | Objeto embebido fijo | **Mantener** | Es 1:1, siempre se lee junto. |

### 4.2 Campos candidatos a eliminación (con backup previo)

| Colección | Campo | Razón | Acción propuesta |
|-----------|-------|-------|-----------------|
| `requerimientos` | `acta_trabajo` | Duplica `entregas[].acta_trabajo_id`. | Migrar datos a entregas si no están; luego deprecar. |
| `requerimientos` | `seguimiento` | Sin uso en UI ni reportes. | Validar en BD: si >90% null → deprecar. |
| `squads` | `lt_hitss_id` | Relación legacy; ahora vive en `Solicitud`. | Confirmar no-uso y deprecar. |

### 4.3 Índices — Revisión

| Índice | Colección | Problema |
|--------|-----------|----------|
| `uq_app_req_squad_sc` (unique) en `requerimientos` | Modelo Beanie | El script `crear_bd.js` define `uq_app_codigo_req` en `(aplicacion_id, codigo_req)` — **índice diferente**. Posible conflicto de unicidad. |
| `ix_app` en `categorias` | Solo `aplicacion_id` | Podría ser compuesto con `orden` para ordenamiento frecuente. |
| Sin índice en `estimaciones.requerimiento_id` solo | `estimaciones` | `ix_app_req` es compuesto; queries por `requerimiento_id` sin `aplicacion_id` no lo usan eficientemente. *A validar con `.explain()`.* |

### 4.4 Consistencia de nombrado

| Patrón inconsistente | Ejemplos | Recomendación |
|---------------------|----------|---------------|
| `aplicacion_id` vs `aplicativo_id` | `DocumentoOperativo.aplicacion_id`, `Solicitud.aplicativo_id` | Unificar a un solo nombre; `aplicativo_id` refiere a la colección `aplicativos` (software target), no al tenant. Renombrar a `aplicativo_referencia_id` o documentar explícitamente. |
| IDs como `str` vs `PydanticObjectId` | Todos los `*_id` son `str` | Consistente pero pierde validación de formato. Considerar `Annotated[str, Field(pattern=r"^[0-9a-f]{24}$")]` para IDs de Mongo. |
| `creado_en` / `actualizado_en` vs `iniciado_en` / `finalizado_en` | `DocumentoBase` vs `AzdoSyncLog` | OK semánticamente, pero documentar el patrón para futuros devs. |

---

## 5. Recomendaciones de Calidad de Código Python

### 5.1 Tipado estricto

**Problema actual:**
```python
# documents/persona.py — mutable default
squads: list[str] = []

# api/bitacora.py — comparación string en vez de enum
if usuario.rol != "superadmin":
```

**Recomendación:**
```python
# Corregir defaults mutables (TODAS las ocurrencias)
from pydantic import Field
squads: list[str] = Field(default_factory=list)

# Usar enums existentes
from app.documents.enums import RolUsuario
if usuario.rol != RolUsuario.SUPERADMIN:
```

**Archivos afectados** (defaults mutables):
- `documents/usuario.py` — `aplicaciones_codigos`, `permisos`
- `documents/persona.py` — `squads`
- `documents/asignacion.py` — `proyectos`
- `documents/estimacion.py` — `filas`
- `documents/requerimiento.py` — `developers_asignados`, `entregas`
- `schemas/usuario.py` — `aplicaciones_codigos`

### 5.2 Validaciones y errores

**Problema:** Excepciones genéricas sin contexto.

```python
# services/azure_devops.py (actual)
except Exception:
    pass  # silencia errores de sync

# services/scheduler.py (actual)
except Exception:
    pass  # scheduler traga errores
```

**Recomendación:**
```python
import logging
logger = logging.getLogger(__name__)

try:
    await sincronizar(...)
except httpx.HTTPError as e:
    logger.error("Sync AzDO falló: %s", e, exc_info=True)
    raise SyncError(f"Error de red en sync: {e}") from e
except Exception as e:
    logger.critical("Error inesperado en scheduler: %s", e, exc_info=True)
```

### 5.3 Logging estructurado

**Estado actual:** No hay logging en ningún servicio ni endpoint.

**Recomendación:**
```python
# config.py — agregar configuración de logging
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

# En cada servicio/router:
logger = logging.getLogger(__name__)
logger.info("Requerimiento %s transitó: %s → %s", codigo, estado_actual, nuevo_estado)
```

### 5.4 Organización por capas

**Estado actual:** Los routers contienen lógica de negocio directamente (queries, validaciones, transformaciones).

**Propuesta de capas:**
```
api/          → Solo HTTP: parsear request, llamar servicio, retornar response
services/     → Lógica de negocio pura (validaciones, cálculos, orquestación)
repositories/ → (NUEVO) Acceso a datos: queries Beanie encapsulados
documents/    → Modelos de persistencia
schemas/      → DTOs de entrada/salida
```

**Ejemplo concreto — extraer lógica de `api/requerimientos.py`:**
```python
# services/requerimiento_service.py (nuevo)
class RequerimientoService:
    async def transitar(self, codigo_req: str, app_id: str, nuevo_estado: str) -> Requerimiento:
        req = await Requerimiento.find_one(...)
        if not req:
            raise NotFoundError("Requerimiento no encontrado")
        validar_transicion_requerimiento(req.estado, nuevo_estado)
        req.estado = nuevo_estado
        await req.save()
        return req
```

### 5.5 Pruebas

**Estado actual:** `pytest` y `pytest-asyncio` en dev-dependencies, pero **no se observan archivos de test** en el repositorio.

**Recomendación prioritaria:**
1. Crear directorio `api/tests/` con `conftest.py` que inicialice Beanie con `mongomock` o testcontainers.
2. Tests unitarios para:
   - `services/state_machine.py` (ya es lógica pura — fácil de testear)
   - `services/ans.py`
   - `services/liquidacion.py`
   - `services/fecha_limite.py`
3. Tests de integración para:
   - Flujo completo de requerimiento (crear → transitar → entrega)
   - Importación Excel

---

## 6. Recomendaciones Específicas para MongoDB/Beanie

### 6.1 Índices

| Acción | Detalle |
|--------|---------|
| **Auditar índices duplicados** | El modelo Beanie y `crear_bd.js` definen índices distintos para `requerimientos`. Con `allow_index_dropping=True` en `db.py`, Beanie gobierna; pero el script crea residuos si se ejecuta post-deployment. |
| **Agregar índice compuesto** | `estimaciones`: agregar `(aplicacion_id, requerimiento_id, -creado_en)` para queries frecuentes de "última estimación por requerimiento". |
| **Evaluar índice parcial** | `requerimientos` con `estado != "CANCELADO"`: la mayoría de queries filtran estados activos. Un partial index mejora rendimiento. |
| **Verificar selectividad** | `ix_app` en `categorias` tiene baja cardinalidad si hay pocas apps. Puede no justificarse. Usar `db.categorias.aggregate([{$indexStats:{}}])`. |

### 6.2 Consistencia de esquemas

| Problema | Impacto | Solución |
|----------|---------|----------|
| `allow_index_dropping=True` | Beanie puede borrar índices manuales al reiniciar | Documentar qué índices gestiona Beanie vs manuales. Considerar `allow_index_dropping=False` en producción. |
| Sin validación de schema en MongoDB | Documentos pueden tener campos extra por bugs | Agregar JSON Schema validation a nivel de colección para campos críticos. |
| Decimal128 manual | `tarifa.py`, `acta_trabajo.py`, `orden_compra.py` usan conversiones manuales | Centralizar en un tipo anotado reutilizable: `MongoDecimal = Annotated[Decimal, BeforeValidator(...)]`. |

### 6.3 Migraciones

**Estado actual:** No hay sistema de migraciones. Los cambios de esquema se aplican manualmente o vía bootstrap.

**Recomendación:**
```python
# migrations/ (nuevo directorio)
# Usar patrón simple de scripts versionados:
# migrations/001_agregar_fecha_limite.py
# migrations/002_deprecar_acta_trabajo_string.py

async def migrate_001():
    """Agrega fecha_limite a requerimientos sin ella."""
    await Requerimiento.find({"fecha_limite": {"$exists": False}}).update_many(
        {"$set": {"fecha_limite": None}}
    )
```

Alternativamente, evaluar `mongodb-migrations` o `beanie-migrations` (si se estabiliza).

### 6.4 Cardinalidad y documentos grandes

| Colección | Riesgo | Métrica a verificar |
|-----------|--------|-------------------|
| `estimaciones` | `filas[]` puede crecer a cientos de elementos | `db.estimaciones.aggregate([{$project:{n:{$size:"$filas"}}},{$sort:{n:-1}},{$limit:5}])` |
| `asignaciones` | `proyectos[].sprints[]` anidamiento profundo | `db.asignaciones.aggregate([{$project:{n:{$size:"$proyectos"}}},{$sort:{n:-1}},{$limit:5}])` |
| `requerimientos` | `entregas[]` + `developers_asignados[]` | Generalmente < 10 entregas; OK. |

### 6.5 Consultas optimizadas

**Problema observado en `api/requerimientos.py`:**
```python
# Carga TODOS los requerimientos y filtra en Python
reqs = await Requerimiento.find(Requerimiento.aplicacion_id == ctx.codigo).to_list()
```

**Recomendación:**
```python
# Paginación + proyección
reqs = await Requerimiento.find(
    Requerimiento.aplicacion_id == ctx.codigo,
    Requerimiento.estado.is_in(estados_activos),
).sort(-Requerimiento.creado_en).skip(offset).limit(limit).to_list()
```

---

## 7. Indicaciones Concretas de Refactor

### 7.1 Quick Wins (1–2 semanas)

| # | Tarea | Archivo(s) | Esfuerzo | Impacto |
|---|-------|-----------|----------|---------|
| 1 | **Corregir defaults mutables** | 6 archivos documents + 1 schema | 2h | Alto — previene bugs sutiles |
| 2 | **Agregar decorador al endpoint `eliminar` en asignaciones** | `api/asignaciones.py:98` | 15min | Crítico — funcionalidad rota |
| 3 | **Integrar state machine en `/transicion`** | `api/requerimientos.py` | 1h | Alto — integridad de datos |
| 4 | **Reemplazar comparaciones de string por enum** | `api/bitacora.py`, otros | 1h | Medio — type safety |
| 5 | **Agregar logging básico** | Todos los servicios | 4h | Alto — observabilidad |
| 6 | **Eliminar páginas huérfanas del frontend** | 5 archivos `pages/` | 1h | Bajo — limpieza |
| 7 | **Sincronizar `crear_bd.js` con modelos Beanie** | `scripts/crear_bd.js` | 2h | Medio — consistencia |
| 8 | **Eliminar secret JWT hardcodeado del default** | `api/app/config.py` | 30min | Crítico — seguridad |
| 9 | **Centralizar conversión Decimal128** | `documents/tarifa.py`, `acta_trabajo.py`, `orden_compra.py` | 2h | Medio — DRY |
| 10 | **Limpiar sidebar de rutas obsoletas** | `web/src/components/Sidebar.tsx` | 30min | Bajo — UX |

### 7.2 Mejoras Estructurales (1–2 meses)

| # | Tarea | Descripción | Esfuerzo | Impacto |
|---|-------|-------------|----------|---------|
| 1 | **Crear capa de servicios completa** | Extraer lógica de negocio de routers a `services/`. Cada entidad principal (requerimientos, estimaciones, asignaciones) con su servicio. | 2 semanas | Alto |
| 2 | **Implementar paginación server-side** | Agregar `skip/limit` a todos los endpoints de listado. Frontend con infinite scroll o paginación. | 1 semana | Alto (performance) |
| 3 | **Suite de tests** | `conftest.py` con DB de test, tests para state machine, ANS, liquidación, importación. Meta: >60% coverage en `services/`. | 2 semanas | Alto |
| 4 | **Sistema de migraciones** | Directorio `migrations/` con scripts versionados y runner. Ejecutar en bootstrap si hay pendientes. | 1 semana | Medio |
| 5 | **Extraer `Estimacion.filas` a colección separada** | Nueva colección `filas_estimacion` con referencia a `estimacion_id`. Migración de datos existentes. | 1 semana | Medio-Alto |
| 6 | **Refactor Azure DevOps service** | Dividir `azure_devops.py` (467 líneas) en: `azdo_client.py` (HTTP), `azdo_mapper.py` (normalización), `azdo_creator.py` (work items). | 1 semana | Medio |
| 7 | **Schemas unificados** | Eliminar modelos Pydantic inline de routers; centralizar en `schemas/` con herencia `Base/Create/Update/Response`. | 1 semana | Medio |
| 8 | **Feature flags para deprecación** | Implementar sistema simple (colección `configuracion` con prefijo `ff_`) para deshabilitar campos/features gradualmente. | 3 días | Medio |

---

## 8. Checklist de Ejecución Segura

### 8.1 Antes de cualquier cambio

- [ ] **Backup de base de datos:** `mongodump --db tecnoinsights_unificado --out ./backup_$(date +%Y%m%d)`
- [ ] **Snapshot del estado actual de índices:** `db.getCollectionNames().forEach(c => print(c, JSON.stringify(db[c].getIndexes())))`
- [ ] **Documentar baseline de métricas:**
  - Conteo de documentos por colección
  - Tamaño promedio de documentos en colecciones sospechosas (`estimaciones`, `asignaciones`)
  - Queries lentas: activar profiler `db.setProfilingLevel(1, {slowms: 100})`

### 8.2 Validación de campos antes de eliminar

```javascript
// Script de auditoría — ejecutar en mongosh
const campo = "acta_trabajo";
const coleccion = "requerimientos";

// 1. Distribución de valores
db[coleccion].aggregate([
  { $group: { _id: { $type: `$${campo}` }, count: { $sum: 1 } } }
]);

// 2. Documentos con valor no-null
const conValor = db[coleccion].countDocuments({ [campo]: { $ne: null, $exists: true } });
const total = db[coleccion].estimatedDocumentCount();
print(`${campo}: ${conValor}/${total} tienen valor (${(conValor/total*100).toFixed(1)}%)`);

// 3. Si < 5% tiene valor → candidato a deprecar
```

### 8.3 Proceso de deprecación seguro

```
Semana 1: Marcar campo con comentario @deprecated + agregar logging cuando se lee/escribe
Semana 2: Monitorear logs — si 0 lecturas/escrituras en 7 días → proceder
Semana 3: Dejar de enviar el campo en responses (backend)
Semana 4: Eliminar del frontend
Semana 5: Eliminar del modelo Beanie (el campo persiste en MongoDB pero se ignora)
Semana 6: (Opcional) Limpiar campo con updateMany: db.col.updateMany({}, {$unset: {campo: ""}})
```

### 8.4 Rollback

| Escenario | Acción |
|-----------|--------|
| Error en migración de datos | `mongorestore --db tecnoinsights_unificado ./backup_YYYYMMDD` |
| Índice nuevo causa lock | `db.coleccion.dropIndex("nombre_indice")` |
| Campo eliminado causa error en frontend | Re-deploy de versión anterior vía `publicar-iis.bat` con el commit previo |
| Nuevo servicio falla | Revertir a lógica inline en router (git revert) |

### 8.5 Medición de impacto post-cambio

- [ ] **Performance:** Comparar tiempos de respuesta de endpoints principales antes/después (usar `httpx` o Postman collection runner).
- [ ] **Errores:** Monitorear logs por 48h post-deploy (`findstr /i "error" logs\*.log`).
- [ ] **Integridad:** Ejecutar queries de validación:
  ```javascript
  // Verificar que no hay documentos huérfanos
  db.asignaciones.find({persona_id: {$nin: db.personas.distinct("_id").map(String)}}).count()
  db.requerimientos.find({"solicitud.squad_id": {$nin: db.squads.distinct("_id").map(String)}}).count()
  ```
- [ ] **Tamaño de documentos:** Post-extracción de `filas`:
  ```javascript
  db.estimaciones.aggregate([{$project:{size:{$bsonSize:"$$ROOT"}}},{$group:{_id:null,avg:{$avg:"$size"},max:{$max:"$size"}}}])
  ```

---

## Resumen: Top 5 Recomendaciones de Mayor Impacto

| # | Recomendación | Justificación | Esfuerzo |
|---|--------------|---------------|----------|
| **1** | **Corregir defaults mutables + integrar state machine** | Previene bugs de corrupción de datos y garantiza integridad de estados. Riesgo actual: dos instancias pueden compartir la misma lista; transiciones inválidas se aceptan silenciosamente. | 1 día |
| **2** | **Agregar logging estructurado a servicios** | Sin logging, los errores en producción (sync AzDO, scheduler, importación) son invisibles. El `except Exception: pass` actual oculta fallos críticos. | 1 día |
| **3** | **Implementar paginación server-side** | Todos los `find().to_list()` sin límite cargan colecciones enteras en memoria. Con crecimiento de datos, esto se convierte en cuello de botella. | 1 semana |
| **4** | **Crear suite de tests para servicios críticos** | `state_machine`, `liquidacion`, `ans`, `fecha_limite` son lógica pura testeable. Sin tests, cualquier refactor es riesgoso. | 2 semanas |
| **5** | **Extraer `Estimacion.filas[]` a colección separada** | Documentos con cientos de filas embebidas superarán el límite de 16MB y degradan performance de queries. Migración proactiva antes de que sea emergencia. | 1 semana |

---

*Documento generado a partir del análisis del repositorio `C:\Sistema Integrado` — commit actual del branch activo.*  
*Todos los hallazgos marcados como "a validar" requieren confirmación con datos reales de producción antes de ejecutar cambios.*
