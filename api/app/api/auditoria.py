"""Consulta restringida y paginada; no permite borrar ni editar la auditoría."""
from datetime import UTC, datetime
from typing import Literal
from uuid import UUID

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query

from app.documents.auditoria import Auditoria
from app.documents.identidad_analitica import IdentidadAnalitica
from app.documents.usuario import Usuario
from app.middleware.aplicacion import ContextoAplicacion, contexto_aplicacion
from app.security.deps import es_superadmin, permiso
from app.services.auditoria import RutaAuditada

router = APIRouter(prefix="/auditoria", tags=["auditoria"], route_class=RutaAuditada)


def filtro_operativo(ctx: ContextoAplicacion) -> dict:
    # No revelar eventos consolidados que también incluyen aplicaciones ajenas.
    return {
        "plataforma": False,
        "aplicaciones_codigos": {"$in": ctx.codigos},
        "$expr": {"$setIsSubset": ["$aplicaciones_codigos", ctx.codigos]},
    }


def _fecha_utc(fecha: datetime) -> datetime:
    return fecha.replace(tzinfo=UTC) if fecha.tzinfo is None else fecha.astimezone(UTC)


async def _consultar(
    filtro: dict, desde: datetime | None, hasta: datetime | None, pagina: int, limite: int
) -> dict:
    if desde and hasta and _fecha_utc(desde) > _fecha_utc(hasta):
        raise HTTPException(422, "El inicio debe ser anterior al final.")
    if desde or hasta:
        rango: dict = {}
        if desde:
            rango["$gte"] = _fecha_utc(desde)
        if hasta:
            rango["$lte"] = _fecha_utc(hasta)
        filtro["creado_en"] = rango
    consulta = Auditoria.find(filtro)
    total = await consulta.count()
    eventos = await Auditoria.find(filtro).sort("-creado_en", "-_id").skip(
        (pagina - 1) * limite
    ).limit(limite).to_list()
    return {
        "total": total, "pagina": pagina, "limite": limite,
        "eventos": [evento.model_dump(mode="json") for evento in eventos],
    }


@router.get("")
async def listar(
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    _: Usuario = permiso("admin.auditoria.ver"),
    usuario_id: str | None = None,
    id_analitico: UUID | None = None,
    recurso_id: str | None = None,
    recurso_tipo: str | None = None,
    accion: str | None = None,
    resultado: Literal["exito", "fallo"] | None = None,
    desde: datetime | None = None,
    hasta: datetime | None = None,
    pagina: int = Query(1, ge=1, le=10000),
    limite: int = Query(50, ge=1, le=200),
) -> dict:
    filtro = filtro_operativo(ctx)
    for clave, valor in (
        ("usuario_id", usuario_id), ("id_analitico", id_analitico),
        ("recurso_id", recurso_id), ("recurso_tipo", recurso_tipo),
        ("accion", accion), ("resultado", resultado),
    ):
        if valor is not None:
            filtro[clave] = str(valor)
    return await _consultar(filtro, desde, hasta, pagina, limite)


@router.get("/plataforma")
async def plataforma(
    usuario: Usuario = permiso("admin.auditoria.ver"),
    desde: datetime | None = None,
    hasta: datetime | None = None,
    pagina: int = Query(1, ge=1, le=10000),
    limite: int = Query(50, ge=1, le=200),
) -> dict:
    if not await es_superadmin(usuario):
        raise HTTPException(403, "Solo superadmin puede consultar auditoría de plataforma.")
    return await _consultar({"plataforma": True}, desde, hasta, pagina, limite)


@router.get("/identidad/{id_analitico}")
async def identidad(
    id_analitico: UUID,
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    usuario: Usuario = permiso("admin.auditoria.ver"),
) -> dict:
    correspondencia = await IdentidadAnalitica.find_one({"id_analitico": str(id_analitico)})
    if correspondencia is None:
        raise HTTPException(404, "Identidad no encontrada en el ámbito autorizado.")
    filtro: dict = {"_id": ObjectId(correspondencia.usuario_id)}
    if not await es_superadmin(usuario):
        filtro["aplicaciones_codigos"] = {"$in": ctx.codigos}
    objetivo = await Usuario.find_one(filtro)
    if objetivo is None:
        raise HTTPException(404, "Identidad no encontrada en el ámbito autorizado.")
    return {
        "id_analitico": str(id_analitico), "usuario_id": str(objetivo.id),
        "nombre": objetivo.nombre, "email": objetivo.email,
    }
