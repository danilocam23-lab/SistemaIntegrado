"""Router de tarifas (valor hora para liquidación T&M).

Las tarifas son globales al proyecto (no están segmentadas por squad),
por lo que el listado devuelve todos los registros y las operaciones de
escritura no exigen un squad activo en particular.
"""
from decimal import Decimal

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.documents.tarifa import Tarifa

router = APIRouter(prefix="/tarifas", tags=["tarifas"])

# aplicacion_id fijo para registros globales
_APP_GLOBAL = "global"


class TarifaIn(BaseModel):
    anio: int
    valor_hora: Decimal
    ramificacion: str | None = None


@router.get("")
async def listar():
    """Devuelve todas las tarifas sin filtro de squad."""
    return await Tarifa.find_all().sort("-anio").to_list()


@router.post("", status_code=status.HTTP_201_CREATED)
async def crear(datos: TarifaIn):
    tarifa = Tarifa(aplicacion_id=_APP_GLOBAL, **datos.model_dump())
    await tarifa.insert()
    return tarifa


@router.put("/{tarifa_id}")
async def actualizar(tarifa_id: str, datos: TarifaIn):
    tarifa = await Tarifa.get(tarifa_id)
    if tarifa is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tarifa no encontrada")
    for campo, valor in datos.model_dump().items():
        setattr(tarifa, campo, valor)
    tarifa.marcar_actualizado()
    await tarifa.save()
    return tarifa


@router.delete("/{tarifa_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar(tarifa_id: str) -> None:
    tarifa = await Tarifa.get(tarifa_id)
    if tarifa is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tarifa no encontrada")
    await tarifa.delete()
