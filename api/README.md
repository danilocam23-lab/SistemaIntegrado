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

## Pendiente

Portar el dominio del Liquidador y del Workload Manager (ver el documento de arquitectura,
fases 3–5).
