"""Router de festivos (insumo del cálculo de ANS).

Los festivos son globales al proyecto: aplican para todos los squads.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.documents.festivo import Festivo
from app.security.deps import requiere_permiso, usuario_actual

# F1.1 (ADR-0008 S1): el router entero exigía cero autenticación; ahora toda
# operación requiere JWT válido, y las de escritura además el permiso de
# configuración administrativa.
router = APIRouter(
    prefix="/festivos", tags=["festivos"], dependencies=[Depends(usuario_actual)]
)

_APP_GLOBAL = "global"


class FestivoIn(BaseModel):
    fecha: datetime
    descripcion: str | None = None


@router.get("")
async def listar():
    return await Festivo.find_all().sort("fecha").to_list()


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(requiere_permiso("admin.configuracion.editar"))],
)
async def crear(datos: FestivoIn):
    festivo = Festivo(aplicacion_id=_APP_GLOBAL, **datos.model_dump())
    await festivo.insert()
    return festivo


@router.delete(
    "/{festivo_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(requiere_permiso("admin.configuracion.editar"))],
)
async def eliminar(festivo_id: str) -> None:
    festivo = await Festivo.get(festivo_id)
    if festivo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Festivo no encontrado")
    await festivo.delete()
