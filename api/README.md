# API — Sistema Integrado HITSS

Backend FastAPI + Beanie (MongoDB) de la plataforma unificada multi-aplicación.

## Arranque

```bash
python -m venv .venv
.venv\Scripts\pip install -e .
copy .env.example .env
.venv\Scripts\python -m uvicorn app.main:app --reload
```

- API: `http://localhost:8000`
- Documentación interactiva: `http://localhost:8000/docs`

## Estructura

```text
app/
├─ main.py            App FastAPI, lifespan, CORS, exception handlers globales,
│                      servido del frontend (SPA) en producción
├─ config.py          Configuración (variables de entorno / .env)
├─ db.py              Cliente pymongo.AsyncMongoClient + init_beanie()
├─ bootstrap.py       Crea la aplicación inicial y el superadmin
├─ errors.py          Jerarquía de excepciones de dominio (ver "Errores" abajo)
├─ documents/         Modelos Beanie (colecciones MongoDB)
├─ schemas/           DTOs Pydantic de entrada/salida
├─ security/          Hashing bcrypt, JWT y dependencias de rol/permiso (RBAC)
├─ middleware/        Resolución de la aplicación activa (multi-tenant)
├─ services/          Lógica de dominio (liquidación, ANS, state machine,
│                      Azure DevOps, provisión de aplicaciones, ...)
├─ repositories/      Acceso a datos especializado cuando un servicio lo
│                      necesita (hoy solo lo usa el servicio de soporte:
│                      `soporte_solicitudes_fabrica_repository.py`); el resto
│                      del backend consulta Beanie directamente desde `api/`
│                      o `services/`, no hay una capa de repositorio genérica
└─ api/               Routers REST (se agregan en `api/router.py`)
```

## Multi-aplicación

Toda petición a recursos operativos exige la cabecera `X-Aplicacion` con el código de la
aplicación. Los roles `superadmin` y `admin_app` pueden enviar `X-Aplicacion: __todas__`
para activar el **modo consolidado**: lectura de todas las aplicaciones autorizadas a la vez.

**El modo consolidado es de solo lectura.** Un endpoint operativo depende de una de estas
dos dependencias (`app/middleware/aplicacion.py`), nunca las mezcla:

- `contexto_aplicacion`: lectura; admite `__todas__`.
- `contexto_escritura`: cualquier escritura; **rechaza** `__todas__` con `409 Conflicto`
  ("El modo consolidado es de solo lectura; seleccione una aplicación concreta"). Un
  cliente que intente `POST`/`PUT`/`PATCH`/`DELETE` con `X-Aplicacion: __todas__` recibe
  ese 409, no un 4xx genérico.

Toda consulta operativa filtra además con `ctx.filtro()` (o `ctx.filtro_con_squad()`
para colecciones con un campo `squads` tipo lista, como `Persona`) — nunca se omite
`aplicacion_id` en una consulta sobre una colección que hereda de `DocumentoOperativo`.

## RBAC — cómo declarar el permiso de una ruta

Cada endpoint operativo protege su acceso con el permiso RBAC que corresponda del
catálogo (`app/security/rbac.py::PERMISOS_CATALOGO`). Se declara con el helper
`permiso(nombre)` de `app/security/deps.py`, nunca comprobando el permiso a mano
dentro del cuerpo del endpoint:

```python
from app.security.deps import permiso

@router.post("", response_model=RequerimientoOut)
async def crear(
    datos: RequerimientoIn,
    _: Usuario = permiso("requerimientos.crear"),
) -> RequerimientoOut:
    ...
```

O, si el permiso aplica a **todos** los métodos de una ruta (patrón habitual en `GET`
sin parámetro en la función):

```python
@router.get("", dependencies=[permiso("requerimientos.ver")])
async def listar(ctx: ContextoAplicacion = Depends(contexto_aplicacion)) -> ...:
    ...
```

