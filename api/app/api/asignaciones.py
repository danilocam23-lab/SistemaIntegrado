# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Router de asignaciones de carga de trabajo (proyectos y sprints embebidos)."""
from beanie import PydanticObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.documents.asignacion import Asignacion, Proyecto
from app.documents.base import ahora
from app.documents.categoria import Categoria
from app.documents.persona import Persona
from app.documents.requerimiento import Requerimiento
from app.documents.usuario import Usuario
from app.middleware.aplicacion import ContextoAplicacion, contexto_aplicacion, contexto_escritura
from app.security.deps import permiso
from app.services.sync_catalogo import sincronizar_requerimiento_a_carga

router = APIRouter(prefix="/asignaciones", tags=["asignaciones"])


class AsignacionIn(BaseModel):
    persona_id: str
    categoria_id: str
    total_porcentaje: float = Field(default=0, ge=0, le=100)
    estado: str = "active"
    activo: bool = True
    prioridad: bool = False
    proyectos: list[Proyecto] = []


def _oid(valor: str, etiqueta: str) -> PydanticObjectId:
    """Convierte un id recibido en el cuerpo; mal formado => 422."""
    try:
        return PydanticObjectId(valor)
    except (InvalidId, TypeError):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, f"{etiqueta} con formato inválido"
        ) from None


async def _validar_referencias(
    ctx: ContextoAplicacion,
    persona_id: str,
    categoria_id: str,
    proyectos: list[Proyecto],
    excluir_id: PydanticObjectId | None = None,
) -> None:
    """Valida que persona, categoría y requerimientos existan en la aplicación
    activa (404 sin revelar datos ajenos) y que no se duplique persona+requerimiento
    (409), tanto dentro del cuerpo como contra otras asignaciones de la persona."""
    filtro = ctx.filtro()
    if await Persona.find_one({**filtro, "_id": _oid(persona_id, "persona_id")}) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Persona no encontrada")
    if await Categoria.find_one({**filtro, "_id": _oid(categoria_id, "categoria_id")}) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Categoría no encontrada")

    req_ids = [p.requerimiento_id for p in proyectos if p.requerimiento_id]
    if len(set(req_ids)) != len(req_ids):
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Requerimiento repetido en los proyectos de la asignación"
        )
    if not req_ids:
        return
    oids = [_oid(r, "requerimiento_id") for r in req_ids]
    existentes = await Requerimiento.find({**filtro, "_id": {"$in": oids}}).count()
    if existentes != len(oids):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Requerimiento no encontrado")

    consulta = {**filtro, "persona_id": persona_id, "proyectos.requerimiento_id": {"$in": req_ids}}
    if excluir_id is not None:
        consulta["_id"] = {"$ne": excluir_id}
    if await Asignacion.find_one(consulta) is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "La persona ya tiene una asignación con alguno de esos requerimientos",
        )


async def _obtener_propia(asignacion_id: str, ctx: ContextoAplicacion) -> Asignacion:
    """Asignación de la aplicación activa; id mal formado o ajeno => 404."""
    try:
        oid = PydanticObjectId(asignacion_id)
    except (InvalidId, TypeError):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Asignación no encontrada") from None
    asignacion = await Asignacion.get(oid)
    if asignacion is None or asignacion.aplicacion_id != ctx.codigo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Asignación no encontrada")
    return asignacion


@router.get("", dependencies=[permiso("asignaciones.ver")])
async def listar(
    persona_id: str | None = None,
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
):
    """Lista asignaciones; opcionalmente filtra por persona."""
    consulta = ctx.filtro()
    if persona_id:
        consulta["persona_id"] = persona_id
    return await Asignacion.find(consulta).to_list()


@router.get("/{asignacion_id}", dependencies=[permiso("asignaciones.ver")])
async def obtener(
    asignacion_id: str, ctx: ContextoAplicacion = Depends(contexto_aplicacion)
):
    asignacion = await Asignacion.get(asignacion_id)
    if asignacion is None or asignacion.aplicacion_id not in ctx.codigos:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Asignación no encontrada")
    return asignacion


@router.post("", status_code=status.HTTP_201_CREATED)
async def crear(
    datos: AsignacionIn,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    _: Usuario = permiso("asignaciones.editar"),
):
    await _validar_referencias(ctx, datos.persona_id, datos.categoria_id, datos.proyectos)
    asignacion = Asignacion(aplicacion_id=ctx.codigo, **datos.model_dump())
    await asignacion.insert()
    return asignacion


@router.put("/{asignacion_id}")
async def actualizar(
    asignacion_id: str,
    datos: AsignacionIn,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    _: Usuario = permiso("asignaciones.editar"),
):
    asignacion = await _obtener_propia(asignacion_id, ctx)
    # Solo se aplican los campos presentes en el cuerpo: lo omitido (prioridad,
    # proyectos, ...) se conserva tal cual.
    cambios = {c: getattr(datos, c) for c in datos.model_fields_set}
    await _validar_referencias(
        ctx,
        cambios.get("persona_id", asignacion.persona_id),
        cambios.get("categoria_id", asignacion.categoria_id),
        cambios.get("proyectos", asignacion.proyectos),
        excluir_id=asignacion.id,
    )
    for campo, valor in cambios.items():
        setattr(asignacion, campo, valor)
    asignacion.marcar_actualizado()
    await asignacion.save()
    return asignacion


@router.patch("/{asignacion_id}/prioridad")
async def cambiar_prioridad(
    asignacion_id: str,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    _: Usuario = permiso("asignaciones.editar"),
):
    """Marca esta asignación como prioritaria para la persona y desmarca las demás."""
    asignacion = await _obtener_propia(asignacion_id, ctx)

    nueva_prioridad = not asignacion.prioridad

    if nueva_prioridad:
        # Desmarcar las demás de la misma persona en esta aplicación (un solo update).
        await Asignacion.get_pymongo_collection().update_many(
            {
                **ctx.filtro(),
                "persona_id": asignacion.persona_id,
                "_id": {"$ne": asignacion.id},
                "prioridad": True,
            },
            {"$set": {"prioridad": False, "actualizado_en": ahora()}},
        )

    asignacion.prioridad = nueva_prioridad
    asignacion.marcar_actualizado()
    await asignacion.save()
    return asignacion


@router.delete("/{asignacion_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar(
    asignacion_id: str,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    _: Usuario = permiso("asignaciones.editar"),
) -> None:
    asignacion = await _obtener_propia(asignacion_id, ctx)
    await asignacion.delete()


@router.post("/sincronizar/{codigo_req}")
async def sincronizar(
    codigo_req: str,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    _: Usuario = permiso("asignaciones.editar"),
) -> dict:
    """Proyecta un requerimiento sobre las asignaciones de carga de sus developers."""
    req = await Requerimiento.find_one(
        Requerimiento.aplicacion_id == ctx.codigo,
        Requerimiento.codigo_req == codigo_req,
    )
    if req is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Requerimiento no encontrado")
    creadas = await sincronizar_requerimiento_a_carga(req)
    return {"codigo_req": codigo_req, "asignaciones_sincronizadas": creadas}
