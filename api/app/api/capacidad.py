"""Router de capacidades mensuales (por persona o por squad)."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.documents.capacidad import Capacidad
from app.middleware.aplicacion import ContextoAplicacion, contexto_aplicacion, contexto_escritura

router = APIRouter(prefix="/capacidades", tags=["capacidad"])


class CapacidadIn(BaseModel):
    scope: str = "persona"
    persona_id: str | None = None
    squad_id: str | None = None
    mes: str  # 'YYYY-MM'
    horas_disponibles: float = 180
    personas: int = 1
    notas: str | None = None


@router.get("")
async def listar(
    mes: str | None = None,
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
):
    consulta = ctx.filtro()
    if mes:
        consulta["mes"] = mes
    return await Capacidad.find(consulta).sort("mes").to_list()


@router.post("", status_code=status.HTTP_201_CREATED)
async def crear(datos: CapacidadIn, ctx: ContextoAplicacion = Depends(contexto_escritura)):
    capacidad = Capacidad(aplicacion_id=ctx.codigo, **datos.model_dump())
    await capacidad.insert()
    return capacidad


@router.put("/{capacidad_id}")
async def actualizar(
    capacidad_id: str,
    datos: CapacidadIn,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
):
    capacidad = await Capacidad.get(capacidad_id)
    if capacidad is None or capacidad.aplicacion_id != ctx.codigo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Capacidad no encontrada")
    for campo, valor in datos.model_dump().items():
        setattr(capacidad, campo, valor)
    capacidad.marcar_actualizado()
    await capacidad.save()
    return capacidad


@router.delete("/{capacidad_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar(
    capacidad_id: str, ctx: ContextoAplicacion = Depends(contexto_escritura)
) -> None:
    capacidad = await Capacidad.get(capacidad_id)
    if capacidad is None or capacidad.aplicacion_id != ctx.codigo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Capacidad no encontrada")
    await capacidad.delete()
