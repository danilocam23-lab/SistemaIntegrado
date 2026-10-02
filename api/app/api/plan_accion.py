# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Router de planes de acción (carga de trabajo)."""
from datetime import date
from typing import Literal

from beanie import PydanticObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator

from app.documents.persona import Persona
from app.documents.plan_accion import PlanAccion
from app.documents.usuario import Usuario
from app.middleware.aplicacion import ContextoAplicacion, contexto_aplicacion, contexto_escritura
from app.security.deps import permiso

router = APIRouter(prefix="/planes-accion", tags=["plan_accion"])

EstadoPlan = Literal["PENDIENTE", "EN_PROGRESO", "COMPLETADO", "CANCELADO"]


def _validar_fecha(valor: str | None) -> str | None:
    """Fecha opcional en formato estricto YYYY-MM-DD y calendario válido."""
    if valor is None:
        return None
    if len(valor) != 10:
        raise ValueError("fecha_limite debe tener formato YYYY-MM-DD")
    try:
        date.fromisoformat(valor)
    except ValueError:
        raise ValueError("fecha_limite debe ser una fecha válida YYYY-MM-DD") from None
    return valor


def _validar_titulo(valor: str) -> str:
    valor = valor.strip()
    if not valor:
        raise ValueError("El título es obligatorio")
    return valor


class PlanAccionIn(BaseModel):
    titulo: str = Field(max_length=200)
    descripcion: str | None = Field(default=None, max_length=2000)
    responsable_id: str | None = None
    fecha_limite: str | None = None
    estado: EstadoPlan = "PENDIENTE"

    _titulo = field_validator("titulo")(_validar_titulo)
    _fecha = field_validator("fecha_limite")(_validar_fecha)


class PlanAccionActualizar(BaseModel):
    """PUT parcial: solo se modifican los campos enviados."""

    titulo: str | None = Field(default=None, max_length=200)
    descripcion: str | None = Field(default=None, max_length=2000)
    responsable_id: str | None = None
    fecha_limite: str | None = None
    estado: EstadoPlan | None = None

    @field_validator("titulo")
    @classmethod
    def _titulo(cls, valor: str | None) -> str:
        if valor is None:
            raise ValueError("El título no puede ser nulo")
        return _validar_titulo(valor)

    @field_validator("estado")
    @classmethod
    def _estado(cls, valor: str | None) -> str:
        if valor is None:
            raise ValueError("El estado no puede ser nulo")
        return valor

    _fecha = field_validator("fecha_limite")(_validar_fecha)


async def _validar_responsable(ctx: ContextoAplicacion, responsable_id: str | None) -> None:
    """El responsable debe ser una persona de la aplicación activa (422/404)."""
    if not responsable_id:
        return
    try:
        oid = PydanticObjectId(responsable_id)
    except (InvalidId, TypeError):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "responsable_id con formato inválido"
        ) from None
    if await Persona.find_one({**ctx.filtro(), "_id": oid}) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Responsable no encontrado")


async def _obtener_propio(plan_id: str, ctx: ContextoAplicacion) -> PlanAccion:
    """Plan de la aplicación activa; id mal formado o ajeno => 404."""
    try:
        oid = PydanticObjectId(plan_id)
    except (InvalidId, TypeError):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Plan de acción no encontrado") from None
    plan = await PlanAccion.find_one({**ctx.filtro(), "_id": oid})
    if plan is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Plan de acción no encontrado")
    return plan


@router.get("", dependencies=[permiso("planes_accion.ver")])
async def listar(
    estado: EstadoPlan | None = None,
    limite: int = Query(default=1000, ge=1, le=5000),
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
):
    consulta = ctx.filtro()
    if estado:
        consulta["estado"] = estado
    return await PlanAccion.find(consulta).sort("-creado_en").limit(limite).to_list()


@router.post("", status_code=status.HTTP_201_CREATED)
async def crear(
    datos: PlanAccionIn,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    _: Usuario = permiso("planes_accion.editar"),
):
    await _validar_responsable(ctx, datos.responsable_id)
    plan = PlanAccion(aplicacion_id=ctx.codigo, **datos.model_dump())
    await plan.insert()
    return plan


@router.put("/{plan_id}")
async def actualizar(
    plan_id: str,
    datos: PlanAccionActualizar,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    _: Usuario = permiso("planes_accion.editar"),
):
    plan = await _obtener_propio(plan_id, ctx)
    cambios = datos.model_dump(exclude_unset=True)
    if "responsable_id" in cambios and cambios["responsable_id"] != plan.responsable_id:
        await _validar_responsable(ctx, cambios.get("responsable_id"))
    for campo, valor in cambios.items():
        setattr(plan, campo, valor)
    plan.marcar_actualizado()
    await plan.save()
    return plan


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar(
    plan_id: str,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    _: Usuario = permiso("planes_accion.editar"),
) -> None:
    plan = await _obtener_propio(plan_id, ctx)
    await plan.delete()
