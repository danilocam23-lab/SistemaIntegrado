# Despliegue en IIS — Sistema Integrado HITSS

Publicación del backend FastAPI + el frontend React como una sub-aplicación de IIS
bajo `/SistemaIntegrado`, usando **HttpPlatformHandler** (el mismo patrón del
Sistema Liquidador).

## Requisitos en el servidor

| Componente | Detalle |
|---|---|
| Python 3.11+ | Instalado en una ruta accesible por IIS, p. ej. `E:\Python313` (no en `C:\Users\...`) |
| Node.js 18+ | Para compilar el frontend (`npm run build`) |
| IIS | Con el módulo **HttpPlatformHandler** (`choco install httpplatformhandler --yes`) |
| MongoDB 7.x | Servicio de Windows en marcha; ver `MONGO_URL` en `api/.env` |
| Sitio IIS `IIS_PRD` | Debe existir; el script crea la sub-aplicación `/SistemaIntegrado` |

## Pasos

1. Ajusta `api/.env` (copiando `api/.env.example`):
   - `MONGO_URL`, `MONGO_DB`
   - `JWT_SECRET` (clave larga y única)
   - `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD` (credenciales iniciales)
2. Revisa las variables al inicio de `publicar-iis.bat` si tu entorno difiere:
   `SITE_NAME`, `APP_POOL`, `PUBLISH_DIR`, `IIS_PYTHON_BASE`.
3. Ejecuta **como Administrador**:
   ```
   deploy\publicar-iis.bat
   ```

El script: compila el frontend, copia `api/` y `web/dist/` a `PUBLISH_DIR`, crea el
entorno virtual e instala dependencias, verifica que la app importa, genera el
`web.config`, crea/actualiza la aplicación IIS y ajusta permisos.

## Estructura publicada

```
E:\IIS_PRD\Sistema_Integrado\
├─ web.config              Generado por el script
├─ logs\                   stdout de Uvicorn
├─ api\
│  ├─ app\                 Backend FastAPI
│  ├─ .venv\               Entorno virtual
│  └─ .env                 Configuración
└─ web\dist\               Frontend compilado (lo sirve FastAPI)
```

## Primer arranque

Al iniciar, la aplicación crea automáticamente (`bootstrap`):
- la **aplicación inicial** (`epm-hitss`) con su estructura base,
- el **usuario superadmin** con las credenciales de `.env`.

La migración de datos desde los sistemas antiguos se hace aparte con
`scripts/migrar_a_mongo.py` (ver el README principal y la sección 10 del
documento de arquitectura).

## Operación

```
Ver logs:   type E:\IIS_PRD\Sistema_Integrado\logs\stdout*.log
Reciclar:   %windir%\system32\inetsrv\appcmd.exe recycle apppool "IIS_PRD"
Detener:    %windir%\system32\inetsrv\appcmd.exe stop site "IIS_PRD"
```

## Problemas frecuentes

| Síntoma | Causa probable |
|---|---|
| HTTP 502.3 / la app no arranca | Revisa `logs\stdout*.log`; suele ser `MONGO_URL` mal configurada o MongoDB apagado |
| HTTP 500.19 | Falta el módulo HttpPlatformHandler en IIS |
| "Access denied" al iniciar Python | El AppPool no tiene permisos sobre el Python base; reejecuta el script como Administrador |
| El frontend no carga | `web\dist` no se copió; revisa que `npm run build` terminó sin errores |
