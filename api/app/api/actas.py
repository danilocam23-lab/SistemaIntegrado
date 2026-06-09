"""Router de actas de trabajo."""
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.documents.acta_trabajo import ActaTrabajo
from app.middleware.aplicacion import ContextoAplicacion, contexto_aplicacion, contexto_escritura

router = APIRouter(prefix="/actas", tags=["actas-trabajo"])


class ActaIn(BaseModel):
    codigo: str
    fecha: datetime | None = None
    direccion: str | None = None
    total_horas: Decimal | None = None
    total_valor: Decimal | None = None


@router.get("")
async def listar(ctx: ContextoAplicacion = Depends(contexto_aplicacion)):
    return await ActaTrabajo.find(ctx.filtro()).sort("codigo").to_list()


@router.post("", status_code=status.HTTP_201_CREATED)
async def crear(datos: ActaIn, ctx: ContextoAplicacion = Depends(contexto_escritura)):
    acta = ActaTrabajo(aplicacion_id=ctx.codigo, **datos.model_dump())
    await acta.insert()
    return acta


@router.put("/{acta_id}")
async def actualizar(
    acta_id: str, datos: ActaIn, ctx: ContextoAplicacion = Depends(contexto_escritura)
):
    acta = await ActaTrabajo.get(acta_id)
    if acta is None or acta.aplicacion_id != ctx.codigo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Acta no encontrada")
    for campo, valor in datos.model_dump().items():
        setattr(acta, campo, valor)
    acta.marcar_actualizado()
    await acta.save()
    return acta


@router.delete("/{acta_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar(
    acta_id: str, ctx: ContextoAplicacion = Depends(contexto_escritura)
) -> None:
    acta = await ActaTrabajo.get(acta_id)
    if acta is None or acta.aplicacion_id != ctx.codigo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Acta no encontrada")
    await acta.delete()
