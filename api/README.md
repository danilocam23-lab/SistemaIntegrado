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

## Pendiente

Portar el dominio del Liquidador y del Workload Manager (ver el documento de arquitectura,
fases 3–5).
