# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Punto de entrada de la API FastAPI."""
import logging
import os
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.bootstrap import bootstrap
from app.config import get_settings
from app.db import cerrar_db, init_db
from app.errors import ErrorDominio
from app.services.scheduler import detener_scheduler, iniciar_scheduler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("app.errores")
settings = get_settings()

# Frontend compilado (web/dist), si existe.
_DIST = Path(__file__).resolve().parents[2] / "web" / "dist"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await init_db()
    await bootstrap()
    iniciar_scheduler()
    yield
    detener_scheduler()
    await cerrar_db()


app = FastAPI(
    title=settings.app_name,
    root_path=os.environ.get("APP_ROOT_PATH", settings.app_root_path),
    lifespan=lifespan,
)

# Comprime respuestas JSON grandes (listados de soporte, requerimientos, etc.).
# Se añade antes que CORS para que CORS quede en la capa más externa.
app.add_middleware(GZipMiddleware, minimum_size=1024)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_lista,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Manejo centralizado de errores (ADR-0008 F2.6) ---
#
# Reemplaza los ~10 `try/except ValueError -> HTTPException(400, str(exc))`
# duplicados en los routers (E1 del ADR) y evita que una excepción de bajo
# nivel (openpyxl, httpx, pymongo) llegue al cliente con su mensaje crudo
# (E4): éste solo se registra en el log, con un `error_id` correlacionable
# que sí viaja en la respuesta para que el usuario lo reporte.
@app.exception_handler(ErrorDominio)
async def _manejar_error_dominio(_request: Request, exc: ErrorDominio) -> JSONResponse:
    error_id = None
    if exc.status_code >= 500:
        error_id = str(uuid.uuid4())
        # `exc_info=exc` conserva la cadena `raise ... from causa_original`
        # completa en el log aunque el mensaje mostrado al cliente sea neutro.
        logger.error("[%s] %s", error_id, exc.mensaje, exc_info=exc)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.mensaje, "error_id": error_id},
    )


@app.exception_handler(ValueError)
async def _manejar_value_error(_request: Request, exc: ValueError) -> JSONResponse:
    """Compatibilidad con el código de ``services/`` que aún no migró a ``ErrorDominio``.

    En este backend un ``ValueError`` que llega hasta el router siempre fue
    escrito a mano como mensaje de negocio (nunca envuelve sin traducir una
    excepción de bajo nivel), así que es seguro mostrarlo tal cual.
    """
    return JSONResponse(status_code=400, content={"detail": str(exc), "error_id": None})


@app.exception_handler(Exception)
async def _manejar_error_inesperado(request: Request, exc: Exception) -> JSONResponse:
    """Red de seguridad final: nunca se filtra un traceback ni un ``str(exc)`` al cliente."""
    error_id = str(uuid.uuid4())
    logger.exception(
        "[%s] Error no controlado en %s %s", error_id, request.method, request.url.path
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Ocurrió un error inesperado. Reporte este código a soporte.",
            "error_id": error_id,
        },
    )


app.include_router(api_router)

# --- Servido del frontend (SPA) en producción ---
if _DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(_DIST / "assets")), name="assets")

    @app.get("/{ruta:path}", include_in_schema=False, response_model=None)
    async def spa(ruta: str) -> FileResponse | JSONResponse:
        """Cualquier ruta no-API devuelve index.html (enrutado del lado del cliente).

        Se fuerza no-cache porque index.html referencia los nombres (con hash)
        de los bundles JS/CSS actuales: si el navegador lo cachea, el usuario
        puede quedar atrapado indefinidamente en una versión vieja del sitio
        (página en blanco o funciones/botones faltantes) tras cada despliegue.

        Las rutas bajo ``/api`` que no matchearon ningún router real NO deben
        caer aquí: si lo hicieran, un `GET /api/ruta-mal-escrita` devolvería
        `index.html` con 200 en vez de un 404 JSON (S12/E7 del ADR-0008).
        """
        if ruta == "api" or ruta.startswith("api/"):
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={"detail": "Ruta de API no encontrada"},
            )
        return FileResponse(
            str(_DIST / "index.html"),
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
            },
        )
