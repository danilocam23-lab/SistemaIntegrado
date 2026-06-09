# Sistema Integrado HITSS

Plataforma unificada multi-aplicación que integra el **Sistema Liquidador EPM-HITSS** y el
**Workload Manager** sobre una sola base de datos MongoDB, un backend FastAPI y un frontend React.

Ver el documento de arquitectura: [`Documento-Integracion-Arquitectura.html`](Documento-Integracion-Arquitectura.html).

## Estructura

```text
sistema-integrado/
├─ api/            Backend FastAPI + Beanie (MongoDB)
├─ web/            Frontend React + TypeScript + Vite
├─ scripts/        Migración de datos SQLite → MongoDB
├─ referencias/    Documentos de la nueva versión multi-aplicación
└─ Documento-Integracion-Arquitectura.html
```

## Estado de este esqueleto

Este repositorio contiene la **base funcional** (Fases 0–6 del plan de arquitectura):

- ✅ Conexión a MongoDB con Beanie + Motor
- ✅ Modelo multi-aplicación (`aplicaciones`, `aplicacion_id` en colecciones operativas)
- ✅ Autenticación JWT + contraseñas con bcrypt
- ✅ Autorización por roles y permisos
- ✅ Resolución de aplicación + modo consolidado para roles admin
- ✅ Módulo de administración de aplicaciones y usuarios
- ✅ Provisión de estructura base para aplicaciones nuevas
- ✅ Endpoint del dashboard consolidado
- ✅ Frontend React con login, selector de aplicación y administración
- ✅ **Dominio de liquidación (Fase 3)**: requerimientos (con solicitud y entregas
  embebidas), tarifas, ANS, liquidación y máquina de estados
- ✅ **Dominio de carga de trabajo (Fase 4)**: personas, categorías, asignaciones (con
  proyectos y sprints embebidos), capacidades, estimaciones, configuración, la base de
  Azure DevOps y la sincronización requerimiento → carga
- ✅ **Pantallas React del dominio + reportes (Fase 5)**: requerimientos, tarifas, personas,
  categorías, asignaciones, capacidades y el reporte de roadmap/equipo
- ✅ **Migración de datos (Fase 8)**: `scripts/migrar_a_mongo.py` vuelca ambas bases SQLite
  a MongoDB (cruce de personas por email y de requerimientos por código), con modo `--dry-run`
- ✅ **Integración Azure DevOps**: cliente httpx (proyectos, iteraciones, work items),
  sincronización de iteraciones y scheduler de auto-sync con APScheduler
- ✅ **Despliegue en IIS (Fase 9)**: `deploy/web.config` + `deploy/publicar-iis.bat`
  (HttpPlatformHandler), ver `deploy/README.md`

El esqueleto cubre todas las fases del plan de arquitectura. Lo que resta es trabajo de
adopción: completar las funciones de dominio del script de migración con los datos reales,
pruebas de aceptación (Fase 10) y la puesta en producción.

## Puesta en marcha

### Requisitos
- Python 3.11+
- Node.js 18+
- MongoDB 7.x — `arrancar.bat` lo instala y arranca automáticamente si falta

### Arranque rápido (recomendado)

```
arrancar.bat
```

La primera vez crea el entorno virtual, instala las dependencias de backend y frontend
y genera `api\.env`. Además verifica MongoDB: si no está instalado lo instala (winget o
Chocolatey) y arranca el servicio. Luego abre el backend y el frontend en ventanas
separadas.

> El paso de MongoDB pide permisos de administrador (UAC). También puede ejecutarse
> por separado con `iniciar-mongodb.bat`.

### Backend (manual)
```bash
cd api
python -m venv .venv
.venv\Scripts\pip install -e .
copy .env.example .env
.venv\Scripts\python -m uvicorn app.main:app --reload
```
API en `http://localhost:8000` · documentación en `http://localhost:8000/docs`.

Al arrancar se crea la aplicación inicial `epm-hitss` y el usuario superadmin
(ver credenciales en `.env`).

### Frontend
```bash
cd web
npm install
npm run dev
```
Frontend en `http://localhost:5173`.

## Despliegue en IIS

Ejecuta `deploy\publicar-iis.bat` como Administrador. Compila el frontend, publica el
backend, configura la sub-aplicación IIS `/SistemaIntegrado` con HttpPlatformHandler y
ajusta permisos. Detalles y solución de problemas en [`deploy/README.md`](deploy/README.md).
