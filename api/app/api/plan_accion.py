"""Router de planes de acción (carga de trabajo)."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.documents.plan_accion import PlanAccion
from app.documents.usuario import Usuario
from app.middleware.aplicacion import ContextoAplicacion, contexto_aplicacion, contexto_escritura
from app.security.deps import requiere_permiso

router = APIRouter(prefix="/planes-accion", tags=["plan_accion"])


class PlanAccionIn(BaseModel):
    titulo: str
    descripcion: str | None = None
    responsable_id: str | None = None
    fecha_limite: str | None = None
    estado: str = "PENDIENTE"


@router.get("")
async def listar(
    estado: str | None = None,
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
):
    consulta = ctx.filtro()
    if estado:
        consulta["estado"] = estado
    return await PlanAccion.find(consulta).sort("-creado_en").to_list()


@router.post("", status_code=status.HTTP_201_CREATED)
async def crear(
    datos: PlanAccionIn,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    _: Usuario = Depends(requiere_permiso("planes_accion.editar")),
):
    plan = PlanAccion(aplicacion_id=ctx.codigo, **datos.model_dump())
    await plan.insert()
    return plan


@router.put("/{plan_id}")
async def actualizar(
    plan_id: str,
    datos: PlanAccionIn,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    _: Usuario = Depends(requiere_permiso("planes_accion.editar")),
):
    plan = await PlanAccion.get(plan_id)
    if plan is None or plan.aplicacion_id != ctx.codigo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Plan de acción no encontrado")
    for campo, valor in datos.model_dump().items():
        setattr(plan, campo, valor)
    plan.marcar_actualizado()
    await plan.save()
    return plan


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar(
    plan_id: str,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    _: Usuario = Depends(requiere_permiso("planes_accion.editar")),
) -> None:
    plan = await PlanAccion.get(plan_id)
    if plan is None or plan.aplicacion_id != ctx.codigo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Plan de acción no encontrado")
    await plan.delete()