`permiso(nombre)` es azúcar sobre `Depends(requiere_permiso(nombre))` — mismo objeto
`Depends` en tiempo de ejecución —, pero además dispara un efecto importante (ADR-0008
F4.2): **el permiso queda publicado como dato en el propio contrato OpenAPI**
(`x-permiso` en `/openapi.json`), no solo como código Python que hay que leer para
saber qué protege una ruta. Esto ocurre automáticamente para cualquier ruta que
dependa —directa o indirectamente— de `requiere_permiso`, incluso si en algún sitio
antiguo se sigue viendo `Depends(requiere_permiso(...))` en vez de `permiso(...)`: es
`app/api/router.py::sincronizar_permisos_openapi()` quien recorre el árbol de
dependencias real de cada ruta y hace la publicación, una vez, al montar `api_router`.
Del mismo modo, `_marcar_requiere_aplicacion()` publica `x-requiere-aplicacion` (si la
ruta depende de `contexto_aplicacion`/`contexto_escritura`).

Si el permiso combina más de uno con lógica OR (p. ej. "el usuario tiene A o B"), no
encaja en `permiso()` (que exige exactamente uno); se resuelve a mano con
`await tiene_permiso(usuario, "...")` dentro del cuerpo del endpoint — ver
`actualizar_detalle_ans_req` en `app/api/requerimientos.py` como referencia. Ese caso
queda fuera de la publicación automática en OpenAPI.

Si el permiso es nuevo, hay que darlo de alta en `PERMISOS_CATALOGO`
(`app/security/rbac.py`) **y** concederlo en los roles base que corresponda
(`ROLES_BASE`: `admin_app`, `viewer`; `superadmin` ya tiene todo vía `"*"`) — y avisar
para el espejo en el frontend (`RoleRoute permiso="..."` en `web/src/App.tsx`).

## Endpoints administrativos

- `GET /api/health`: disponibilidad de la API.
- `GET /api/admin/endpoints/catalogo`: catálogo vivo de toda la API (ADR-0008 F4.1),
  exige `admin.endpoints.ver`. Se deriva en caliente de `app.openapi()` —no de una
  lista escrita a mano—, así que no puede desincronizarse del código: por cada
  operación devuelve método, ruta, `operation_id`, módulo (del tag), resumen,
  parámetros, esquema del cuerpo, el permiso RBAC que exige, si requiere
  `X-Aplicacion`, y una clasificación de riesgo (`seguro`/`mutante`/`destructivo`).
  Se fusiona con el catálogo editable de notas de negocio (`EndpointAdmin`, colección
  `endpoints_admin`, gestionado con `GET/POST /api/admin/endpoints` y
  `PUT`/`DELETE /api/admin/endpoints/{endpoint_id}`), casando por método + ruta.
- `GET /api/requerimientos/{codigo_req}/diagnostico`: diagnóstico por código REQ o SC.
- `POST /api/requerimientos/{codigo_req}/reasignar-aplicacion?nueva_aplicacion={codigo}`:
  reasigna un requerimiento a otra aplicación desde modo consolidado.

## Azure DevOps HITSS/EPM

Los endpoints de `/api/azdo` aceptan `target=hitss|epm` para separar configuración,
prueba de conexión, descubrimiento de campos y sincronización:

- `GET /api/azdo/config?target=hitss|epm`
- `PUT /api/azdo/config` con `target` en el cuerpo.
- `GET /api/azdo/test?target=hitss|epm`
- `GET /api/azdo/campos-requeridos?target=hitss|epm`
- `POST /api/azdo/sync` con `azdo_project`, `iteration_path` y `target`.

El inventario completo se consulta en la vista frontend **Administración de Endpoints**.

## Integración externa (Power Automate) — patrón de API Keys

Cada endpoint bajo `/api/integracion/*` usa su **propia** API Key independiente
(header `X-API-Key`), nunca reutiliza la de otro endpoint. Al crear uno nuevo:

1. Agregar el campo en `app/config.py` (`Settings`) y su fallback en `get_settings()`
   (bloque `# Integración externa`).
