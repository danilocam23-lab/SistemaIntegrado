"""Punto de entrada de la API FastAPI."""
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.bootstrap import bootstrap
from app.config import get_settings
from app.db import cerrar_db, init_db
from app.services.scheduler import detener_scheduler, iniciar_scheduler

logging.basicConfig(level=logging.INFO)
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_lista,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

# --- Servido del frontend (SPA) en producción ---
if _DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(_DIST / "assets")), name="assets")

    @app.get("/{ruta:path}", include_in_schema=False)
    async def spa(ruta: str) -> FileResponse:
        """Cualquier ruta no-API devuelve index.html (enrutado del lado del cliente)."""
        return FileResponse(str(_DIST / "index.html"))
