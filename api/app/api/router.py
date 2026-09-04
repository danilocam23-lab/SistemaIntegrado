"""Agrega todos los routers bajo el prefijo /api."""
from fastapi import APIRouter

from app.api import (
    actas,
    aplicaciones,
    asignaciones,
    auth,
    azdo,
    backlog_futuro,
    bitacora,
    capacidad,
    categorias,
    cifras,
    configuracion,
    control_horas,
    dashboard,
    endpoints_admin,
    estimaciones,
    festivos,
    garantias_wo,
    importacion,
    integracion,
    personas,
    plan_accion,
    reportes,
    requerimientos,
    roles,
    soporte,
    squads,
    tarifas,
    usuarios,
)

api_router = APIRouter(prefix="/api")
# Plataforma y seguridad
api_router.include_router(auth.router)
api_router.include_router(aplicaciones.router)
api_router.include_router(usuarios.router)
api_router.include_router(roles.router)
api_router.include_router(endpoints_admin.router)
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
api_router.include_router(plan_accion.router)
api_router.include_router(backlog_futuro.router)
api_router.include_router(estimaciones.router)
api_router.include_router(configuracion.router)
api_router.include_router(azdo.router)
api_router.include_router(importacion.router)
api_router.include_router(soporte.router)
api_router.include_router(garantias_wo.router)
api_router.include_router(control_horas.router)
# Transversal
api_router.include_router(bitacora.router)
api_router.include_router(reportes.router)
api_router.include_router(cifras.router)
# Integración externa (Power Automate, etc.)
api_router.include_router(integracion.router)


@api_router.get("/health", tags=["health"])
async def health() -> dict:
    return {"status": "ok"}

# reload trigger