2. Agregar la variable a `.env.example` **y también al `.env` real del entorno**
   (`.env` está en `.gitignore`, por lo que editar solo `.env.example` no habilita
   la clave en ejecución — hay que generar y pegar un valor real en `.env`).
3. Crear la función `_verificar_api_key_<nombre>` en `app/api/integracion.py`
   siguiendo el patrón de `_verificar_api_key_requerimientos`.
4. Documentar el nuevo endpoint en `ENDPOINTS` y agregar su formulario de prueba
   en `web/src/pages/AdminEndpoints.tsx` (sección "Probar integración de ...").

Claves actuales: `API_KEY` (entregas), `API_KEY_REQUERIMIENTOS`, `API_KEY_SOLICITUDES`.

## Errores — códigos HTTP y contrato de respuesta

Manejo centralizado (ADR-0008 F2.6, `app/errors.py` + los `exception_handler` globales
de `app/main.py`): los routers y servicios lanzan una excepción de dominio con un
mensaje ya pensado para el usuario final, nunca arman ellos mismos el `JSONResponse`.
Toda respuesta de error tiene la misma forma:

```json
{ "detail": "mensaje seguro para mostrar al usuario", "error_id": null }
```

`error_id` es un UUID **solo** cuando el código es `>= 500` (para poder buscar el
traceback real en el log del servidor por ese id); en el resto de los casos es `null`
porque el `detail` ya es suficiente y no hubo nada inesperado que investigar.

| Código | Cuándo | Cómo se produce |
|---|---|---|
| `400` | Regla de negocio simple violada, o `ValueError` de un servicio no migrado a `ErrorDominio` todavía | `raise ErrorDominio("...")` (default), o `raise ValueError("...")` — hay un handler global que lo traduce igual |
| `401` | No autenticado: falta el JWT, es inválido/expiró, o falla una API Key de `/api/integracion/*` | `usuario_actual`, `_verificar_api_key_*` |
| `403` | RBAC: falta el permiso que exige la ruta; o la aplicación en `X-Aplicacion` no está entre las autorizadas del usuario | `requiere_permiso`/`permiso()`, `contexto_aplicacion` |
| `404` | El recurso no existe, o no es visible para la aplicación activa (nunca se distingue de "no autorizado" para no filtrar existencia entre tenants) | `raise NoEncontrado("...")` |
| `409` | La operación no es válida en el estado actual: modo consolidado en una escritura, clave duplicada, transición de estado inválida | `raise Conflicto("...")`, o un `HTTPException(status.HTTP_409_CONFLICT, ...)` puntual |
| `422` | La forma del payload es correcta pero el valor no existe en el dominio (p. ej. `aplicacion` inexistente en `/api/integracion/*`); o falla la validación automática de Pydantic (forma incorrecta) | `raise EntradaInvalida("...")`, o el 422 automático de FastAPI |
| `502` | Falla un sistema externo (Azure DevOps, OneDrive/SharePoint) | `raise ErrorIntegracion("...")` |
| `500` | Cualquier excepción no prevista | red de seguridad final (`exception_handler(Exception)`); siempre trae `error_id` |

`GET /api/azdo/test` es la única excepción deliberada: devuelve `200` con
`{"ok": false, "error": "..."}` porque su propósito *es* reportar el estado de la
conexión, no fallar la petición HTTP en sí.

## Pendiente

- Tabla de códigos HTTP: quedan casos de la auditoría original (ADR-0008 E3) sin
  cubrir con un código más específico (p. ej. `409` cuando falta configurar Azure
  DevOps, `504` ante un timeout real) — hoy esos casos caen en `502`/`400` genéricos.
- Envoltorio único de resultado parcial (`{"procesados", "fallidos", "errores"}` +
  `207`) para operaciones que hoy mezclan éxito y fracaso dentro de un `200`
  (`GET /requerimientos/{codigo}/liquidacion`, `POST /estimaciones/{id}/crear-tareas-*`).
