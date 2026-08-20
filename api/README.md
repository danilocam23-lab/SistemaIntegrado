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
├─ main.py            App FastAPI, lifespan, CORS, servido del frontend
├─ config.py          Configuración (variables de entorno)
├─ db.py              Cliente Motor + init_beanie()
├─ bootstrap.py       Crea la aplicación inicial y el superadmin
├─ documents/         Modelos Beanie (colecciones MongoDB)
├─ schemas/           DTOs Pydantic de entrada/salida
├─ security/          Hashing bcrypt, JWT y dependencias de rol/permiso
├─ middleware/        Resolución de la aplicación activa (multi-tenant)
├─ services/          Lógica de dominio (provisión de aplicaciones, ...)
└─ api/               Routers REST
```

## Multi-aplicación

Toda petición a recursos operativos exige la cabecera `X-Aplicacion` con el código de la
aplicación. Los roles `superadmin` y `admin_app` pueden enviar `X-Aplicacion: __todas__`
para activar el modo consolidado (solo lectura).

## Endpoints administrativos

- `GET /api/health`: disponibilidad de la API.
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

## Pendiente

Portar el dominio del Liquidador y del Workload Manager (ver el documento de arquitectura,
fases 3–5).
