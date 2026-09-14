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
from app.security.deps import sincronizar_permisos_openapi

_SUBROUTERS = (
    auth.router,
    aplicaciones.router,
    usuarios.router,
    roles.router,
    endpoints_admin.router,
    dashboard.router,
    requerimientos.router,
    tarifas.router,
    festivos.router,
    actas.router,
    personas.router,
    squads.router,
    categorias.router,
    asignaciones.router,
    capacidad.router,
    plan_accion.router,
    backlog_futuro.router,
    estimaciones.router,
    configuracion.router,
    azdo.router,
    importacion.router,
    soporte.router,
    garantias_wo.router,
    control_horas.router,
    bitacora.router,
    reportes.router,
    cifras.router,
    integracion.router,
)

# F4.2 (ADR-0008): publica en el OpenAPI de cada ruta el permiso que ya exige en
# tiempo de ejecución. Se hace sobre cada sub-router ANTES de `include_router`
# porque, desde FastAPI >= 0.140, `include_router` no copia las `APIRoute`: las
# envuelve en un `_IncludedRouter` perezoso y solo expone el objeto original en
# el momento de generar el esquema. Iterar `api_router.routes` después de
# incluirlos no encuentra ninguna `APIRoute` (verificado); hay que marcar el
# permiso directamente sobre el router original de cada módulo.
for _router in _SUBROUTERS:
    sincronizar_permisos_openapi(_router)

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
