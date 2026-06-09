"""Agrega todos los routers bajo el prefijo /api."""
from fastapi import APIRouter

from app.api import (
    actas,
    aplicaciones,
    asignaciones,
    auth,
    azdo,
    bitacora,
    capacidad,
    categorias,
    cifras,
    configuracion,
    dashboard,
    estimaciones,
    festivos,
    personas,
    reportes,
    requerimientos,
    squads,
    tarifas,
    usuarios,
)

api_router = APIRouter(prefix="/api")
# Plataforma y seguridad
api_router.include_router(auth.router)
api_router.include_router(aplicaciones.router)
api_router.include_router(usuarios.router)
api_router.include_router(dashboard.router)
# Dominio de liquidación
api_router.include_router(requerimientos.router)
api_router.include_router(tarifas.router)
api_router.include_router(festivos.router)
api_router.include_router(actas.router)
# Dominio de carga de trabajo
api_router.include_router(personas.router)
api_router.include_router(squads.router)
api_router.include_router(categorias.router)
api_router.include_router(asignaciones.router)
api_router.include_router(capacidad.router)
api_router.include_router(estimaciones.router)
api_router.include_router(configuracion.router)
api_router.include_router(azdo.router)
# Transversal
api_router.include_router(bitacora.router)
api_router.include_router(reportes.router)
api_router.include_router(cifras.router)


@api_router.get("/health", tags=["health"])
async def health() -> dict:
    return {"status": "ok"}
